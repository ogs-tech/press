/**
 * Regenerates the in-repo dogfood at apps/playground by running the REAL
 * `press create` scaffold, then rewiring it for workspace consumption. This is
 * what keeps the playground honest: it is exactly what `press create` emits, not
 * a hand-maintained divergent copy.
 *
 *   pnpm play:create
 *
 * Steps:
 *   1. wipe apps/playground (engine-materialized + cms runtime state included)
 *   2. scaffold the three-zone project (web/cms/shared) from the CLI templates
 *   3. rewire @press/* + the scaffold's Verdaccio .npmrc → workspace links
 *   4. `pnpm install` to link the freshly-created shared/ workspace member
 *
 * After this, `pnpm play` boots the regenerated stack (re-seeds the cms).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { scaffold } from '../packages/cli/src/create/scaffold';

const repoRoot = path.resolve(__dirname, '..');
const name = 'playground';
const target = path.join(repoRoot, 'apps', name);

function rewireToWorkspace(pkgPath: string, deps: string[]): void {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const dep of deps) {
    if (pkg.dependencies?.[dep]) pkg.dependencies[dep] = 'workspace:*';
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// Preserve the cms Strapi uuid across regenerations so the committed dogfood does
// not churn its identity on every `play:create` (scaffold mints a fresh one).
const priorCmsPkg = path.join(target, 'cms', 'package.json');
const priorUuid: string | undefined = existsSync(priorCmsPkg)
  ? JSON.parse(readFileSync(priorCmsPkg, 'utf8'))?.strapi?.uuid
  : undefined;

console.log(`> wipe ${path.relative(repoRoot, target)}`);
rmSync(target, { recursive: true, force: true });

console.log('> scaffold three-zone project (web/cms/shared)');
// The registry value is irrelevant here — the generated .npmrc is dropped below
// and @press/* are relinked to the workspace.
scaffold({ target, name, registry: 'http://localhost:4873' });

console.log('> rewire @press/* → workspace:* and drop the Verdaccio .npmrc');
rewireToWorkspace(path.join(target, 'package.json'), ['@press/cli', '@press/web']);
rewireToWorkspace(path.join(target, 'cms', 'package.json'), ['@press/cms']);
const npmrc = path.join(target, '.npmrc');
if (existsSync(npmrc)) rmSync(npmrc);

// Restore the preserved cms identity (keeps the migration/diff stable).
if (priorUuid) {
  const cmsPkg = JSON.parse(readFileSync(priorCmsPkg, 'utf8'));
  if (cmsPkg.strapi) cmsPkg.strapi.uuid = priorUuid;
  writeFileSync(priorCmsPkg, JSON.stringify(cmsPkg, null, 2) + '\n');
}

// The dogfood shares THIS repo's single workspace root — its cms + shared are
// registered in the root pnpm-workspace.yaml, so the scaffold's own nested
// workspace file must be dropped (pnpm has one workspace root per tree).
const nestedWorkspace = path.join(target, 'pnpm-workspace.yaml');
if (existsSync(nestedWorkspace)) rmSync(nestedWorkspace);

console.log('> pnpm install (links the new shared/ workspace member)');
execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });

console.log('\nplayground regenerated. Run `pnpm play` to boot it.\n');
