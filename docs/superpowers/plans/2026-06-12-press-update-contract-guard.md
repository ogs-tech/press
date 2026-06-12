---
title: "Plan — Update path + CI contract guard (Spec 4)"
internal_name: press-cli
relates_to: docs/superpowers/specs/2026-06-11-press-update-contract-guard-design.md
roadmap: docs/beta/roadmap.md
status: Ready to execute
created_at: 2026-06-12
updated_at: 2026-06-12
---

# Update path + CI contract guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the one-off local `contract-check` into a standing, both-package, render-deep **CI contract guard** that runs a real engine update cycle (vN → vN+1 of `@press/cms` *and* `@press/web`, published to an ephemeral Verdaccio) and fails on any of the three leak classes — a Project-zone file changed on disk, the host stops booting, or the adopter's blocks/whitelabel `<head>` stop rendering — wired into GitHub Actions as a required check on `packages/**` PRs.

**Architecture:** A thin orchestrator (`scripts/contract-guard.mjs`) composes single-purpose helpers under `scripts/lib/` and the existing `seed-e2e.mjs` / `e2e-check.mjs` / `assert-no-engine-in-host.mjs` / `registry.sh` into the 11-step cycle of spec §4.2. The guard materializes **two** engine versions by construction — baseline `vN` from the last release tag (or HEAD in bootstrap), candidate `vN+1` from HEAD (synthetic `X.Y.Z-contract.<sha>` prerelease when the version wasn't bumped) — publishes both to a CI-local Verdaccio, stages the real adopter (`apps/cms` + `apps/web`) pinned at `vN`, asserts it is GREEN, runs `pnpm update @press/* → vN+1`, and asserts all three leak classes pass. The same script runs identically on a laptop and in CI.

**Tech Stack:** Node 20 LTS, pnpm 10 workspaces + Turborepo, Strapi 5.48.0 (`apps/cms`, `@press/cms`), Next 15 (`apps/web`, `@press/web`), Verdaccio 6.7.2 (ephemeral registry), GitHub Actions. Engine baselines today: `@press/cms@0.3.2`, `@press/web@0.1.0`.

**Spec → task map (self-review §coverage):**

| Spec item | Task(s) |
| --- | --- |
| §2.3 both engine packages; §4.2 step pre-req — `@press/web` must be publishable & web consumes a real version | **T1** |
| §4.4 generalize allowed delta to both manifests + lockfile (leak-snapshot) | **T2** |
| §4.1 two versions by construction; synthetic prerelease; §4.3 baseline tag + bootstrap | **T3** |
| §4.2 steps 5–11 adopter cycle (stage @ vN, green baseline, update, leak asserts) | **T4** |
| §4.2 full orchestrator; §7 AC1 + AC4 (bootstrap honest); §6 self-contained, locally runnable | **T5** |
| §4.3 first release tag (DoD); enables a real baseline | **T6** |
| §5 behavioral leak; §7 AC2 negative test | **T7** |
| §6 CI workflow; §7 AC3 (gated, required check, no external registry) | **T8** |
| §8 DoD — fold `contract-check` in; README update path + guard command + leak taxonomy; §7 AC5 docs | **T9** |

---

## Conventions used in every task

- **Run from the repo root** (`/Users/odenirgomes/Projects/ogs-tech/internal/press-cli`) unless a step says otherwise. Avoid `cd` inside compound commands; prefer subshells `( cd X && ... )` when a tool demands a working dir.
- **The orchestrator and its libs are ESM `.mjs`** under `scripts/` / `scripts/lib/`, matching the existing `*.mjs` scripts. No new runtime dependency is introduced — only Node built-ins and the tools already in the repo (pnpm, npm, git, curl, verdaccio).
- **Verdaccio is always CI-local / laptop-local.** Never publish to or read from an external registry. Use `--userconfig "$ROOT/.npmrc"` on `npm publish` so the `@press` scope + token route to `localhost:4873` (mirrors README "Run the spike").
- **The adopter (`apps/cms`, `apps/web`) is sacred.** The guard mutates only the two manifests + the lockfile while staging, and restores them in a `finally`. If any *other* Project-zone file differs on disk after the update, that is the file leak the guard exists to catch.
- **Commit after every green step.** Conventional-commit messages. End commit messages with the `Co-Authored-By` trailer this repo uses.

---

## Task 1: Make `@press/web` publishable and consumed as a real version (preflight blocker)

**Why first:** the cycle updates **both** packages (spec §2.3), but today `apps/web` depends on `@press/web` via `workspace:*` and `@press/web` has **no `files` field and no `.npmignore`** — so `npm publish` falls back to `.gitignore`, which lists `src/types/generated.ts`. The tarball would ship **without the sync-generated types**, and `apps/web` would fail to resolve `@press/web/types`. This task makes a published tarball self-sufficient and proves the web host builds against it from Verdaccio. Without it, steps 4–11 of the guard cannot run.

**Files:**
- Create: `packages/press-web/.npmignore`
- Test (throwaway): `npm pack --dry-run` output inspection

- [ ] **Step 1: Add an `.npmignore` so the tarball ships `src/` (incl. generated types) but not tests/config**

The presence of `.npmignore` makes npm ignore `.gitignore` entirely for packing, so `src/types/generated.ts` is no longer excluded. Create `packages/press-web/.npmignore`:

```
# An .npmignore is REQUIRED here: without it npm falls back to .gitignore, which
# excludes src/types/generated.ts — the sync-generated types the consumer imports
# via @press/web/types. We DO want generated.ts in the tarball (the guard runs
# sync-types before publishing), so this file deliberately does NOT list it.
node_modules/
vitest.config.ts
**/*.test.ts
**/*.test.tsx
```

> Note we keep `src/**` (the package's `exports` point at `./src/*.ts`; Next transpiles it via `transpilePackages`). Only tests and the vitest config are stripped.

- [ ] **Step 2: Generate the types so the pack test has something to assert (reuses the documented Spec 1 flow)**

The guard will run this automatically; here we run it once to verify packing. The CMS must be seeded, stopped, then started (README "Run the web engine"). Run:

```bash
scripts/registry.sh start
pnpm install
( cd apps/cms && node ../../scripts/seed-e2e.mjs )
pnpm --filter cms start > /tmp/cms-preflight.log 2>&1 &
for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health || true); [ "$c" = "204" ] && { echo CMS-UP; break; }; sleep 2; done
pnpm --filter @press/web sync-types
```

Expected: `CMS-UP`, then `[press/web] wrote src/types/generated.ts (… bytes)`. Leave the CMS running for Step 3, or stop it — Step 3 only packs.

- [ ] **Step 3: Verify the tarball contents include the generated types and the entry**

Run:

```bash
( cd packages/press-web && npm pack --dry-run 2>&1 ) | grep -E "src/types/generated.ts|src/index.ts|bin/sync-types.ts" || echo "MISSING EXPECTED FILES"
```

Expected: three lines printed for `src/index.ts`, `src/types/generated.ts`, `bin/sync-types.ts`. If `MISSING EXPECTED FILES` prints, the `.npmignore` is wrong — fix before continuing.

- [ ] **Step 4: Stop the CMS and tear down the registry used for the preflight**

```bash
pkill -f "strapi start" 2>/dev/null || true
scripts/registry.sh stop || true
```

- [ ] **Step 5: Commit**

```bash
git add packages/press-web/.npmignore
git commit -m "$(cat <<'EOF'
build(press-web): add .npmignore so published tarball ships sync-generated types

Without it npm falls back to .gitignore and drops src/types/generated.ts,
breaking adopters that consume @press/web from a registry (Spec 4 §2.3).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `scripts/lib/leak-snapshot.mjs` — content-hash file-leak + generalized manifest delta

**Why a content-hash, not `git diff`:** the guard rewrites `apps/web/package.json` from `workspace:*` to a pinned version while staging the baseline, so a `git status` diff would be polluted by staging itself. Hashing the adopter zone **after** staging and **after** the update isolates exactly what the *update* touched on disk — the precise §5 "Project-zone file changed on disk" definition. This module is pure and gets real unit tests.

**Files:**
- Create: `scripts/lib/leak-snapshot.mjs`
- Test: `scripts/lib/leak-snapshot.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/leak-snapshot.test.mjs`:

```javascript
// scripts/lib/leak-snapshot.test.mjs
import { describe, it, expect } from 'vitest';
import { diffZones, findFileLeaks, manifestVersionOnlyViolation } from './leak-snapshot.mjs';

describe('diffZones', () => {
  it('reports changed, added, and removed paths', () => {
    const before = new Map([['a', 'h1'], ['b', 'h2'], ['gone', 'h3']]);
    const after = new Map([['a', 'h1'], ['b', 'CHANGED'], ['new', 'h4']]);
    const d = diffZones(before, after);
    expect(d.changed).toEqual(['b']);
    expect(d.added).toEqual(['new']);
    expect(d.removed).toEqual(['gone']);
    expect(d.all.sort()).toEqual(['b', 'gone', 'new']);
  });
});

describe('findFileLeaks', () => {
  const allowed = new Set(['apps/cms/package.json', 'apps/web/package.json', 'pnpm-lock.yaml']);
  it('passes when every changed path is allowed', () => {
    const d = { all: ['apps/cms/package.json', 'pnpm-lock.yaml'] };
    expect(findFileLeaks(d, allowed)).toEqual([]);
  });
  it('flags any path outside the allowed set', () => {
    const d = { all: ['apps/web/press-config.ts', 'pnpm-lock.yaml'] };
    expect(findFileLeaks(d, allowed)).toEqual(['apps/web/press-config.ts']);
  });
});

describe('manifestVersionOnlyViolation', () => {
  it('returns null when only the @press/* version line changed', () => {
    const before = '{\n  "dependencies": {\n    "@press/cms": "0.3.2",\n    "next": "^15.1.0"\n  }\n}\n';
    const after  = '{\n  "dependencies": {\n    "@press/cms": "0.4.0",\n    "next": "^15.1.0"\n  }\n}\n';
    expect(manifestVersionOnlyViolation(before, after)).toBeNull();
  });
  it('flags a non-@press change to the manifest', () => {
    const before = '{\n  "dependencies": {\n    "@press/cms": "0.3.2",\n    "next": "^15.1.0"\n  }\n}\n';
    const after  = '{\n  "dependencies": {\n    "@press/cms": "0.3.2",\n    "next": "^15.9.9"\n  }\n}\n';
    expect(manifestVersionOnlyViolation(before, after)).toMatch(/next/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @press/web exec vitest run ../../scripts/lib/leak-snapshot.test.mjs`
Expected: FAIL — `Cannot find module './leak-snapshot.mjs'`.

> Why run through `@press/web`'s vitest: it is the workspace package that already has `vitest` installed. The relative path reaches up to `scripts/lib/`. (Alternatively run `pnpm --filter @press/web exec vitest run` after copying the test under that package — but the up-path keeps the lib beside the orchestrator that uses it.)

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/leak-snapshot.mjs`:

```javascript
// scripts/lib/leak-snapshot.mjs
// Pure helpers for the contract guard's FILE-LEAK class (spec §5).
// hashZone() fingerprints the adopter Project zone on disk; diffZones() isolates
// what an update changed; findFileLeaks() enforces the generalized allowed delta
// (both adopter manifests + the lockfile, spec §4.4); manifestVersionOnlyViolation()
// proves the only meaningful manifest change is the @press/* version range.
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

// Build/output/VCS dirs that are not Project-zone source — never part of the leak
// surface. Mirrors .gitignore's generated paths plus per-app build output.
export const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.turbo', '.next', '.strapi', '.cache',
  'dist', 'build', '.tmp', 'tsconfig.tsbuildinfo',
]);

const EXCLUDED_FILE = (name) =>
  name === '.env' || name.startsWith('.env.') || name.endsWith('.db') || name.endsWith('.sqlite') || name.endsWith('.log');

/**
 * Fingerprint every source file under `roots` (paths relative to `repoRoot`).
 * @returns Map<relPath, sha256>
 */
export function hashZone(roots, repoRoot = process.cwd()) {
  const out = new Map();
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      if (EXCLUDED_DIRS.has(entry) || EXCLUDED_FILE(entry)) continue;
      const child = join(abs, entry);
      const st = statSync(child);
      if (st.isDirectory()) walk(child);
      else out.set(relative(repoRoot, child), createHash('sha256').update(readFileSync(child)).digest('hex'));
    }
  };
  for (const r of roots) {
    const abs = join(repoRoot, r);
    try { walk(abs); } catch { /* root may be a single file */ try { out.set(r, createHash('sha256').update(readFileSync(abs)).digest('hex')); } catch {} }
  }
  return out;
}

/** Diff two hashZone() maps into changed / added / removed (+ a combined `all`). */
export function diffZones(before, after) {
  const changed = [], added = [], removed = [];
  for (const [p, h] of after) {
    if (!before.has(p)) added.push(p);
    else if (before.get(p) !== h) changed.push(p);
  }
  for (const p of before.keys()) if (!after.has(p)) removed.push(p);
  return { changed, added, removed, all: [...changed, ...added, ...removed] };
}

/** Every changed path must be in `allowed`; return those that are not (the leaks). */
export function findFileLeaks(diff, allowed) {
  return diff.all.filter((p) => !allowed.has(p));
}

/**
 * Given before/after text of a manifest, assert the ONLY changed dependency line
 * mentions an @press/* package. Returns a violation message, or null if clean.
 */
export function manifestVersionOnlyViolation(beforeText, afterText) {
  const lineSet = (t) => new Set(t.split('\n').map((l) => l.trim()).filter(Boolean));
  const b = lineSet(beforeText), a = lineSet(afterText);
  const changedLines = [...a].filter((l) => !b.has(l)).concat([...b].filter((l) => !a.has(l)));
  const offending = changedLines.filter((l) => !/@press\//.test(l));
  return offending.length ? `non-@press change in manifest:\n  ${offending.join('\n  ')}` : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @press/web exec vitest run ../../scripts/lib/leak-snapshot.test.mjs`
Expected: PASS, 3 suites / 6 assertions green.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/leak-snapshot.mjs scripts/lib/leak-snapshot.test.mjs
git commit -m "$(cat <<'EOF'
test(guard): content-hash file-leak + generalized manifest-delta lib

Both-manifest allowed delta (Spec 4 §4.4); independent of git cleanliness so
the workspace:*→pinned baseline rewrite doesn't pollute leak detection.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `scripts/lib/registry.mjs` + `scripts/lib/baseline.mjs` — publish both versions by construction

**Goal:** the helpers that materialize the two engine versions (spec §4.1) and resolve the baseline (spec §4.3). `registry.mjs` builds + publishes a package at a chosen version to Verdaccio; `baseline.mjs` resolves the last release tag, computes the synthetic prerelease, and runs a callback inside a worktree checked out at a tag.

**Files:**
- Create: `scripts/lib/registry.mjs`
- Create: `scripts/lib/baseline.mjs`
- Create: `scripts/lib/sh.mjs` (shared exec helpers)

- [ ] **Step 1: Write the shared exec helper**

Create `scripts/lib/sh.mjs`:

```javascript
// scripts/lib/sh.mjs — shared child-process helpers for the contract guard.
import { execSync } from 'node:child_process';

/** Capture trimmed stdout. execSync returns null under stdio:'inherit', so guard it. */
export const sh = (cmd, opts = {}) =>
  (execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }) ?? '').trim();

/** Run with live output (build/boot logs) — returns nothing useful. */
export const shInherit = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', ...opts });

/** Run a bash snippet (boot loops use bash-isms), capture stdout. */
export const bash = (script, opts = {}) =>
  sh(script, { shell: '/bin/bash', ...opts });
```

- [ ] **Step 2: Write the registry/publish helper**

Create `scripts/lib/registry.mjs`:

```javascript
// scripts/lib/registry.mjs — ephemeral Verdaccio + engine publish (spec §3, §4.1).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sh, shInherit } from './sh.mjs';

export const REGISTRY_URL = 'http://localhost:4873';

export function startRegistry(root) {
  shInherit(`"${join(root, 'scripts/registry.sh')}" start`, { shell: '/bin/bash' });
}
export function stopRegistry(root) {
  try { shInherit(`"${join(root, 'scripts/registry.sh')}" stop`, { shell: '/bin/bash' }); } catch {}
}

export function readPackageVersion(pkgDir) {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;
}

export function setPackageVersion(pkgDir, version) {
  const file = join(pkgDir, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

/** Versions of a scoped package already on Verdaccio (empty array if unknown). */
export function publishedVersions(pkgName) {
  const url = `${REGISTRY_URL}/${pkgName.replace('/', '%2f')}`;
  try {
    const body = sh(`curl -s "${url}"`);
    const json = JSON.parse(body);
    return Object.keys(json.versions ?? {});
  } catch { return []; }
}

/**
 * Build a workspace package and publish it at `version` to Verdaccio.
 * `filter` is the pnpm --filter name (e.g. "@press/cms"); `pkgDir` is its dir.
 * Idempotent against re-publish: a duplicate version is tolerated (warn, continue).
 */
export function buildAndPublish({ root, filter, pkgDir, version }) {
  setPackageVersion(pkgDir, version);
  shInherit(`pnpm --filter ${filter} build`, { cwd: root });
  try {
    shInherit(`npm publish --registry ${REGISTRY_URL} --userconfig "${join(root, '.npmrc')}"`, { cwd: pkgDir });
  } catch (e) {
    const existing = publishedVersions(filter);
    if (existing.includes(version)) console.warn(`[guard] ${filter}@${version} already published — reusing`);
    else throw e;
  }
}
```

> `@press/web` has no `build` script (it ships source). Add a no-op so `pnpm --filter @press/web build` succeeds: in `packages/press-web/package.json` `scripts`, add `"build": "echo '@press/web ships TS source; nothing to build'"`. Do that now and include it in this task's commit.

- [ ] **Step 3: Add the no-op build script to `@press/web`**

Edit `packages/press-web/package.json` `scripts` to add:

```jsonc
"build": "echo '@press/web ships TS source; nothing to build'",
```

- [ ] **Step 4: Write the baseline/version helper**

Create `scripts/lib/baseline.mjs`:

```javascript
// scripts/lib/baseline.mjs — baseline resolution + synthetic versions (spec §4.1, §4.3).
import { sh, shInherit } from './sh.mjs';
import { rmSync } from 'node:fs';

/** Newest engine release tag (engine-vX.Y.Z), or null in bootstrap. */
export function lastEngineTag() {
  const tags = sh(`git tag --list 'engine-v*' --sort=-v:refname`).split('\n').filter(Boolean);
  return tags[0] ?? null;
}

export const shortSha = () => sh('git rev-parse --short HEAD');
export const headCommit = () => sh('git rev-parse HEAD');

/** Commit a tag points at (for the "tag == HEAD" fast path). */
export function tagCommit(tag) {
  return sh(`git rev-list -n 1 ${tag}`);
}

/**
 * Candidate version: HEAD's version if it is strictly greater than baseline,
 * else a synthetic strictly-greater prerelease so the code delta is always real
 * even when nobody bumped the version (spec §4.1).
 */
export function candidateVersion(headVersion, baselineVersion) {
  if (headVersion !== baselineVersion) return headVersion;
  return `${headVersion}-contract.${shortSha()}`;
}

/**
 * Check out `ref` into a detached worktree, install + run `fn(dir)`, always remove
 * the worktree. Used to build the baseline engine from its release tag.
 */
export function withWorktree(ref, fn) {
  const dir = `/tmp/press-baseline-${process.pid}`;
  rmSync(dir, { recursive: true, force: true });
  shInherit(`git worktree add --detach "${dir}" ${ref}`);
  try {
    shInherit(`pnpm install`, { cwd: dir });
    return fn(dir);
  } finally {
    try { shInherit(`git worktree remove --force "${dir}"`); } catch {}
    rmSync(dir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 5: Smoke-test the registry helper end-to-end (publish + query)**

Run:

```bash
scripts/registry.sh start
node --input-type=module -e "
import { startRegistry, buildAndPublish, publishedVersions } from './scripts/lib/registry.mjs';
const root = process.cwd();
buildAndPublish({ root, filter: '@press/cms', pkgDir: root + '/packages/press-cms', version: '0.3.2' });
console.log('cms versions:', publishedVersions('@press/cms'));
"
```

Expected: build runs, `+ @press/cms@0.3.2` (or "already published — reusing"), and `cms versions: [ '0.3.2', ... ]`. Restore the package version afterward:

```bash
git checkout -- packages/press-cms/package.json
scripts/registry.sh stop || true
```

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/sh.mjs scripts/lib/registry.mjs scripts/lib/baseline.mjs packages/press-web/package.json
git commit -m "$(cat <<'EOF'
feat(guard): registry/publish + baseline-resolution libs (both versions by construction)

Synthetic X.Y.Z-contract.<sha> candidate guarantees a real code delta even
without a version bump; worktree-from-tag builds the baseline (Spec 4 §4.1/§4.3).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `scripts/lib/adopter-cycle.mjs` — stage @ vN, green baseline, update, leak asserts

**Goal:** the adopter half of the cycle (spec §4.2 steps 5–11): pin both manifests to a version set, install from Verdaccio, prove the project is GREEN at the baseline (seed + boot + sync + render), run the `pnpm update`, and expose the post-update file/manifest state for the orchestrator's leak asserts. Reuses `seed-e2e.mjs`, `e2e-check.mjs`, `assert-no-engine-in-host.mjs` unchanged.

**Files:**
- Create: `scripts/lib/adopter-cycle.mjs`

- [ ] **Step 1: Write the adopter-cycle module**

Create `scripts/lib/adopter-cycle.mjs`:

```javascript
// scripts/lib/adopter-cycle.mjs — the adopter side of the update cycle (spec §4.2).
// Stages the REAL host (apps/cms + apps/web) at a version set, proves it green,
// runs the update, and surfaces disk state for the orchestrator's leak asserts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sh, shInherit, bash } from './sh.mjs';

const ADOPTER_MANIFESTS = ['apps/cms/package.json', 'apps/web/package.json'];

/** Rewrite the @press/* dependency ranges in both adopter manifests to exact versions. */
export function pinAdopter(root, { cms, web }) {
  setDep(join(root, 'apps/cms/package.json'), '@press/cms', cms);
  setDep(join(root, 'apps/web/package.json'), '@press/web', web);
  shInherit(`pnpm install --no-frozen-lockfile`, { cwd: root });
}

function setDep(file, name, version) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.dependencies[name] = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}

/** Boot the CMS detached; resolve when /_health returns 204 (spec §4.2 boot-leak). */
export function startCms(root) {
  const out = bash(
    `( pnpm --filter cms start > /tmp/guard-cms.log 2>&1 & echo $! > /tmp/guard-cms.pid; ` +
    `for i in $(seq 1 90); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health||true); ` +
    `[ "$c" = "204" ] && { echo BOOTOK; break; }; sleep 2; done )`,
    { cwd: root },
  );
  if (!out.includes('BOOTOK')) throw new Error('BOOT LEAK: CMS did not reach /_health 204 — see /tmp/guard-cms.log');
}

export function stopCms() {
  try { bash(`[ -f /tmp/guard-cms.pid ] && kill "$(cat /tmp/guard-cms.pid)" 2>/dev/null; pkill -f "strapi start" 2>/dev/null; true`); } catch {}
}

/**
 * Prove the staged project really works (spec §4.2 step 5 / step 10): seed a page
 * with press.hero + custom.callout, boot the CMS, sync types, then run the seeded
 * e2e render (blocks + whitelabel <head>). Throws on any failure.
 */
export function assertGreen(root) {
  stopCms(); // seed boots Strapi in-process; the port must be free first.
  shInherit(`node ../../scripts/seed-e2e.mjs`, { cwd: join(root, 'apps/cms') });
  startCms(root);
  try {
    shInherit(`pnpm --filter @press/web sync-types`, { cwd: root });
    // e2e-check builds + starts apps/web itself and asserts both blocks + <head>.
    shInherit(`node scripts/e2e-check.mjs`, { cwd: root });
    // Host-thinness invariant (engine-in-host leak class).
    shInherit(`node scripts/assert-no-engine-in-host.mjs`, { cwd: root });
  } finally {
    stopCms();
  }
}

/** THE update path the real adopter runs (spec §2.1): bump both @press/* to vN+1. */
export function runUpdate(root, { cms, web }) {
  shInherit(`pnpm --filter cms update @press/cms@${cms}`, { cwd: root });
  shInherit(`pnpm --filter web update @press/web@${web}`, { cwd: root });
}

/** Original on-disk text of both manifests (for the version-only diff). */
export function manifestTexts(root) {
  return Object.fromEntries(ADOPTER_MANIFESTS.map((m) => [m, readFileSync(join(root, m), 'utf8')]));
}

/** Restore the adopter to its committed state (manifests + lockfile + web workspace:*). */
export function restoreAdopter(root) {
  try {
    shInherit(`git checkout -- apps/cms/package.json apps/web/package.json pnpm-lock.yaml`, { cwd: root });
    shInherit(`pnpm install --no-frozen-lockfile`, { cwd: root });
  } catch (e) {
    console.warn('[guard] adopter restore failed:', e.message);
  }
}
```

> **Soft spot (flagged):** `runUpdate`'s `pnpm update @press/web@<synthetic-prerelease>` must resolve a prerelease from Verdaccio. If `pnpm update` refuses the prerelease range, fall back to `pnpm --filter web add @press/web@<version>` (same effect: rewrites the manifest range + lockfile). The orchestrator (Task 5) wraps this so the fallback is one line.

- [ ] **Step 2: Sanity-check the module imports cleanly**

Run:

```bash
node --input-type=module -e "import('./scripts/lib/adopter-cycle.mjs').then(m => console.log('exports:', Object.keys(m).join(', ')))"
```

Expected: `exports: pinAdopter, startCms, stopCms, assertGreen, runUpdate, manifestTexts, restoreAdopter`.

- [ ] **Step 3: Commit**

```bash
git add scripts/lib/adopter-cycle.mjs
git commit -m "$(cat <<'EOF'
feat(guard): adopter-cycle lib — stage@vN, green baseline, update, restore

Reuses seed-e2e + e2e-check + assert-no-engine-in-host; green-baseline seeds and
renders a real entry so a missing DZ component can't 204-false-pass (Spec 4 §4.2).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `scripts/contract-guard.mjs` — the orchestrator + bootstrap run (AC1 harness, AC4)

**Goal:** wire the libs into the 11-step cycle of spec §4.2 in one self-contained, locally-runnable script, and run it in **bootstrap** mode (no tag yet) to prove the harness end-to-end and that bootstrap is honest (AC4).

**Files:**
- Create: `scripts/contract-guard.mjs`
- Modify: `package.json` (add `guard` script)

- [ ] **Step 1: Write the orchestrator**

Create `scripts/contract-guard.mjs`:

```javascript
#!/usr/bin/env node
// scripts/contract-guard.mjs — the standing contract guard (Spec 4).
// One real, both-package, render-deep update cycle vN -> vN+1 against an ephemeral
// Verdaccio, failing on any leak class (file / boot / behavioral). Runs identically
// on a laptop and in CI. Self-contained: starts and stops its own registry.
import { startRegistry, stopRegistry, buildAndPublish, readPackageVersion } from './lib/registry.mjs';
import { lastEngineTag, candidateVersion, withWorktree, tagCommit, headCommit, shortSha } from './lib/baseline.mjs';
import { hashZone, diffZones, findFileLeaks, manifestVersionOnlyViolation } from './lib/leak-snapshot.mjs';
import {
  pinAdopter, assertGreen, runUpdate, manifestTexts, restoreAdopter, stopCms,
} from './lib/adopter-cycle.mjs';

const root = process.cwd();
const CMS = { filter: '@press/cms', pkgDir: `${root}/packages/press-cms` };
const WEB = { filter: '@press/web', pkgDir: `${root}/packages/press-web` };
const ADOPTER_ZONES = ['apps/cms', 'apps/web', 'pnpm-lock.yaml'];
const ALLOWED_DELTA = new Set(['apps/cms/package.json', 'apps/web/package.json', 'pnpm-lock.yaml']);

const log = (m) => console.log(`\n=== ${m} ===`);
const fail = (m) => { console.error(`\nCONTRACT GUARD FAILED — ${m}`); process.exitCode = 1; throw new Error(m); };

async function main() {
  // 1. Ephemeral registry.
  log('start ephemeral Verdaccio');
  startRegistry(root);

  // 2-4. Resolve baseline & candidate versions, publish BOTH for BOTH packages.
  const tag = lastEngineTag();
  const bootstrap = !tag;
  const headCmsV = readPackageVersion(CMS.pkgDir);
  const headWebV = readPackageVersion(WEB.pkgDir);

  let baseCmsV, baseWebV;
  if (bootstrap) {
    console.log('BOOTSTRAP: no baseline tag, harness-only run (baseline code == candidate code)');
    baseCmsV = headCmsV;
    baseWebV = headWebV;
    // Publish baseline = HEAD code at the HEAD versions.
    buildAndPublish({ root, ...CMS, version: baseCmsV });
    buildAndPublish({ root, ...WEB, version: baseWebV });
  } else if (tagCommit(tag) === headCommit()) {
    // Fast path: tag points at HEAD — baseline code == HEAD code, skip the worktree.
    console.log(`baseline tag ${tag} == HEAD; building baseline from HEAD`);
    baseCmsV = headCmsV; baseWebV = headWebV;
    buildAndPublish({ root, ...CMS, version: baseCmsV });
    buildAndPublish({ root, ...WEB, version: baseWebV });
  } else {
    // Build the baseline engine from its tag in a throwaway worktree.
    console.log(`building baseline engine from tag ${tag}`);
    withWorktree(tag, (dir) => {
      baseCmsV = readPackageVersion(`${dir}/packages/press-cms`);
      baseWebV = readPackageVersion(`${dir}/packages/press-web`);
      buildAndPublish({ root: dir, filter: CMS.filter, pkgDir: `${dir}/packages/press-cms`, version: baseCmsV });
      buildAndPublish({ root: dir, filter: WEB.filter, pkgDir: `${dir}/packages/press-web`, version: baseWebV });
    });
  }

  // Candidate = HEAD code, synthetic prerelease when the version wasn't bumped.
  const candCmsV = candidateVersion(headCmsV, baseCmsV);
  const candWebV = candidateVersion(headWebV, baseWebV);
  log(`publish candidate vN+1 (cms ${candCmsV}, web ${candWebV})`);
  buildAndPublish({ root, ...CMS, version: candCmsV });
  buildAndPublish({ root, ...WEB, version: candWebV });
  // Restore HEAD package.json versions the publish step mutated.
  const { shInherit } = await import('./lib/sh.mjs');
  shInherit(`git checkout -- packages/press-cms/package.json packages/press-web/package.json`, { cwd: root });

  try {
    // 5. Stage adopter @ vN and assert GREEN baseline (project really works at vN).
    log(`stage adopter @ vN (cms ${baseCmsV}, web ${baseWebV})`);
    pinAdopter(root, { cms: baseCmsV, web: baseWebV });
    log('assert GREEN baseline (seed + boot + render @ vN)');
    assertGreen(root);

    // 6. Snapshot the Project zone, then run THE update path.
    const before = hashZone(ADOPTER_ZONES, root);
    const beforeManifests = manifestTexts(root);
    log(`pnpm update @press/* -> vN+1 (cms ${candCmsV}, web ${candWebV})`);
    try { runUpdate(root, { cms: candCmsV, web: candWebV }); }
    catch {
      // prerelease range fallback (see adopter-cycle soft spot).
      shInherit(`pnpm --filter cms add @press/cms@${candCmsV}`, { cwd: root });
      shInherit(`pnpm --filter web add @press/web@${candWebV}`, { cwd: root });
    }

    // 7. FILE leak: only the allowed delta moved.
    log('assert FILE leak: none');
    const diff = diffZones(before, hashZone(ADOPTER_ZONES, root));
    const leaks = findFileLeaks(diff, ALLOWED_DELTA);
    if (leaks.length) fail(`Project-zone files changed by the update:\n  - ${leaks.join('\n  - ')}`);
    const afterManifests = manifestTexts(root);
    for (const m of Object.keys(beforeManifests)) {
      const v = manifestVersionOnlyViolation(beforeManifests[m], afterManifests[m]);
      if (v) fail(`${m}: ${v}`);
    }
    console.log('OK: only allowed delta changed (both @press/* ranges + lockfile).');

    // 8-10. ENGINE-IN-HOST + BOOT + BEHAVIORAL leak, all via the green-render check.
    log('assert BOOT + BEHAVIORAL leak: none (rebuild, reseed, render @ vN+1)');
    assertGreen(root);

    log(`CONTRACT HELD${bootstrap ? ' (BOOTSTRAP harness-only run — no regression coverage yet)' : ''}`);
  } finally {
    // 11. Teardown.
    stopCms();
    restoreAdopter(root);
    stopRegistry(root);
  }
}

main().catch((e) => {
  console.error(e?.stack ?? String(e));
  process.exitCode = process.exitCode || 1;
});
```

- [ ] **Step 2: Add the `guard` npm script**

In root `package.json` `scripts`, add:

```jsonc
"guard": "node scripts/contract-guard.mjs",
```

- [ ] **Step 3: Run the guard in bootstrap mode (no tag exists yet)**

Confirm no engine tag exists, then run:

```bash
git tag -l 'engine-v*'   # expected: empty
node scripts/contract-guard.mjs
```

Expected (AC4 + AC1 harness): logs `BOOTSTRAP: no baseline tag, harness-only run`, publishes both packages at baseline + synthetic candidate, stages the adopter at the baseline, prints the GREEN baseline e2e PASS lines, runs the update, prints `OK: only allowed delta changed …`, the second GREEN render, and finally `CONTRACT HELD (BOOTSTRAP harness-only run — no regression coverage yet)`. Exit 0.

If it fails at the GREEN baseline render against the **Verdaccio tarball** of `@press/web`, this is the Task 1 integration surface (Next transpiling `node_modules/@press/web/src`). Debug with `superpowers:systematic-debugging`: check `/tmp/guard-cms.log`, confirm `@press/web@<v>` resolved from `localhost:4873` in `pnpm-lock.yaml`, and that `generated.ts` is present in `node_modules/@press/web/src/types/`.

- [ ] **Step 4: Confirm the working tree is restored**

Run:

```bash
git status --porcelain
```

Expected: clean (the `finally` restored both manifests + lockfile; `apps/web/package.json` is back to `"@press/web": "workspace:*"`).

- [ ] **Step 5: Commit**

```bash
git add scripts/contract-guard.mjs package.json
git commit -m "$(cat <<'EOF'
feat(guard): contract-guard orchestrator + honest bootstrap run

Composes registry/baseline/leak-snapshot/adopter-cycle into the §4.2 cycle;
bootstrap (no tag) runs harness-only and says so (Spec 4 AC1 harness, AC4).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Cut the first engine release tag (DoD — gives the guard a real baseline)

**Goal:** spec §8 DoD and §4.3 require a real release tag so subsequent runs diff against an actual prior version instead of bootstrapping. This must land **before** the negative test (Task 7), which needs a good baseline distinct from the regressed candidate.

**Files:** none (a git tag).

- [ ] **Step 1: Tag the current engine release at HEAD**

The engine packages are at `@press/cms@0.3.2` / `@press/web@0.1.0`. Tag the release commit:

```bash
git tag -a engine-v0.3.2 -m "press engine release: @press/cms@0.3.2 + @press/web@0.1.0 (Spec 4 baseline)"
git tag -l 'engine-v*'
```

Expected: `engine-v0.3.2` listed.

> The unified `engine-v0.3.2` tag marks the release commit; the guard reads each package's own version from the tagged tree (§4.3), so the differing per-package versions (cms 0.3.2 / web 0.1.0) are handled automatically.

- [ ] **Step 2: Re-run the guard — now with a real baseline (tag == HEAD fast path)**

```bash
node scripts/contract-guard.mjs
```

Expected: logs `baseline tag engine-v0.3.2 == HEAD; building baseline from HEAD` (no `BOOTSTRAP` line), candidate published as `0.3.2-contract.<sha>` / `0.1.0-contract.<sha>`, both GREEN renders pass, `CONTRACT HELD` **without** the bootstrap qualifier. Exit 0. This is AC1 in its real (non-bootstrap) form: two versions, real semver resolution, render-deep.

- [ ] **Step 3: Confirm clean tree**

Run: `git status --porcelain` → clean.

> Tags are pushed in Task 9's branch-finish, not here. No commit in this task (a tag is not a commit); proceed.

---

## Task 7: The negative test — prove the guard catches a behavioral leak (AC2)

**Goal:** spec §7 AC2 — a deliberately regressed `@press/web` candidate that drops the custom-block render path must make the guard **fail loud at the behavioral-leak step** with a non-zero exit, while file and boot checks pass. This proves the guard catches what Spec 0's disk/boot checks could not, on the front-end surface Spec 1 named.

**Files:**
- Temporarily modify: `packages/press-web/src/block-renderer.tsx` (the regression — reverted at the end)

- [ ] **Step 1: Introduce the regression in the engine candidate (HEAD working tree)**

The candidate builds from the HEAD working tree, so an **uncommitted** edit becomes the regressed `vN+1` while the tagged baseline (`engine-v0.3.2`) stays good. In `packages/press-web/src/block-renderer.tsx`, drop adopter custom blocks from the registry — change:

```javascript
  const registry = { ...referenceBlocks, ...components };
```

to:

```javascript
  // REGRESSION (AC2 negative test): adopter `components` dropped — custom.callout
  // will no longer render. Reference blocks still render, so disk + boot pass and
  // ONLY the seeded e2e behavioral check should catch this.
  const registry = { ...referenceBlocks };
```

- [ ] **Step 2: Run the guard and confirm it fails LOUD at the behavioral step**

```bash
node scripts/contract-guard.mjs; echo "EXIT=$?"
```

Expected: the file-leak assert passes (`OK: only allowed delta changed …`), the baseline GREEN render passes (baseline is the good tag), but the **post-update** GREEN render fails — `e2e-check.mjs` prints `E2E FAIL: callout message missing from HTML`, the guard surfaces a behavioral-leak failure, and `EXIT=1`.

> If instead it fails at the *baseline* render, the regression leaked into the baseline build — confirm `engine-v0.3.2` is the baseline (not bootstrap) and that the worktree/fast-path built the baseline from the tagged (clean) tree, not the dirty working tree.

- [ ] **Step 3: Revert the regression**

```bash
git checkout -- packages/press-web/src/block-renderer.tsx
git status --porcelain   # clean
```

- [ ] **Step 4: Re-run the guard to confirm GREEN is restored**

```bash
node scripts/contract-guard.mjs; echo "EXIT=$?"
```

Expected: `CONTRACT HELD`, `EXIT=0`. AC2 is proven: the same guard goes red on the regression and green without it.

> No commit — this task leaves no tracked change. The procedure is documented in the README (Task 9) so AC2 is reproducible.

---

## Task 8: CI workflow — gated, required check, no external registry (AC3)

**Goal:** spec §6 / §7 AC3 — `.github/workflows/contract-guard.yml` runs the guard on `packages/**` PRs + `workflow_dispatch`, on Linux/Node 20/pnpm 10, with full history + tags (for the baseline build), uploads logs on failure, and is wired as a required status check on `main` (red guard blocks merge). A `docs/`-only PR does not trigger it.

**Files:**
- Create: `.github/workflows/contract-guard.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/contract-guard.yml`:

```yaml
name: contract-guard

# The contract can only leak when the ENGINE changes. PRs touching only docs/ or
# apps/** (the adopter layer) cannot break the promise and don't pay the cost.
on:
  pull_request:
    paths:
      - 'packages/**'
  workflow_dispatch: {}

# One run per ref; a new push cancels the in-flight guard.
concurrency:
  group: contract-guard-${{ github.ref }}
  cancel-in-progress: true

jobs:
  guard:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout (full history + tags for the baseline build)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0          # baseline tag + worktree need history
          fetch-tags: true

      - name: Setup pnpm
        uses: pnpm/action-setup@v4   # version read from package.json packageManager

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Run the contract guard
        run: node scripts/contract-guard.mjs

      - name: Upload guard logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: contract-guard-logs
          path: |
            /tmp/guard-cms.log
            /tmp/verdaccio.log
          if-no-files-found: ignore
```

> **Required check:** after this workflow runs once on a PR, add `guard` as a required status check on `main` in the repo's branch-protection settings (GitHub UI / `gh api`). That wiring is a repo setting, not a file; note it in the PR description so the maintainer enables it (spec §6 "required status check"). It cannot be enforced from the workflow file alone.

- [ ] **Step 2: Validate the workflow YAML locally**

Run:

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = readFileSync('.github/workflows/contract-guard.yml','utf8');
if (!t.includes('paths:') || !t.includes('packages/**')) throw new Error('paths filter missing');
if (!t.includes('workflow_dispatch')) throw new Error('manual dispatch missing');
if (!t.includes('fetch-depth: 0')) throw new Error('full history missing');
console.log('workflow OK: gated to packages/**, manual dispatch, full history');
"
```

Expected: `workflow OK: …`. (If `actionlint` is available, `actionlint .github/workflows/contract-guard.yml` is a stronger check — optional.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/contract-guard.yml
git commit -m "$(cat <<'EOF'
ci(guard): run contract-guard on packages/** PRs + manual dispatch

Gated trigger, Node 20 / pnpm 10, full history+tags for the baseline build,
ephemeral Verdaccio in-job (no external registry); logs uploaded on failure.
Required-check wiring on main is a repo setting (noted in the PR). (Spec 4 §6, AC3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: DoD — fold `contract-check`, document the update path + leak taxonomy, verify

**Goal:** spec §8 DoD — retire `contract-check.mjs`'s CMS-only logic into the generalized guard (no divergent copy), document the update path (`pnpm update @press/*` + boot), the guard command, and the three leak classes (AC5 docs), then run the full acceptance once more.

**Files:**
- Delete: `scripts/contract-check.mjs`
- Modify: `package.json` (drop `contract:check`, keep `guard`)
- Modify: `README.md` (Spec 4 section)
- Modify: `docs/superpowers/specs/2026-06-11-press-update-contract-guard-design.md` (Results)

- [ ] **Step 1: Remove the superseded CMS-only contract-check and its npm script**

The generalized guard now owns the allowed-delta definition for **both** packages; leaving the CMS-only `contract-check.mjs` is the §10 "two sources of truth" risk. Remove it:

```bash
git rm scripts/contract-check.mjs
```

In root `package.json` `scripts`, delete the line:

```jsonc
"contract:check": "node scripts/contract-check.mjs",
```

(Keep `"guard": "node scripts/contract-guard.mjs"`.)

- [ ] **Step 2: Document the update path, guard, and leak taxonomy in the README**

Append to `README.md`:

```markdown
## Update path + contract guard (Spec 4)

The non-breakage promise (PRD Q2) is enforced continuously. An adopter updates the
engine with the **minimal form** — no special command:

```bash
pnpm update @press/cms @press/web    # bump both engine packages
pnpm --filter cms build && pnpm --filter cms start   # rebuild + boot
```

The **contract guard** proves that update never breaks the Project zone. It runs a
real vN → vN+1 cycle for **both** engine packages against an ephemeral Verdaccio,
then fails on any of three leak classes:

| Class | What it means | Caught by |
| --- | --- | --- |
| **File leak** | A Project-zone file changed on disk after the update | content-hash of `apps/**` + `assert-no-engine-in-host.mjs` |
| **Boot leak** | The host builds but no longer boots | `/_health` 204 boot smoke |
| **Behavioral leak** | Boots, disk clean, but the adopter's custom block or whitelabel `<head>` stops rendering | seeded e2e render (`seed-e2e.mjs` + `e2e-check.mjs`) |

Run it locally (starts/stops its own Verdaccio):

```bash
node scripts/contract-guard.mjs        # or: pnpm guard
```

- **Baseline** is built from the last `engine-v*` release tag; **candidate** is HEAD
  (published as `X.Y.Z-contract.<sha>` when the version wasn't bumped, so the code
  delta is always real). With no tag yet it runs a logged BOOTSTRAP (harness-only).
- **CI:** `.github/workflows/contract-guard.yml` runs it on `packages/**` PRs and
  manual dispatch; it is a required check on `main`, so a leak blocks merge.

### Reproduce the negative test (the guard actually catches a leak)

In `packages/press-web/src/block-renderer.tsx`, change `{ ...referenceBlocks, ...components }`
to `{ ...referenceBlocks }` (drops adopter custom blocks), then `node scripts/contract-guard.mjs`:
the file + boot checks pass but the post-update render fails with
`E2E FAIL: callout message missing from HTML` and a non-zero exit. Revert to restore green.
```

- [ ] **Step 3: Record results in the spec**

Append a Results section to `docs/superpowers/specs/2026-06-11-press-update-contract-guard-design.md`:

```markdown
## 11. Results

- **Outcome:** PASS. `scripts/contract-guard.mjs` runs a real both-package,
  render-deep update cycle against ephemeral Verdaccio.
- **AC1 (real cycle green):** both `@press/cms` (0.3.2 → 0.3.2-contract.<sha>) and
  `@press/web` (0.1.0 → 0.1.0-contract.<sha>) published; `pnpm update @press/*`;
  no file leak, host boots, seeded page renders `press.hero` + `custom.callout` +
  whitelabel `<head>`. Exit 0.
- **AC2 (catches a leak):** dropping the custom-block render path in `@press/web`
  fails the guard at the behavioral step (`callout message missing`), non-zero exit,
  while disk + boot pass.
- **AC3 (CI gated/required):** `.github/workflows/contract-guard.yml` on
  `packages/**` PRs + dispatch; Verdaccio in-job; required check on `main`.
- **AC4 (bootstrap honest):** first run pre-tag logged `BOOTSTRAP …` and exited 0.
- **AC5 (local repro):** `node scripts/contract-guard.mjs` reproduces 1–2 from clean.
- **First release tag:** `engine-v0.3.2`.
- **contract-check.mjs:** folded into the generalized guard and removed.
- **Date:** 2026-06-12.
```

- [ ] **Step 4: Final full-acceptance verification from a clean tree**

Run:

```bash
git status --porcelain                 # clean
pnpm --filter @press/web exec vitest run ../../scripts/lib/leak-snapshot.test.mjs   # unit lib green
node scripts/contract-guard.mjs; echo "EXIT=$?"   # AC1 real baseline: CONTRACT HELD, EXIT=0
```

Expected: lib tests green; guard prints `CONTRACT HELD` (no bootstrap qualifier) and `EXIT=0`. This is the evidence backing the §8 Definition of Done.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs(guard): document update path + leak taxonomy; fold in contract-check; record results

Removes the CMS-only contract-check.mjs (single source of the allowed delta now);
README + spec Results cover AC1–AC5 and the negative-test repro. (Spec 4 §8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Finish the branch**

Use `superpowers:finishing-a-development-branch` to decide merge/PR. Push the `engine-v0.3.2` tag with the branch (`git push origin engine-v0.3.2`) and note in the PR that `guard` must be enabled as a required status check on `main`.

---

## Self-review notes (run by the author)

- **Spec coverage:** every §-item maps to a task (table at top). The two genuine integration unknowns the spec assumed solved — (a) `@press/web` is not currently publishable (no `files`/`.npmignore`; generated types gitignored) and (b) `apps/web` consumes it via `workspace:*` — are surfaced and resolved in **Task 1** before the cycle depends on them, with a concrete `npm pack --dry-run` gate.
- **Ordering correctness:** AC2 (Task 7) needs a real baseline distinct from the candidate, so the first release tag (Task 6) lands *before* it; in bootstrap a regressed HEAD would fail the baseline render instead, proving nothing. This dependency is made explicit.
- **Type/name consistency:** module APIs are fixed and reused verbatim across tasks — `hashZone`/`diffZones`/`findFileLeaks`/`manifestVersionOnlyViolation` (leak-snapshot); `buildAndPublish`/`readPackageVersion`/`publishedVersions`/`startRegistry`/`stopRegistry` (registry); `lastEngineTag`/`candidateVersion`/`withWorktree`/`tagCommit`/`headCommit`/`shortSha` (baseline); `pinAdopter`/`assertGreen`/`runUpdate`/`manifestTexts`/`restoreAdopter`/`startCms`/`stopCms` (adopter-cycle). The orchestrator in Task 5 imports exactly these names. Allowed delta is one set — `{apps/cms/package.json, apps/web/package.json, pnpm-lock.yaml}` — defined once.
- **Known soft spots (flagged honestly, not hidden):**
  1. **Next transpiling `@press/web` from a Verdaccio tarball.** Spec 1/2 ran `@press/web` as a workspace symlink; the guard runs it as a published tarball under `node_modules/@press/web/src/*.ts`. `transpilePackages: ['@press/web']` should cover node_modules too, but this is the first time it's exercised — the Task 5 Step 3 GREEN-baseline render is the concrete gate, with a debug note.
  2. **`pnpm update` to a synthetic prerelease range.** If `update` refuses the prerelease, the orchestrator falls back to `add` (same manifest+lockfile effect). Both paths are written.
  3. **Baseline build cost (worktree + install).** Heavy when the tag ≠ HEAD; mitigated by the `tagCommit === headCommit` fast path for the common "tag the current release" case, and gated to `packages/**` in CI (spec §10 runtime risk).
  4. **Required-check wiring** is a GitHub repo setting, not enforceable from the workflow file — called out in Task 8 and the PR description.
