---
title: "Roadmap — press beta"
internal_name: press-cli
status: Beta
created_at: 2026-06-11
updated_at: 2026-06-11
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
| **3** | CLI surface `press create / dev / build / deploy` | Q1 — create→deploy flow | 0, 1, 2 | ◐ Design approved |
| 4 | Update path + CI contract guard | Q2 — non-breakage survives an update cycle | 0, 1 | Planned |
| 5 | Deploy guide (managed + self-hosted) | Q1 — first deploy unaided | 3 | Planned |

## Spec 0 — outcome (done)

Strapi-as-dependency is feasible. The engine ships as a Strapi plugin
(`@press/cms`) loaded by **auto-discovery** (not `resolve:`), delivers
Dynamic-Zone reference blocks from `node_modules` by injecting components at the
plugin's `register` lifecycle (Path A), and admits adopter custom blocks into
the engine's dynamic zone. The non-breakage contract was exercised for real:
`@press/cms` `0.1.0 → 0.2.0` left the Project zone byte-identical and the project
still built and booted, verified by `scripts/contract-check.mjs`. Engine and host
were published to/consumed from a local Verdaccio registry as real packages.

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

## Spec 3 — scope (design approved)

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

## Cadence

Short retro every **2 weeks** (PRD §7): did anyone reach a phase gate; where did
the contract leak or the flow stall; fix, cut, or stop. The roadmap is re-ordered
whenever a spike changes the risk picture.
