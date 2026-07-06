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
 * the production render, not just dev). The catch-all route declares no
 * generateStaticParams, so Next never calls getPage at build time — no live cms
 * is required to build. At runtime the route fetches ISR-cached (revalidate: 60):
 * pages render on-demand on first hit and revalidate every 60s (not forced
 * dynamic, not stale beyond the window).
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
