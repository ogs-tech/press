/**
 * Creates (or recreates) apps/playground from the REAL `press create` scaffold,
 * then rewires it for in-repo workspace consumption. This keeps the dogfood
 * honest: apps/playground is exactly what `press create` emits, minus the files
 * that only make sense for a STANDALONE project (its own .npmrc / nested
 * pnpm-workspace.yaml / pnpm.onlyBuiltDependencies — the monorepo root owns
 * those), with @ogs-tech/press-* pinned to workspace:*.
 *
 *   pnpm play:create
 *
 * Unlike the old in-directory `regenerate`, this tool lives OUTSIDE the directory
 * it rebuilds, so there is no self-preservation swap and the playground keeps no
 * scripts/ dir (tsx resolves transitively via @ogs-tech/press-cli under the repo's
 * node-linker=hoisted). It scaffolds into a temp dir then replaces apps/playground
 * atomically, so a mid-scaffold failure never leaves a half-wiped dogfood. The cms
 * Strapi uuid is preserved across runs (read before the swap) so the committed
 * dogfood does not churn its identity.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scaffold } from '../packages/cli/src/create/scaffold';

const repoRoot = path.resolve(__dirname, '..');
const target = path.join(repoRoot, 'apps', 'playground');
const name = 'playground';

function rewireToWorkspace(pkgPath: string, deps: string[]): void {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const dep of deps) {
    if (pkg.dependencies?.[dep]) pkg.dependencies[dep] = 'workspace:*';
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// `pnpm.onlyBuiltDependencies` is correct for a STANDALONE project (it is the
// workspace root there), but pnpm ignores the field on a workspace member and
// warns on every install/build. The monorepo root already declares it, so drop
// the redundant copy — same reason we drop the standalone .npmrc/workspace file.
function stripStandaloneFields(pkgPath: string): void {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  delete pkg.pnpm;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// Preserve the cms Strapi uuid across recreations so the committed dogfood does
// not churn its identity on every run (scaffold mints a fresh one).
const priorCmsPkg = path.join(target, 'packages', 'cms', 'package.json');
const priorUuid: string | undefined = existsSync(priorCmsPkg)
  ? JSON.parse(readFileSync(priorCmsPkg, 'utf8'))?.strapi?.uuid
  : undefined;

// 1. Scaffold into a temp dir (scaffold's existsSync guard requires an absent target).
const tmp = mkdtempSync(path.join(tmpdir(), 'press-playground-'));
const staged = path.join(tmp, name);
console.log('> scaffold three-zone project (packages/web|cms|shared) into a temp dir');
scaffold({ target: staged, name });

// 2. Rewire @ogs-tech/press-* → workspace:* and drop standalone-only files/fields.
console.log('> rewire @ogs-tech/press-* → workspace:* and strip standalone-only fields');
rewireToWorkspace(path.join(staged, 'package.json'), ['@ogs-tech/press-cli', '@ogs-tech/press-web']);
rewireToWorkspace(path.join(staged, 'packages', 'cms', 'package.json'), ['@ogs-tech/press-cms']);
stripStandaloneFields(path.join(staged, 'package.json'));
for (const f of ['.npmrc', 'pnpm-workspace.yaml']) {
  const p = path.join(staged, f);
  if (existsSync(p)) rmSync(p);
}
if (priorUuid) {
  const cmsPkgPath = path.join(staged, 'packages', 'cms', 'package.json');
  const cmsPkg = JSON.parse(readFileSync(cmsPkgPath, 'utf8'));
  if (cmsPkg.strapi) cmsPkg.strapi.uuid = priorUuid;
  writeFileSync(cmsPkgPath, JSON.stringify(cmsPkg, null, 2) + '\n');
}

// 3. Replace apps/playground with the staged tree.
console.log('> replace apps/playground with the regenerated tree');
rmSync(target, { recursive: true, force: true });
cpSync(staged, target, { recursive: true });
rmSync(tmp, { recursive: true, force: true });

// 4. Link the freshly-created packages/* workspace members.
console.log('> pnpm install (links the new packages/* workspace members)');
execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });

console.log('\nplayground created. Run `pnpm play` to boot it.\n');
