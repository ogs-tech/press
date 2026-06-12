# press — Strapi-as-dependency spike

Monorepo proving that **Strapi 5 can ship as a versioned, updatable dependency**
(`@press/cms`, the engine) consumed by a thin owned host (`apps/cms`), such that
`pnpm update @press/cms` upgrades the engine — content-types **and** Dynamic-Zone
blocks — **without leaking into the adopter's Project zone**.

Full design and results: `docs/superpowers/specs/2026-06-10-strapi-as-dependency-spike-design.md` (§13 Results).

**Outcome: PASS on Path A.** The engine ships reference blocks from `node_modules`
by injecting them into `strapi.get('components')` at its plugin `register`
lifecycle, and a `0.1.0 → 0.2.0` engine update touches only the dependency version
line + lockfile.

## Layout

- `packages/press-cms` — the **engine** (a Strapi plugin), published to a local
  Verdaccio registry. Ships a `page` content-type and injects the `press.hero`
  reference block + admits adopter `custom.*` blocks at register time.
- `apps/cms` — the **thin host** (adopter-owned, "Project zone"). Extension points:
  - `config/plugins.ts` — enables the engine (`{ "press-cms": { enabled: true } }`).
  - `src/components/custom/` — adopter custom blocks (e.g. `callout.json`).
  - `press.config.ts` — whitelabel placeholder.
- `scripts/` — `registry.sh` (Verdaccio helper), `contract-guard.mjs` (the standing
  Spec 4 contract guard), `assert-no-engine-in-host.mjs` (host-thinness invariant).

## Key mechanics (learned during the spike)

- **Plugin load = Strapi auto-discovery, not `resolve:`.** The host lists
  `@press/cms` in `dependencies`; Strapi finds it because the package ships
  `strapi.kind: "plugin"`. An explicit `resolve` would force a root export that
  makes `strapi-plugin build` delete the engine source — avoided.
- **Registry isolation.** `.npmrc` sets `link-workspace-packages=false` so the host
  consumes the published **tarball**, never the workspace symlink — otherwise the
  update proof would test a symlink instead of real semver (spec §7).
- **Verifying a Dynamic-Zone block needs the admin API**, not just a boot: Strapi
  5.48 defers DZ component validation to entry-creation time, so a 204 boot with a
  missing component is a false pass.

## Prerequisites

Node 20.x (`.nvmrc`), pnpm 10.x. `pnpm install` from the repo root.

## Run the spike

```bash
# 1. Install
pnpm install

# 2. Start the local registry (Verdaccio on :4873)
scripts/registry.sh start

# 3. Publish the engine (0.1.0 is the baseline; 0.2.0 is the update target)
pnpm --filter @press/cms build
( cd packages/press-cms && npm publish --registry http://localhost:4873 \
    --userconfig "$PWD/../../.npmrc" )

# 4. Build + run the host → http://localhost:1337/admin
pnpm --filter cms build
pnpm --filter cms start

# 5. Prove host-thinness (no engine code in the Project zone)
node scripts/assert-no-engine-in-host.mjs

# 6. Prove non-breakage of an engine update — the standing contract guard runs the
#    WHOLE vN -> vN+1 cycle for both engine packages and starts/stops its own
#    Verdaccio (see "Update path + contract guard" below). No manual publish needed:
node scripts/contract-guard.mjs       # or: pnpm guard  → "CONTRACT HELD"
```

## Notes

- The Verdaccio `_authToken` in `.npmrc` is localhost-only (harmless for this local
  spike); gitignore it before any shared/non-private repo.
- This skeleton (`packages/press-cms` + `apps/cms` + the contract scripts) is the
  foundation that the later press specs build on.

## Run the web engine + type-sync (Spec 1)

Prereqs: engine published (`@press/cms@0.3.2`) and the host built (see "Run the
spike"). `apps/web/.env` holds `CMS_URL=http://localhost:1337` (gitignored).

```bash
# 1. Seed a page (hero+image + custom callout) — CMS must be STOPPED for this:
( cd apps/cms && node ../../scripts/seed-e2e.mjs )

# 2. Start the CMS:
pnpm --filter cms start            # http://localhost:1337

# 3. Sync CMS schema → @press/web types (engine zone, gitignored):
pnpm --filter @press/web sync-types

# 4. Typecheck the contract (AC2):
pnpm --filter @press/web typecheck && pnpm --filter web typecheck

# 5. End-to-end render (AC1) — builds + starts apps/web on :3000, asserts both
#    blocks render server-side and the hero image src is absolute against CMS_URL:
node scripts/e2e-check.mjs
#    → "E2E PASS: hero + callout server-rendered; image src = http://localhost:1337/uploads/..."
```

Contract surfaces (all engine-owned): `GET /api/pages`, `GET /api/pages/:slug`
(published-only, DZ-populated), `GET /api/press/schema` (type-sync source of truth).

## Run the whitelabel config (Spec 2)

Identity + SEO live in one root `press.config.ts` (Project zone), consumed by
`@press/web` through `defineConfig` / `resolveConfig` / `buildMetadata`. Prereqs:
the CMS seeded + running on `:1337` and types synced (see "Run the web engine").

```bash
# 1. Unit contract for the engine helpers (defaults, template, absolute OG):
pnpm --filter @press/web test

# 2. Type the host — compiles the root press.config.ts through the alias (AC4 base):
pnpm --filter web typecheck

# 3. SEO-from-config render (AC1) + brand identity (AC2) on the real markup:
node scripts/e2e-check.mjs
#    → both PASS lines print (Spec 2 first, then the Spec 1 hero+callout check):
#      "E2E PASS (Spec 2): title/description/og/canonical/lang/favicon from config"
#      "E2E PASS: hero + callout server-rendered; image src = ..."

# 4. Default vs. override (AC3). The OVERRIDE is proven above (the rendered
#    <title> shows the custom 'E2E Home | Acme' template). The DEFAULT case is
#    proven by the unit test that omits seo.titleTemplate and asserts '%s':
pnpm --filter @press/web exec vitest run src/config/resolve-config.test.ts
```

### Type guard — loud fail (AC4)

A destructive change to the engine's config type must break at the adopter's
`press.config.ts`, not silently drift:

```bash
# Temporarily rename the engine field, e.g. in
# packages/press-web/src/config/types.ts rename PressConfig `seo.titleTemplate`
# to `seo.titleTpl`, then:
pnpm --filter web typecheck
#    → tsc FAILS pointing at press.config.ts:
#      "Object literal may only specify known properties, and 'titleTemplate'
#       does not exist in type ..." — the loud failure IS the pass condition.
# Revert the rename to restore green.
```

### Project-zone cleanliness (AC5)

The engine never writes `press.config.ts`. After a build/sync/render the root
file is untouched:

```bash
node scripts/e2e-check.mjs   # build + start + assert
git status --porcelain       # → no changes to press.config.ts (or the host): the
                             #   engine wrote nothing (build artifacts under .next/ are gitignored)
```

## Run the CLI (Spec 3)

The `press` CLI wraps the engine into the **create → dev → build → deploy** flow.
It writes only the adopter's Project zone; the Next host is engine-owned and
materialized to a gitignored `.press/web/` on every dev/build. Proven end-to-end
against the local Verdaccio registry by `scripts/cli-e2e.mjs`.

```bash
# 0. Registry up + engine present (see "Run the spike" for @press/cms@0.3.2):
scripts/registry.sh start

# 1. Unit contracts for the CLI (dispatch, materialize, scaffold, deploy prereqs):
pnpm --filter @press/cli test

# 2. Full acceptance gate — publishes @press/web + @press/cli, scaffolds a fresh
#    project, installs, then exercises create→dev→build→deploy (AC1–AC5):
node scripts/cli-e2e.mjs
#    → AC1 PASS … AC5 PASS … "CLI-E2E PASS: AC1–AC5 green."
```

### What `press create` writes (the ultra-thin Project zone)

```
my-site/
├─ press.config.ts          # whitelabel identity + SEO (Spec 2)
├─ blocks/custom/           # adopter custom blocks + the block map (index.ts)
├─ content/seed.mjs         # sample home page so first `press dev` renders
├─ cms/                     # the one visible host — a minimal Strapi app
├─ package.json             # scripts call `press` (dev/build/deploy)
├─ pnpm-workspace.yaml      # cms is a workspace member
├─ .npmrc / .gitignore / .nvmrc
└─ (NO app/ or next.config — the Next host is materialized to .press/web/)
```

`press dev` materializes `.press/web/`, seeds, boots cms (`:1337`), syncs types,
then boots web (`:3000`). `press build` materializes + builds both halves.
`press deploy` validates prereqs and emits the Spec 5 path (the guide ships in
Spec 5). `.press/` is engine territory — regenerated every run, never edited.

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

- **Baseline** is built from the last `engine-v*` release tag (in a clean throwaway
  worktree when the working tree is dirty); **candidate** is HEAD. Both are published
  under **content-addressed** prerelease labels — `X.Y.Z-base.<srcHash>` and
  `X.Y.Z-contract.<srcHash>`, where `<srcHash>` is a hash of the engine source. This
  makes baseline and candidate distinct artifacts and guarantees a fresh tarball every
  run (a shared/non-ephemeral registry can never serve a stale version). With no tag
  yet it runs a logged BOOTSTRAP (harness-only, no regression coverage).
- **CI:** `.github/workflows/contract-guard.yml` runs it on `packages/**` PRs and
  manual dispatch; once it has run on a PR, enable `guard` as a required status check
  on `main` (a repo branch-protection setting) so a leak blocks merge.

### Reproduce the negative test (the guard actually catches a leak)

In `packages/press-web/src/block-renderer.tsx`, change `{ ...referenceBlocks, ...components }`
to `{ ...referenceBlocks }` (drops adopter custom blocks), then `node scripts/contract-guard.mjs`:
the file + boot checks pass and the baseline render is green, but the **post-update**
render fails with `E2E FAIL: callout message missing from HTML` and a non-zero exit.
Revert to restore green. (The uncommitted edit lands only in the candidate; the
baseline is built from the pristine tagged engine, so the failure is unambiguously the
update's.)
