---
title: "Roadmap — press beta"
internal_name: press-cli
status: Beta
created_at: 2026-06-11
updated_at: 2026-06-12
source_prd: docs/beta-prd.md
---

# Roadmap — press beta

The beta (see [beta-prd.md](./beta-prd.md)) is delivered as an ordered set of
**specs**, each running its own `spec → plan → implementation` cycle. Order
follows risk (PRD §8) and dependencies, not feature appeal: the riskiest,
most-blocking unknowns ship first so a failure invalidates the concept early
and cheaply.

## Specs

| # | Spec | Proves (PRD link) | Depends on | Status |
|---|---|---|---|---|
| **0** | Spike `@press/cms` (Strapi-as-dependency) + monorepo bootstrap | Risk #1 — CMS is wrappable as a versioned, updatable dependency | — | ✅ Done |
| **1** | `@press/web` + type-sync contract (incl. custom-block render, end-to-end) | Q2 — type/block contract CMS→front-end | 0 | ✅ Done |
| **2** | Whitelabel config `press.config.ts` | Contract boundary | 0, 1 | ✅ Done |
| **3** | CLI surface `press create / dev / build / deploy` | Q1 — create→deploy flow | 0, 1, 2 | ✅ Done |
| **4** | Update path + CI contract guard | Q2 — non-breakage survives an update cycle | 0, 1 | ✅ Done |
| **5** | Deploy guide (managed + self-hosted) | Q1 — first deploy unaided | 3 | ✅ Done |

## Spec 0 — outcome (done)

Strapi-as-dependency is feasible. The engine ships as a Strapi plugin
(`@press/cms`) loaded by **auto-discovery** (not `resolve:`), delivers
Dynamic-Zone reference blocks from `node_modules` by injecting components at the
plugin's `register` lifecycle (Path A), and admits adopter custom blocks into
the engine's dynamic zone. The non-breakage contract was exercised for real:
`@press/cms` `0.1.0 → 0.2.0` left the Project zone byte-identical and the project
still built and booted. That one-off check is now subsumed by the standing Spec 4
contract guard (`scripts/contract-guard.mjs`). Engine and host were published
to/consumed from a local Verdaccio registry as real packages.

## Spec 1 — outcome (done)

The front-end half of the block contract holds end-to-end. `@press/web` is
consumed by the Project zone; the **type-sync contract** runs CMS schema
(content-types + components, reference and custom) → TypeScript types →
front-end, auto-synced; and `BlockRenderer` server-renders both **reference
blocks** (`press.hero` + image media) **and** the adopter's **custom block**
(`custom.callout`) against live CMS output — the most likely contract-leak
surface (PRD §6). All 5 acceptance criteria passed on engine `@press/cms@0.3.2`,
with five integration fixes surfaced at the live gates (route prefix, DZ populate
key, `@types/react` skew, `Block` index signature, Strapi CJS seed boot). Run
guide and Results in the [Spec 1 design](../superpowers/specs/2026-06-11-press-web-type-sync-design.md)
and `README.md`.

## Spec 2 — outcome (done)

Whitelabel **identity + SEO** are centralized in a single Project-zone
`press.config.ts`, consumed by `@press/web` through an engine-owned typed
interface (`defineConfig` / `resolveConfig` / `buildMetadata`). The contract
boundary was exercised against real rendered markup, not fixtures: the page
`<head>` reflects config-driven title template, description, OG, canonical,
`lang`, and favicon (AC1/AC2); omitted fields fall back to engine defaults while
set fields win (AC3); a destructive rename of the engine's `PressConfig` type
makes `tsc --noEmit` **fail loud at the adopter's `press.config.ts`** (AC4); and
the engine never writes the file — `git status` stays clean after build/sync
(AC5). Scope was held to Identity + SEO; theme tokens, draft preview, and Strapi
admin branding were deferred to keep the public contract small (PRD §8). The
`apps/cms/press.config.ts` placeholder was reconciled to root. Run guide in
`README.md`; non-breakage *across an update* is Spec 4's job, not Spec 2's.

## Spec 3 — outcome (done)

The first end-user surface: the `press` CLI. Wraps the now-proven engine
(`@press/cms` + `@press/web` + `press.config.ts`) into the **create → dev →
build → deploy** flow that answers Q1 (a user reaches first deploy unaided).
Design fixed three scope decisions: (1) **ultra-thin, asymmetric Project zone** —
`press create` writes only the adopter layer (config, `blocks/custom/`, content
seed, `.env`, a minimal `cms/` Strapi host); the Next host is engine-owned and
**materialized to a gitignored `.press/`** on dev/build, so create adds zero new
contract-leak surface; (2) **`create`/`dev`/`build` real, `deploy` thin** — the
managed + self-hosted guide is Spec 5; (3) **draft preview deferred again**, but
config wiring into `press dev / build` stays in. Full design:
[Spec 3 design](../superpowers/specs/2026-06-11-press-cli-design.md).

**Outcome (done).** `@press/cli` ships `create`/`dev`/`build`/`deploy`;
`@press/web@0.2.0` ships the Next host template the CLI materializes to a
gitignored `.press/web/`. `press create` writes the §6 ultra-thin manifest (no
committed web host) and installs it; `press dev`/`build` boot/build the whole
stack consuming `press.config.ts`; `press deploy` is the thin Spec 5-delegating
surface. All five acceptance criteria pass via `scripts/cli-e2e.mjs` against the
local Verdaccio registry (real tarballs of `@press/web` + `@press/cli`), and
`git status` stays clean after create→dev→build — the create-time footprint adds
zero Project-zone surface. The deploy guide is Spec 5; the non-breakage proof
across an update is Spec 4.

## Spec 4 — outcome (done)

Non-breakage **survives a real update cycle**, and CI now enforces it. The
standing guard `scripts/contract-guard.mjs` starts/stops its own ephemeral
Verdaccio, publishes both `@press/cms` and `@press/web` as baseline + candidate,
stages the adopter at the baseline, runs `pnpm update @press/*`, and asserts the
seeded page still renders `press.hero` + `custom.callout` + the whitelabel
`<head>` at both versions — a render-deep cycle, not a file-diff. The full
AC1–AC5 set passed: real cycle green (`CONTRACT HELD`, exit 0); a dropped
custom-block render path in the candidate is caught **post-update**
(`callout message missing`, exit 1) with a clean RED/GREEN pair on identical
shipped code; `.github/workflows/contract-guard.yml` gates `packages/**` PRs +
`workflow_dispatch` (Node 20 / pnpm 10, Verdaccio in-job; `guard` to be flipped
to a required check on `main`); the pre-tag bootstrap run exited honestly; and a
clean-tree local repro re-runs robustly. First release tag `engine-v0.3.2`
(`@press/cms@0.3.2` + `@press/web@0.1.0`); the old `contract-check.mjs` is
removed, its allowed-delta logic subsumed by the generalized guard (one source of
truth, both packages). Key execution deltas: publish labels are
**content-addressed** (`X.Y.Z-base.<srcHash>` / `-contract.<srcHash>`) so an
uncommitted edit always yields a fresh tarball (no stale-reuse masking a
regression); types are pre-generated to disk before publish; a dirty `packages/`
falls through to a pristine tag worktree so the regression is tested as vN+1.
Full design + Results: [Spec 4 design](../superpowers/specs/2026-06-11-press-update-contract-guard-design.md).

**Merge note.** Shipped on `worktree-spec-4-contract-guard` (forked at `0f0d5d4`,
before Spec 3 bumped `@press/web` to 0.2.0 + added `host-template/`). Landing it
on `main` needs `packages/press-web` reconciliation; the guard intentionally
keeps the 0.1.0 baseline.

> **Removed (2026-06-14).** The Verdaccio-based contract guard
> (`scripts/contract-guard.mjs`, `.github/workflows/contract-guard.yml`, and the
> local Verdaccio registry) was removed along with Verdaccio itself. Local
> verification is now the registry-free playground smoke test
> (`scripts/cli-e2e.mjs`); a Playwright e2e suite is planned. The text above is
> retained as a record of what Spec 4 shipped.

## Spec 5 — outcome (done)

An external adopter can reach **first deploy unaided** (PRD Q1) via two documented
paths. **Self-hosted (primary)** is a `deploy/` kit dropped by `press create`:
`docker-compose.yml` (Postgres 16 + cms + web + a Caddy single-origin proxy + a
one-shot seed), `Dockerfile.cms`/`Dockerfile.web`, a `Caddyfile`, and
`.env.deploy.example`. **Managed (documented, cost-flagged ~US$38/mo)** is Strapi
Cloud (cms) + Vercel (web), including the materialized-host wrinkle (no committed
Next app → Vercel build command `pnpm press build`, output `.press/web/.next`,
`@press/*` token via `.npmrc`).

The crux Spec 5 solved: the web host reads **`CMS_URL` at runtime** for both the
API fetch *and* the hero image `src` it emits into browser-loaded HTML, so
`CMS_URL` must be the **public** cms origin — the kit routes web + cms through one
Caddy origin so a single `CMS_URL` satisfies both. The materialized web host is
shipped via **build-then-ship** (the image copies host-built `node_modules` +
`.press/web/.next` and only runs them; same-arch by design, caveat documented).
Two real kit defects were fixed en route: the cms host now depends on **`pg`**
(Strapi 5 bundles no DB driver, so a Postgres deploy needs it), and the compose
seed one-shot runs `../content/seed.mjs` from the cms cwd (matching `press dev`).

`scripts/deploy-smoke.mjs` (`pnpm deploy:smoke`) proves the self-hosted path
end-to-end in **production mode against Postgres** — publish engine → `press
create` → `press build` → `docker compose up --build` → assert the seeded `/home`
renders hero + custom callout + whitelabel `<head>` + an absolute image `src`
through Caddy. It is gated in CI by `.github/workflows/deploy-smoke.yml` (Linux —
the same-arch happy case) on deploy-kit / harness / host template changes.

> **Removed (2026-06-14).** The deploy feature (kit, `press deploy`, smoke
> harness, managed/self-hosted guide) was dropped as out-of-scope for the beta.
> The text above is retained as a record of what Spec 5 shipped.

## Cadence

Short retro every **2 weeks** (PRD §7): did anyone reach a phase gate; where did
the contract leak or the flow stall; fix, cut, or stop. The roadmap is re-ordered
whenever a spike changes the risk picture.
