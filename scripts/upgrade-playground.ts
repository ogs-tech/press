/**
 * Lightweight refresh of the playground's engine-owned artifacts WITHOUT
 * re-scaffolding the committed adopter tree (that is `pnpm play:create`). Mirrors
 * the adopter update path (`pnpm update @press/* && press dev`): re-materialize
 * .press/web from the live @press/web host template, then best-effort re-sync
 * packages/shared/types from a running cms. Use this for everyday engine
 * iteration; reach for `play:create` only when the scaffold structure changes.
 *
 *   pnpm play:upgrade
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { materialize } from '../packages/cli/src/materialize';

const repoRoot = path.resolve(__dirname, '..');
const root = path.join(repoRoot, 'apps', 'playground');
const CMS_URL = 'http://localhost:1337';

function syncTypesScript(projectRoot: string): string {
  const require = createRequire(path.join(projectRoot, 'noop.js'));
  const webPkg = require.resolve('@press/web/package.json');
  return path.join(path.dirname(webPkg), 'bin', 'sync-types.ts');
}

async function cmsReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${CMS_URL}/_health`);
    return res.status === 204;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('> materialize .press/web from the @press/web host template');
  materialize(root);

  if (await cmsReachable()) {
    console.log('> sync types (cms schema -> packages/shared/types)');
    execFileSync('pnpm', ['exec', 'tsx', syncTypesScript(root)], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, CMS_URL, PRESS_TYPES_DIR: path.join(root, 'packages', 'shared', 'types') },
    });
  } else {
    console.log('> cms not running on :1337 — skipped type sync (it runs on `pnpm play`).');
  }

  console.log('\nplayground upgraded. Run `pnpm play` to boot it.\n');
}

void main();
