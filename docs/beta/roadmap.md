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
| **1** | `@press/web` + type-sync contract (incl. custom-block render, end-to-end) | Q2 — type/block contract CMS→front-end | 0 | ▶ Next |
| 2 | Whitelabel config `press.config.ts` | Contract boundary | 0, 1 | Planned |
| 3 | CLI surface `press create / dev / build / deploy` | Q1 — create→deploy flow | 0, 1 | Planned |
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

## Spec 1 — scope (next)

Closes the half of the block contract the spike left open. The spike proved the
**CMS side** (a custom block flows into the dynamic zone and saves); Spec 1
proves the **front-end side** end-to-end:

- `@press/web` engine package consumed by the Project zone.
- **Type-sync contract**: CMS schema (content-types + components, reference and
  custom) → TypeScript types → consumed by the front-end, auto-synced.
- `BlockRenderer` rendering **reference blocks** (`press.hero`, …) **and** the
  adopter's **custom block** (`custom.callout`) — the most likely contract-leak
  surface (PRD §6).

Scope decision (2026-06-11): **end-to-end**, including custom-block render. This
front-loads the highest-risk contract surface so Q2 is answerable as early as
possible, at the cost of a larger spec than a reference-blocks-only first cut.

## Cadence

Short retro every **2 weeks** (PRD §7): did anyone reach a phase gate; where did
the contract leak or the flow stall; fix, cut, or stop. The roadmap is re-ordered
whenever a spike changes the risk picture.
