import { materialize } from '../materialize';
import { run } from '../util/run';

export interface BuildOptions {
  cwd: string;
}

const CMS_URL = 'http://localhost:1337';

/**
 * Builds both halves into deployable artifacts (spec §5): materialize the host,
 * `strapi build` the cms host, then `next build` the materialized web host. The
 * built web output reflects press.config.ts (the Spec 2 SEO/identity surfaces in
 * the production render, not just dev). The catch-all route prerenders published
 * pages at build via generateStaticParams (it lists published slugs from the
 * CMS), so a reachable CMS lets the build emit static ISR pages; if the CMS is
 * unreachable at build the list fails to empty and every page renders on-demand.
 * Either way pages are ISR-cached (revalidate: 60): revalidated every 60s, not
 * forced dynamic per request.
 */
export async function buildCommand(opts: BuildOptions): Promise<void> {
  const root = opts.cwd;

  console.log('> materialize .press/web');
  materialize(root);

  console.log('> build cms');
  await run('pnpm', ['-C', 'packages/cms', 'build'], { cwd: root });

  console.log('> build web (.press/web)');
  await run('pnpm', ['exec', 'next', 'build', '.press/web'], {
    cwd: root,
    env: { CMS_URL },
  });

  console.log('\npress build complete — cms + web artifacts ready.\n');
}
