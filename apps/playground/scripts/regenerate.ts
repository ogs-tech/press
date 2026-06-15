/**
 * Regenerates this playground from the REAL `press create` scaffold, then rewires
 * it for in-repo workspace consumption. This keeps the dogfood honest: it is
 * exactly what `press create` emits, plus the minimal tooling that makes it
 * self-regenerating (this scripts/ dir + a `regenerate` script + tsx).
 *
 *   pnpm --filter playground regenerate
 *
 * Because this script lives INSIDE the directory it rebuilds, it scaffolds into a
 * temp dir and swaps the result in while preserving scripts/ — it cannot wipe
 * itself. After the swap, `pnpm play` boots the regenerated stack (re-seeds cms).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scaffold } from '../../../packages/cli/src/create/scaffold';

const target = path.resolve(__dirname, '..'); // apps/playground
const repoRoot = path.resolve(__dirname, '..', '..', '..'); // repo root
const name = 'playground';

// The playground-only bits the real `press create` does NOT emit — re-injected
// after scaffold so a regenerated playground stays self-regenerating. tsx pins the
// same range as packages/cli + packages/web (one tsx across the repo).
const PLAYGROUND_SCRIPTS = { regenerate: 'tsx scripts/regenerate.ts' };
const TSX_RANGE = '^4.19.0';

function rewireToWorkspace(pkgPath: string, deps: string[]): void {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  for (const dep of deps) {
    if (pkg.dependencies?.[dep]) pkg.dependencies[dep] = 'workspace:*';
  }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

function injectTooling(pkgPath: string): void {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = { ...pkg.scripts, ...PLAYGROUND_SCRIPTS };
  pkg.devDependencies = { ...pkg.devDependencies, tsx: TSX_RANGE };
  // `pnpm.onlyBuiltDependencies` is correct for a STANDALONE project (it is the
  // workspace root there), but pnpm ignores the field on a workspace member and
  // warns on every install/build. The monorepo root already declares it, so drop
  // the redundant copy here — same reason we drop the standalone .npmrc/workspace.
  delete pkg.pnpm;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

// Preserve the cms Strapi uuid across regenerations so the committed dogfood does
// not churn its identity on every run (scaffold mints a fresh one).
const priorCmsPkg = path.join(target, 'cms', 'package.json');
const priorUuid: string | undefined = existsSync(priorCmsPkg)
  ? JSON.parse(readFileSync(priorCmsPkg, 'utf8'))?.strapi?.uuid
  : undefined;

// 1. Scaffold into a temp dir — target holds this script, so it can't be wiped in place.
const tmp = mkdtempSync(path.join(tmpdir(), 'press-playground-'));
const staged = path.join(tmp, name);
console.log('> scaffold three-zone project (web/cms/shared) into a temp dir');
scaffold({ target: staged, name });

// 2. Rewire @press/* → workspace:*, inject regenerate tooling, and drop the files
//    that only make sense standalone (registry .npmrc + the nested workspace file —
//    this repo has a single workspace root).
console.log('> rewire @press/* → workspace:* and inject regenerate tooling');
rewireToWorkspace(path.join(staged, 'package.json'), ['@press/cli', '@press/web']);
rewireToWorkspace(path.join(staged, 'cms', 'package.json'), ['@press/cms']);
injectTooling(path.join(staged, 'package.json'));
for (const f of ['.npmrc', 'pnpm-workspace.yaml']) {
  const p = path.join(staged, f);
  if (existsSync(p)) rmSync(p);
}
if (priorUuid) {
  const cmsPkgPath = path.join(staged, 'cms', 'package.json');
  const cmsPkg = JSON.parse(readFileSync(cmsPkgPath, 'utf8'));
  if (cmsPkg.strapi) cmsPkg.strapi.uuid = priorUuid;
  writeFileSync(cmsPkgPath, JSON.stringify(cmsPkg, null, 2) + '\n');
}

// 3. Swap the staged tree into target, preserving this scripts/ dir.
console.log('> swap regenerated tree into apps/playground (preserving scripts/)');
for (const entry of readdirSync(target)) {
  if (entry === 'scripts') continue;
  rmSync(path.join(target, entry), { recursive: true, force: true });
}
for (const entry of readdirSync(staged)) {
  cpSync(path.join(staged, entry), path.join(target, entry), { recursive: true });
}
rmSync(tmp, { recursive: true, force: true });

// 4. Link the freshly-created shared/ workspace member.
console.log('> pnpm install (links the new shared/ workspace member)');
execFileSync('pnpm', ['install'], { cwd: repoRoot, stdio: 'inherit' });

console.log('\nplayground regenerated. Run `pnpm play` to boot it.\n');
