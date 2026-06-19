# First npm publish (`@ogs-tech/press-*`) + Release Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the engine scope `@press/* → @ogs-tech/press-*`, adopt Changesets + a GitHub Actions release pipeline (OIDC + provenance), and ship the first public npm publish of `@ogs-tech/press-{cli,cms,web}`.

**Architecture:** A one-pass mechanical rename guarded by the existing test suite, followed by Changesets for versioning and two GitHub Actions workflows (`ci.yml` gate, `release.yml` bump+publish). The first publish is a one-time manual local `npm publish` to create the packages, after which trusted-publisher settings enable token-free OIDC publishing forever after.

**Tech Stack:** pnpm 10 workspace, turbo, TypeScript, Strapi 5 + Next 15 engine, Changesets (`@changesets/cli` + `@changesets/changelog-github`), GitHub Actions, npm OIDC trusted publishing.

**Source spec:** `docs/superpowers/specs/2026-06-18-press-npm-publish-pipeline-design.md`

## Global Constraints

These apply to every task. Exact values copied from the spec.

- **npm scope:** `@ogs-tech/press-*` (org `ogs-tech` owned). The four packages rename to `@ogs-tech/press-cli`, `@ogs-tech/press-cms`, `@ogs-tech/press-web`, `@ogs-tech/press-shared`.
- **Unchanged identifiers:** the `press` bin name and the Strapi plugin id `press-cms` do **not** change (independent of the npm package name). Internal TS identifiers `pressCli/pressWeb/pressCms` stay.
- **Starting versions (independent):** cli `0.1.0`, cms `0.3.2`, web `0.3.1`. Do not change them in this work.
- **`@ogs-tech/press-shared` stays `private: true`** — dev-only `import type` contract, never published.
- **`@ogs-tech/press-web` keeps `.npmignore`; do NOT add a `files` array to web** (under a `files` allowlist npm stops honoring `.npmignore`).
- **`@press/*` scaffold pins are EXACT** (no caret on 0.x) — derived by `gen:versions`, never hand-edited.
- **Node pinned to 20** (`engines: ">=20.0.0 <21.0.0"`); CI uses node 20.
- **Auth: OIDC trusted publishing + `--provenance`. No `NPM_TOKEN` is ever stored.**
- **GitHub repo:** `ogs-tech/press-cli`. Changesets `baseBranch` is `main`.
- **Docs are historical:** dated files under `docs/superpowers/**` keep their old `@press/*` references. Only `README.md` is updated.
- **`apps/playground/**` is never hand-edited** — it is regenerated via `pnpm play:create`.

## File Structure

| Path | Responsibility | Touched by |
|---|---|---|
| `packages/{cli,cms,web,shared}/package.json`, root `package.json`, `press.config.ts` | Manifests + cross-deps + root config import | Task 1, 2, 3 |
| `packages/cli/{bin,scripts,src,templates}/**` | CLI logic, scaffold, codegen, consumer templates | Task 1 |
| `packages/web/{src,templates}/**`, `packages/cms/server/**`, `packages/shared/src/**` | Engine-internal imports + host templates | Task 1 |
| `packages/cli/src/create/versions.generated.ts` | Regenerated pins (only the header comment changes) | Task 1 |
| `scripts/{create,upgrade}-playground.ts` | Dogfood tooling (`--filter`/dep keys) | Task 1 |
| `README.md` | Consumer docs + install note | Task 1 |
| `apps/playground/**` | Dogfood — regenerated, never hand-edited | Task 1 (regen only) |
| `packages/{cli,cms,web}/package.json` | `repository` field for provenance | Task 2 |
| `.changeset/config.json` | Changesets config | Task 3 (create) |
| root `package.json` scripts + devDeps | `version-packages` / `release` scripts, changesets deps | Task 3 |
| `.github/workflows/ci.yml` | PR/push gate | Task 4 (create) |
| `.github/workflows/release.yml` | Bump + publish via OIDC | Task 5 (create) |
| (manual, no repo file) | Bootstrap publish + trusted-publisher registration | Task 6 |

---

### Task 1: Scope rename `@press/* → @ogs-tech/press-*`

A single mechanical substitution over a curated file set, then regenerate the three derived artifacts (pins, dogfood, lockfile) and update the README install note. There is no red→green TDD phase here: the substitution rewrites the test files and the source in the same pass, so the existing suite (`scaffold.test.ts`, `compute-versions.test.ts`, `publish-readiness.test.ts`) is the **oracle that must stay green** — it already encodes the new package names after the sweep.

**Files:**
- Modify (via `sed`): `README.md`, `package.json`, `press.config.ts`, `packages/cli/{bin,scripts,src,templates}/**`, `packages/cms/package.json`, `packages/cms/server/**`, `packages/web/package.json`, `packages/web/{src,templates}/**`, `packages/shared/package.json`, `packages/shared/src/**`, `scripts/**`
- Regenerate (do not hand-edit): `packages/cli/src/create/versions.generated.ts` (header comment only), `apps/playground/**`, `pnpm-lock.yaml`
- Modify (content, not just rename): `README.md` install note
- Oracle (must pass, unchanged structure): `packages/cli/src/create/scaffold.test.ts`, `packages/cli/src/create/compute-versions.test.ts`, `packages/cli/src/publish/publish-readiness.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: packages `@ogs-tech/press-cli` (bin `press`), `@ogs-tech/press-cms` (plugin id `press-cms`), `@ogs-tech/press-web`, `@ogs-tech/press-shared` (private). `PUBLISHABLE_PACKAGES = ['@ogs-tech/press-cli', '@ogs-tech/press-web', '@ogs-tech/press-cms']`. Scaffold writes dependency keys `@ogs-tech/press-cli`/`@ogs-tech/press-web`/`@ogs-tech/press-cms`. Filter target `@ogs-tech/press-cli` for `gen:versions`.

- [ ] **Step 1: Run the mechanical rename**

The curated root set excludes `docs/**`, `apps/playground/**`, `node_modules`, every `dist/`, and `pnpm-lock.yaml`. None of the listed sub-paths contain a `dist/` directory, so no path filter is needed. BSD/macOS `sed` requires the `-i ''` form.

```bash
grep -rl "@press/" \
  README.md package.json press.config.ts \
  packages/cli/bin packages/cli/scripts packages/cli/src packages/cli/templates \
  packages/cms/package.json packages/cms/server \
  packages/web/package.json packages/web/src packages/web/templates \
  packages/shared/package.json packages/shared/src \
  scripts \
  | xargs sed -i '' 's#@press/#@ogs-tech/press-#g'
```

This rewrites: the four `name` fields; the `@press/shared` devDeps in cms/web; the root `@press/cms`+`@press/web` devDeps; every `import`/`require.resolve` (`@press/web`, `@press/shared`); `transpilePackages: ['@press/web']`; `rewireToWorkspace([...])` keys in `create-playground.ts`; the `--filter @press/cli` strings; `PUBLISHABLE_PACKAGES`; and all comments/error strings.

- [ ] **Step 2: Verify no `@press/` remains in the renamed set**

```bash
grep -rn "@press/" \
  README.md package.json press.config.ts \
  packages/cli/bin packages/cli/scripts packages/cli/src packages/cli/templates \
  packages/cms/package.json packages/cms/server \
  packages/web/package.json packages/web/src packages/web/templates \
  packages/shared/package.json packages/shared/src \
  scripts ; echo "exit=$?"
```

Expected: no output, `exit=1` (grep found nothing). `apps/playground/**` and `docs/**` still contain `@press/` — that is intentional (playground is regenerated in Step 4; docs are historical).

- [ ] **Step 3: Update the README install note (content change beyond the rename)**

The sed pass renamed the strings; this step replaces the now-stale "not published yet" blockquote (currently `README.md:23-26`) with a published-install note. Apply this exact edit:

Old:
```markdown
> **Not published to a registry yet.** `@ogs-tech/press-*` are developed in this monorepo
> and consumed locally via `workspace:*`. Publishing to npm is planned; until
> then, `press create` run outside the repo cannot install `@ogs-tech/press-*` — work
> inside the repo and use the [playground](#repository-internals) to try press.
```

New:
```markdown
> **Published on npm** under the [`@ogs-tech`](https://www.npmjs.com/org/ogs-tech) org.
> Scaffold a project anywhere with `npx @ogs-tech/press-cli create my-site`; the
> generated project pins `@ogs-tech/press-{cli,web,cms}` at the versions that
> produced it. Inside this monorepo the same packages are consumed via `workspace:*`
> for a fast dev loop (see [Repository internals](#repository-internals)).
```

- [ ] **Step 4: Regenerate the dogfood and the lockfile**

`pnpm play:create` (`scripts/create-playground.ts`) reads the prior cms Strapi uuid, scaffolds a fresh `apps/playground` from the renamed scaffold (writing `@ogs-tech/press-*` keys, rewired to `workspace:*` for cli/web/cms), then runs `pnpm install` as its final step — the first fully-consistent workspace resolution, which regenerates `pnpm-lock.yaml`. Running a root script via `pnpm run` does not validate every workspace member's graph, so the transiently-stale playground manifest does not block launch; the only graph resolution is the final consistent install.

```bash
pnpm play:create
```

Expected tail:
```
> pnpm install (links the new packages/* workspace members)
...
playground created. Run `pnpm play` to boot it.
```

- [ ] **Step 5: Build the whole tree**

```bash
pnpm build
```
Expected: turbo runs `build` for cli/cms (web/shared are echo no-ops) and finishes with `Tasks: N successful, N total` and no error.

- [ ] **Step 6: Run the guardrail — full test suite**

```bash
pnpm -r test
```
Expected: `scaffold.test.ts`, `compute-versions.test.ts`, and `publish-readiness.test.ts` all pass. In particular `scaffold.test.ts` now asserts `root.dependencies['@ogs-tech/press-cli']` and `publish-readiness.test.ts` asserts the `@ogs-tech/press-*` publishable set and that `@ogs-tech/press-shared` stays private. PASS with `0 failed`.

- [ ] **Step 7: Run the guardrail — pins are not stale**

```bash
pnpm --filter @ogs-tech/press-cli gen:versions --check
```
Expected: `versions.generated.ts is up to date.` (the sed pass rewrote both `compute-versions.ts`'s render comment and `versions.generated.ts`'s header to the same new string, so a fresh render matches byte-for-byte).

- [ ] **Step 8: Run the guardrail — dry-run publish**

```bash
pnpm pack:check
```
Expected: `pnpm -r --filter "./packages/*" publish --dry-run` reports a would-publish tarball for `@ogs-tech/press-cli`, `@ogs-tech/press-cms`, `@ogs-tech/press-web`, and **skips** `@ogs-tech/press-shared` (private). No `workspace:` spec appears in any published manifest. No error.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rename engine scope @press/* -> @ogs-tech/press-*"
```

---

### Task 2: Add `repository` field to the publishable manifests (provenance prerequisite)

npm's `--provenance` (a locked decision) requires each published `package.json` to carry a `repository` field that matches the building GitHub repo, or the first OIDC publish fails. None of the three publishable manifests have one. This task adds it. `@ogs-tech/press-shared` is private and is intentionally skipped.

**Files:**
- Modify: `packages/cli/package.json`, `packages/cms/package.json`, `packages/web/package.json`

**Interfaces:**
- Consumes: the renamed manifests from Task 1.
- Produces: a `repository` object (`type`, `url`, `directory`) on each of the three publishable manifests, all pointing at `github.com/ogs-tech/press-cli`.

- [ ] **Step 1: Add `repository` to `packages/cli/package.json`**

Old:
```json
  "publishConfig": { "access": "public" },
  "scripts": {
    "gen:versions": "tsx scripts/gen-versions.ts",
```
New:
```json
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ogs-tech/press-cli.git",
    "directory": "packages/cli"
  },
  "scripts": {
    "gen:versions": "tsx scripts/gen-versions.ts",
```

- [ ] **Step 2: Add `repository` to `packages/cms/package.json`**

Old:
```json
  "publishConfig": { "access": "public" },
  "exports": {
```
New:
```json
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ogs-tech/press-cli.git",
    "directory": "packages/cms"
  },
  "exports": {
```

- [ ] **Step 3: Add `repository` to `packages/web/package.json`**

Old:
```json
  "publishConfig": { "access": "public" },
  "exports": {
```
New:
```json
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ogs-tech/press-cli.git",
    "directory": "packages/web"
  },
  "exports": {
```

- [ ] **Step 4: Verify manifests are valid and still publish-ready**

```bash
node -e "for (const p of ['cli','cms','web']) { const m=require('./packages/'+p+'/package.json'); if(m.repository.directory!=='packages/'+p) throw new Error(p); } console.log('repository fields OK')"
pnpm pack:check
```
Expected: `repository fields OK`, then `pack:check` green (the dry-run reads each manifest; provenance is not exercised in a dry-run, but manifest validity is).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/package.json packages/cms/package.json packages/web/package.json
git commit -m "chore: add repository field to publishable manifests for npm provenance"
```

---

### Task 3: Adopt Changesets

Add the versioning engine and the two release scripts. `changeset version` only edits `package.json` versions — it does not rebuild — so the `version-packages` script chains `gen:versions` to keep the scaffold pins in lockstep, then `git add -A` so the Changesets action commits the regenerated pins.

**Files:**
- Modify: `package.json` (root — devDeps + `scripts`)
- Create: `.changeset/config.json`
- Create (by `changeset init`, kept as-is): `.changeset/README.md`

**Interfaces:**
- Consumes: the renamed cli package name `@ogs-tech/press-cli` (Task 1) for the `version-packages` filter and the changelog `repo`.
- Produces: root scripts `version-packages` (= `changeset version && pnpm --filter @ogs-tech/press-cli gen:versions && git add -A`) and `release` (= `turbo run build && changeset publish`), consumed by `release.yml` (Task 5). Devit deps `@changesets/cli`, `@changesets/changelog-github`.

- [ ] **Step 1: Add Changesets as root devDependencies**

```bash
pnpm add -D -w @changesets/cli @changesets/changelog-github
```
Expected: `@changesets/cli` (~`^2.27`) and `@changesets/changelog-github` (~`^0.5`) appear in root `package.json` `devDependencies`; lockfile updated.

- [ ] **Step 2: Initialize Changesets**

```bash
pnpm changeset init
```
Expected: creates `.changeset/config.json` and `.changeset/README.md`. Console: `The .changeset folder has been created.`

- [ ] **Step 3: Overwrite `.changeset/config.json` with the project config**

Replace the generated file with exactly:
```json
{
  "$schema": "https://unpkg.com/@changesets/config/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "ogs-tech/press-cli" }],
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```
`private: true` packages (`@ogs-tech/press-shared`, `apps/playground`) are skipped automatically, so they are not listed in `ignore`. `commit: false` leaves committing to the Changesets GitHub action.

- [ ] **Step 4: Add the `version-packages` and `release` scripts to root `package.json`**

Old:
```json
  "scripts": {
    "build": "turbo run build",
    "play": "turbo run dev --filter playground",
    "play:create": "tsx scripts/create-playground.ts",
    "play:upgrade": "tsx scripts/upgrade-playground.ts",
    "pack:check": "pnpm build && pnpm -r --filter \"./packages/*\" publish --dry-run --no-git-checks"
  },
```
New:
```json
  "scripts": {
    "build": "turbo run build",
    "play": "turbo run dev --filter playground",
    "play:create": "tsx scripts/create-playground.ts",
    "play:upgrade": "tsx scripts/upgrade-playground.ts",
    "pack:check": "pnpm build && pnpm -r --filter \"./packages/*\" publish --dry-run --no-git-checks",
    "version-packages": "changeset version && pnpm --filter @ogs-tech/press-cli gen:versions && git add -A",
    "release": "turbo run build && changeset publish"
  },
```
Note: `release` keeps no `--provenance` flag — provenance is enabled by an env var only in CI (Task 5), so the one-time local bootstrap publish (Task 6) does not attempt provenance.

- [ ] **Step 5: Verify the config is valid and the CLI runs**

```bash
node -e "JSON.parse(require('fs').readFileSync('.changeset/config.json','utf8')); console.log('config.json valid')"
pnpm changeset status
```
Expected: `config.json valid`, then `changeset status` exits 0 reporting no changesets present (there are none yet) — confirming the CLI and config load.

- [ ] **Step 6: Commit**

```bash
git add .changeset package.json pnpm-lock.yaml
git commit -m "build: adopt Changesets for versioning + release scripts"
```

---

### Task 4: CI gate workflow (`.github/workflows/ci.yml`)

The pre-merge gate: build, typecheck, test, pin-drift check, dry-run publish. Runs on every PR and on push to `main`.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts `build`/`pack:check`, per-package `test`/`typecheck`, and the `@ogs-tech/press-cli gen:versions --check` filter (Tasks 1, 3).
- Produces: a workflow named `CI` with a single `verify` job.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - run: pnpm -r --if-present typecheck

      - run: pnpm -r test

      - run: pnpm --filter @ogs-tech/press-cli gen:versions --check

      - run: pnpm pack:check
```
`--if-present` on `typecheck` is defensive: `@ogs-tech/press-cms` has no `typecheck` script (it has `test:ts:back`), and this skips it without failing the job. The pnpm version is read from `packageManager` in root `package.json`, so `pnpm/action-setup@v4` needs no explicit version.

- [ ] **Step 2: Verify the workflow is valid YAML**

```bash
npx -y js-yaml .github/workflows/ci.yml > /dev/null && echo "ci.yml parses"
```
Expected: `ci.yml parses` (js-yaml exits non-zero on malformed YAML). Note: GitHub Actions semantics cannot be fully exercised locally; the real run happens on the first push.

- [ ] **Step 3: Self-review the gate against the spec**

Confirm by reading the file: 6 verify steps (`build`, `typecheck`, `test`, `gen:versions --check`, `pack:check`) on node 20 with pnpm cache, frozen lockfile. No publish step (publishing lives in `release.yml`). No checklist failures — fix inline if any.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI gate (build, typecheck, test, pin-drift, pack:check)"
```

---

### Task 5: Release workflow (`.github/workflows/release.yml`)

On push to `main`, the Changesets action either opens/updates the **"Version Packages" PR** (when changesets are pending) or, when versions are already bumped and not yet on npm, publishes them via OIDC + provenance and pushes git tags. No `NPM_TOKEN`.

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: root scripts `version-packages` and `release` (Task 3); npm OIDC trusted-publisher config registered manually in Task 6.
- Produces: a workflow named `Release` with a single `release` job holding `id-token: write`.

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write        # commit version bumps / push tags
  pull-requests: write   # open the "Version Packages" PR
  id-token: write        # npm OIDC trusted publishing

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Ensure npm >= 11.5 for OIDC trusted publishing
        run: npm i -g npm@latest

      - run: pnpm install --frozen-lockfile

      - uses: changesets/action@v1
        with:
          version: pnpm run version-packages
          publish: pnpm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```
`NPM_CONFIG_PROVENANCE: true` enables provenance for the `changeset publish` step without a `--provenance` flag (so the local bootstrap publish in Task 6 is unaffected). With `id-token: write`, npm ≥ 11.5, and a registered trusted publisher, npm mints a short-lived credential — no stored token. `GITHUB_TOKEN` lets the action open the PR and lets `@changesets/changelog-github` enrich the changelog.

- [ ] **Step 2: Verify the workflow is valid YAML**

```bash
npx -y js-yaml .github/workflows/release.yml > /dev/null && echo "release.yml parses"
```
Expected: `release.yml parses`.

- [ ] **Step 3: Self-review against the spec**

Confirm: `permissions` has all three (`contents: write`, `pull-requests: write`, `id-token: write`); `registry-url` is set; `npm i -g npm@latest` precedes install; the action's `version` input is `pnpm run version-packages` and `publish` is `pnpm run release`. No checklist failures — fix inline if any.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release pipeline (Changesets + OIDC provenance publish)"
```

---

### Task 6: Bootstrap — first manual publish + trusted-publisher registration ⚠️ MANUAL / IRREVERSIBLE

> **This task is executed by a human, not the agent.** It requires `npm login` with a verified-email + 2FA account, performs a real (irreversible) publish to the public registry, and configures settings on npmjs.com that have no repo representation. Do **not** automate it. Run only after Tasks 1–5 are merged and CI is green on `main`. npm trusted publishing can only be configured *after* a package exists, which is why the very first publish is a one-time local `npm publish`.

**Files:** none (registry + npmjs.com settings; no repo changes).

**Interfaces:**
- Consumes: green CI, built `dist/`, the registered package names from Task 1, and `release.yml` (Task 5) as the workflow to authorize.
- Produces: `@ogs-tech/press-cli@0.1.0`, `@ogs-tech/press-cms@0.3.2`, `@ogs-tech/press-web@0.3.1` live on npm; a trusted-publisher binding per package to `ogs-tech/press-cli` → `release.yml`.

- [ ] **Step 1: Log in to npm** (account has verified email + 2FA)
```bash
npm login
```

- [ ] **Step 2: Final dry-run sanity**
```bash
pnpm build && pnpm pack:check
```
Expected: green; would-publish tarballs for the three public packages; `@ogs-tech/press-shared` skipped (private).

- [ ] **Step 3: First manual publish (creates the three packages at current versions)**
```bash
pnpm -r --filter "./packages/*" publish --access public --no-git-checks
```
This local run has no provenance — acceptable for the one-time bootstrap. `@ogs-tech/press-shared` is skipped automatically (private).

- [ ] **Step 4: Register the trusted publisher for each package**

For each of `@ogs-tech/press-cli`, `@ogs-tech/press-cms`, `@ogs-tech/press-web` on npmjs.com:
**Settings → Trusted Publisher → GitHub Actions** → repository `ogs-tech/press-cli`, workflow `release.yml`.

- [ ] **Step 5: Post-publish smoke test**
```bash
npm view @ogs-tech/press-cli version          # resolves to 0.1.0
cd "$(mktemp -d)" && npx @ogs-tech/press-cli@latest create tmp-app
# the scaffolded tmp-app/package.json pins @ogs-tech/press-{cli,web} and
# tmp-app/packages/cms/package.json pins @ogs-tech/press-cms at the published versions
```
Expected: `0.1.0`; `create` scaffolds `tmp-app` whose manifests pin the published `@ogs-tech/press-*` versions (EXACT, no caret).

- [ ] **Step 6: Confirm the pipeline going forward**

From now on, every release flows through `release.yml`: feature PR → `pnpm changeset` → merge → action opens the "Version Packages" PR → merging it bumps versions + regenerates pins → the next run publishes via OIDC + provenance. After the first OIDC release, verify the **"Published via GitHub Actions" provenance badge** on each package page.

---

## Author loop (reference, post-bootstrap)

For each engine change after this plan ships:
1. Make the change on a feature branch.
2. `pnpm changeset` → pick the semver bump per affected package, write the intent.
3. Merge to `main`. The release action opens/updates the "Version Packages" PR.
4. Merge the "Version Packages" PR → versions bump, pins regenerate, packages publish.

---

## Self-Review (completed during authoring)

**Spec coverage:**
- §3 Scope rename → Task 1 (mechanical sweep + regenerations + README).
- §4 Changesets (config, `version-packages` pin hook, `release`) → Task 3.
- §5.1 `ci.yml` → Task 4. §5.2 `release.yml` (OIDC, provenance, npm upgrade, changesets action) → Task 5.
- §6 Bootstrap (login, dry-run, manual publish, trusted publisher) → Task 6.
- §7 Verification → CI steps (Task 4) + post-publish smoke test (Task 6 Step 5).
- §8 Risks: stale pins → Task 3 `version-packages` + Task 1/4 `gen:versions --check`; `workspace:` leak → `pack:check` (Task 1/2/Task 4); OIDC-before-package → Task 6; old npm → Task 5 `npm i -g npm@latest`; rename regressions → Task 1 tests + `play:create`; org billing → no action (free public).
- **Gap closed:** §5/§2 lock `--provenance`, which npm requires a `repository` field to honor — absent from all manifests. Added as Task 2 (not in the spec text).

**Placeholder scan:** none — every code/YAML/JSON step shows full content; every run step shows the command and expected output.

**Type/name consistency:** `@ogs-tech/press-cli` is used identically in the `gen:versions` filter (Tasks 1, 3, 4), the changelog `repo` (`ogs-tech/press-cli`, Task 3), and `version-packages` (Task 3). `PUBLISHABLE_PACKAGES` and scaffold dep keys all carry the `@ogs-tech/press-` prefix. The bin (`press`) and plugin id (`press-cms`) are explicitly unchanged.
