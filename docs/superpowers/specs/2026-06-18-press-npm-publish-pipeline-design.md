---
title: "Spec — First npm publish (`@ogs-tech/press-*`) + release pipeline"
internal_name: press-npm-publish-pipeline
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-18
updated_at: 2026-06-18
---

# Spec — First npm publish (`@ogs-tech/press-*`) + release pipeline

> [!NOTE]
> The engine packages are already publish-ready (`publishConfig.access: public`,
> `@press/shared` kept private, `pack:check` green) but have never hit npm. This
> spec lands the **first public publish** under the new **`@ogs-tech`** org and a
> **build → bump → publish** pipeline using Changesets + GitHub Actions with npm
> OIDC trusted publishing. The consumer-facing `press upgrade` command is **out
> of scope** — it gets its own spec, sequenced after this one, because it can only
> be tested against versions that are already on npm.

**TL;DR** — Rename the engine scope `@press/* → @ogs-tech/press-*` (the npm org
`ogs-tech` is owned; the bare `press`/`press-cli` names are taken by third
parties). Adopt **Changesets** as the versioning engine, wire a **GitHub Actions
release pipeline** that opens a "Version Packages" PR and publishes on merge with
**OIDC + provenance** (no stored token), and do a **one-time manual bootstrap
publish** to create the three packages so their trusted-publisher settings pages
exist. The CLI command stays `press`; the Strapi plugin id stays `press-cms`.

---

## 1. Goals / Non-goals

**Goals**

1. Publish `@ogs-tech/press-cli`, `@ogs-tech/press-cms`, `@ogs-tech/press-web` to
   the public npm registry for the first time.
2. A repeatable, market-standard **build → bump → publish** pipeline that requires
   no long-lived npm secret in the repo.
3. Keep the scaffold's pinned engine versions (`versions.generated.ts`) in lockstep
   with every bump, so `press create` always installs a coherent engine.

**Non-goals**

- `press upgrade` (consumer-side upgrade command) — separate spec.
- Publishing `@ogs-tech/press-shared` — it stays `private: true` (dev-only contract
  types, erased at transpile time).
- Changing the `press` bin name, the `press-cms` Strapi plugin id, or any runtime
  behaviour of the engine.

---

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Scope | npm namespace | `@ogs-tech/press-*` (org `ogs-tech` owned; product prefix `press-`) |
| Versions | starting versions | **Keep current**: cli `0.1.0`, cms `0.3.2`, web `0.3.1` (independent versioning) |
| Versioning tool | bump + changelog | **Changesets** with `@changesets/changelog-github` |
| CI | where it runs | **GitHub Actions** on `ogs-tech/press-cli`, publish on merge to `main` |
| Auth | publish credential | **OIDC trusted publishing** + `--provenance` (no `NPM_TOKEN`) |
| Bootstrap | first publish | **One-time manual local `npm publish`**, then register trusted publishers |

---

## 3. Scope rename `@press/* → @ogs-tech/press-*`

The rename is the "bump the names" prerequisite. ~40 files reference `@press/`,
grouped below. The bin name `press` and the Strapi plugin id `press-cms` do **not**
change (they are independent of the npm package name).

| Group | Files (representative) | Change |
|---|---|---|
| Manifests + cross-deps | `packages/{cli,cms,web,shared}/package.json`, root `package.json` | `name` fields; `@press/shared` devDep in cms/web; `@press/cms`+`@press/web` devDeps at root |
| Scaffold logic | `packages/cli/src/create/scaffold.ts`, `compute-versions.ts` (+ tests), `gen-versions.ts` | Dependency keys written into scaffolded `package.json`; `--filter` targets. Internal identifiers `pressCli/pressWeb/pressCms` stay (not package names) |
| Generated pins | `packages/cli/src/create/versions.generated.ts` | Regenerated via `gen:versions`; only the header comment's `@press/cli` → `@ogs-tech/press-cli` |
| Consumer-facing templates | `packages/cli/templates/**`, `packages/web/templates/host/**` | `import … from '@press/web'`, `transpilePackages: ['@press/web']`, comments |
| Engine-internal refs | `packages/cms/server/src/**`, `packages/web/src/**` | `import type` of `@press/shared` |
| Readiness checker | `packages/cli/src/publish/publish-readiness.ts` (+ test) | `PUBLISHABLE_PACKAGES` and comments → new names |
| Dogfood | `apps/playground/**` | Regenerated via `pnpm play:create` after the rename (not hand-edited) |
| Docs | `README.md` | Updated. Dated specs/plans under `docs/superpowers/**` are **left as historical record** |

**`@ogs-tech/press-shared` stays private.** It is a devDependency only; pnpm never
ships it in a published tarball, which is why `pack:check` is green today.

**`@ogs-tech/press-web` keeps `.npmignore` (no `files` field).** Intentional and
documented in `publish-readiness.ts`: under a `files` allowlist npm stops honoring
`.npmignore`, so web controls its tarball surface with `.npmignore`. Do not add a
`files` array to web during the rename.

**Guardrails (must all be green after the rename):**

- `pnpm build && pnpm pack:check` — dry-run publish for `./packages/*`.
- `pnpm -r test` — scaffold tests assert the `packages/` layout and dependency
  keys; `compute-versions.test.ts` is the drift guard; `publish-readiness.test.ts`
  asserts the publishable set and that shared stays private.
- `pnpm --filter @ogs-tech/press-cli gen:versions --check` — pins not stale.
- `pnpm play:create && pnpm build` — dogfood regenerates and the whole tree builds.

---

## 4. Versioning with Changesets

Add `@changesets/cli` + `@changesets/changelog-github` as root devDependencies and
run `pnpm changeset init`.

**`.changeset/config.json`:**

```jsonc
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

- `private: true` packages (`@ogs-tech/press-shared`, `apps/playground`) are skipped
  automatically — no need to list them in `ignore`.
- `access: "public"` makes `changeset publish` publish public by default (belt-and-
  suspenders with each manifest's `publishConfig`).

**The scaffold-pins hook (the monorepo wrinkle).** `changeset version` only edits
`package.json` versions; it does not rebuild. So after a bump the committed
`versions.generated.ts` would point at the old engine versions. The release flow
must regenerate the pins as part of versioning:

```jsonc
// root package.json "scripts"
{
  "version-packages": "changeset version && pnpm --filter @ogs-tech/press-cli gen:versions && git add -A",
  "release": "turbo run build && changeset publish"
}
```

`gen:versions --check` runs in CI as the drift backstop.

**Author loop:** feature PR → `pnpm changeset` (writes a markdown intent describing
the semver bump per package) → merge to `main`.

---

## 5. CI/CD pipeline (GitHub Actions + OIDC)

Two workflows under `.github/workflows/`.

### 5.1 `ci.yml` — the gate (on PR + push)

```yaml
# pseudo-outline
jobs.verify:
  - pnpm/action-setup
  - actions/setup-node (node 20, cache: pnpm)
  - pnpm install --frozen-lockfile
  - pnpm build                                   # turbo
  - pnpm -r typecheck
  - pnpm -r test
  - pnpm --filter @ogs-tech/press-cli gen:versions --check
  - pnpm pack:check                              # dry-run publish
```

### 5.2 `release.yml` — bump + publish (on push to `main`)

```yaml
permissions:
  contents: write          # commit version bumps / push tags
  pull-requests: write     # open the "Version Packages" PR
  id-token: write          # npm OIDC
jobs.release:
  - pnpm/action-setup
  - actions/setup-node (node 20, cache: pnpm, registry-url: https://registry.npmjs.org)
  - npm i -g npm@latest                          # ensure >= 11.5 for OIDC trusted publishing
  - pnpm install --frozen-lockfile
  - changesets/action@v1
      version: pnpm run version-packages          # changeset version + regen pins + git add
      publish: pnpm run release                   # turbo build + changeset publish --provenance
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- When pending changesets exist, the action opens/updates a **"Version Packages"
  PR**. Merging it bumps versions; the next run publishes.
- `changeset publish` publishes only packages whose version is not yet on npm, then
  pushes git tags.
- `--provenance` is added to the publish (set in the `release` script or via
  `NPM_CONFIG_PROVENANCE=true`); combined with `id-token: write` and a configured
  trusted publisher, npm issues short-lived credentials — **no `NPM_TOKEN`**.

Node is pinned to 20 (`engines: >=20 <21`).

---

## 6. Bootstrap — the first publish

npm trusted publishing is configured **on each package's settings page**, which
only exists after the package has been published once. One-time sequence:

1. `npm login` (account has verified email + 2FA enabled).
2. `pnpm build && pnpm pack:check` — final dry-run sanity.
3. **First manual publish** (creates the three packages at current versions):
   ```
   pnpm -r --filter "./packages/*" publish --access public --no-git-checks
   ```
   This run is local, so it has no provenance — acceptable for the one-time bootstrap.
4. For each of `@ogs-tech/press-cli`, `@ogs-tech/press-cms`, `@ogs-tech/press-web`
   on npmjs: **Settings → Trusted Publisher → GitHub Actions**, repo
   `ogs-tech/press-cli`, workflow `release.yml`.
5. From then on, every release flows through `release.yml` via OIDC + provenance;
   no token is ever stored.

---

## 7. Verification

**In CI (gate before any publish):** the full `ci.yml` job — build, typecheck,
tests (scaffold layout, version drift, publish-readiness), `gen:versions --check`,
and `pack:check`.

**Post-publish smoke test:**

```
npm view @ogs-tech/press-cli version          # resolves to 0.1.0
cd $(mktemp -d) && npx @ogs-tech/press-cli@latest create tmp-app
# the scaffolded app's package.json pins @ogs-tech/press-{web,cms} at published versions
```

**Provenance check (after first OIDC release):** the package page on npmjs shows
the "Published via GitHub Actions" provenance badge.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Stale scaffold pins after a bump | `version-packages` regenerates pins; `gen:versions --check` fails CI if stale |
| `workspace:` spec leaking into a published tarball | `publish-readiness.ts` + `pack:check` reject it; shared stays private |
| OIDC not yet configurable for a non-existent package | One-time manual bootstrap publish (Section 6) creates the package first |
| `npm` in CI too old for OIDC | `npm i -g npm@latest` step ensures ≥ 11.5 |
| Rename regressions in scaffolded output | Scaffold tests + `pnpm play:create` regen + full build as guardrails |
| Org `ogs-tech` billing surprise | Free plan covers unlimited public packages; all packages are `access: public` |

---

## 9. Out of scope (follow-up specs)

- **`press upgrade`** — consumer-side command (detect installed engine versions,
  run codemods/migrations, update lockfile), modelled on `ng update` / `expo
  upgrade`. Depends on published versions existing, so it is sequenced after this.
