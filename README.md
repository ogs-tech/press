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
- `scripts/` — `registry.sh` (Verdaccio helper), `contract-check.mjs` (the §9
  non-breakage proof), `assert-no-engine-in-host.mjs` (host-thinness invariant).

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

# 6. Prove non-breakage of an engine update.
#    First publish the update target (bump packages/press-cms to 0.2.0, build,
#    publish) — contract-check.mjs does NOT publish, it only runs `pnpm update`:
#      # set packages/press-cms/package.json "version": "0.2.0"
#      pnpm --filter @press/cms build
#      ( cd packages/press-cms && npm publish --registry http://localhost:4873 \
#          --userconfig "$PWD/../../.npmrc" )
#    Then, from a CLEAN git tree with the host on the "from" version (0.1.0):
node scripts/contract-check.mjs 0.1.0 0.2.0
#    → "CONTRACT HELD" when only apps/cms/package.json (@press/cms) + lockfile changed.
```

## Notes

- The Verdaccio `_authToken` in `.npmrc` is localhost-only (harmless for this local
  spike); gitignore it before any shared/non-private repo.
- This skeleton (`packages/press-cms` + `apps/cms` + the contract scripts) is the
  foundation that the later press specs build on.
