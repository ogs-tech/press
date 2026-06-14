import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { materialize } from '../materialize';
import { run } from '../util/run';
import { waitFor } from '../util/wait-for';

export interface DevOptions {
  cwd: string;
}

const CMS_URL = 'http://localhost:1337';
const WEB_URL = 'http://localhost:3000';

function syncTypesScript(projectRoot: string): string {
  const require = createRequire(path.join(projectRoot, 'noop.js'));
  const webPkg = require.resolve('@press/web/package.json');
  return path.join(path.dirname(webPkg), 'bin', 'sync-types.ts');
}

/**
 * Boots the whole stack as one command (spec §5):
 *   1. materialize .press/web/ from the engine host template
 *   2. seed sample content (cms server must be DOWN for the programmatic seed)
 *   3. boot the cms host (:1337), wait healthy
 *   4. sync types (cms schema -> @press/web types — the Spec 1 contract)
 *   5. boot the web host (:3000), wired to press.config.ts
 * The adopter sees one process group; the engine/adopter asymmetry is invisible.
 */
export async function devCommand(opts: DevOptions): Promise<void> {
  const root = opts.cwd;
  const cmsDir = path.join(root, 'cms');

  console.log('> materialize .press/web');
  materialize(root);

  console.log('> seed sample content');
  await run('node', [path.join(cmsDir, 'scripts', 'seed.mjs')], { cwd: cmsDir });

  console.log('> boot cms (:1337)');
  const cms = spawn('pnpm', ['-C', 'cms', 'develop'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  });

  const children = [cms];
  const shutdown = () => {
    for (const c of children) c.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const healthy = await waitFor(`${CMS_URL}/_health`, { okStatus: 204 });
  if (!healthy) {
    cms.kill();
    throw new Error('cms did not become healthy on :1337');
  }

  console.log('> sync types (cms schema -> shared/types)');
  await run('pnpm', ['exec', 'tsx', syncTypesScript(root)], {
    cwd: root,
    env: { CMS_URL, PRESS_TYPES_DIR: path.join(root, 'shared', 'types') },
  });

  console.log('> boot web (:3000)');
  console.log('  note: .press/web is engine-owned and regenerated every run — do not edit it.');
  const web = spawn('pnpm', ['exec', 'next', 'dev', '.press/web', '-p', '3000'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, CMS_URL },
  });
  children.push(web);

  const webUp = await waitFor(`${WEB_URL}`);
  if (webUp) console.log(`\npress dev ready — web ${WEB_URL}, cms ${CMS_URL}/admin\n`);

  // Keep the foreground process alive until a child exits or the user interrupts.
  await new Promise<void>((resolve) => {
    web.on('exit', resolve);
    cms.on('exit', resolve);
  });
  shutdown();
}
