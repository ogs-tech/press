---
title: "Beta PRD — press"
internal_name: press-cli
public_name: press
status: Beta
created_at: 2026-06-10
updated_at: 2026-06-10
---

# Beta PRD — press

> [!NOTE]
> This is a **beta** PRD: it exists to validate one bet with a small set of users, not to define the long-term product. Stack, flows, and technical decisions belong in `ARCH.md`.

**TL;DR** — press is **not a scaffold**. It is an opinionated meta-framework for content-driven sites. The stack (CMS + front-end + type contract + dynamic blocks) ships as **versioned dependencies** (`@press/core`, `@press/cms`, `@press/web`) that the adopter consumes, not as boilerplate copied into their repo. The adopter owns only a thin layer on top — config, content, and custom blocks. The product's core promise is a **non-breakage contract**: updating press must not break the adopter's layer. The beta exists to prove that promise is real with external users.

## 1. Problem

Full-stack devs and agency tech leads who build content-driven sites face two costs, not one:

1. **Assembly** — every project rebuilds the same stack (CMS + front-end + types + dynamic blocks) from scratch.
2. **Lock-in to a frozen stack** — scaffolds solve assembly and then *walk away*. The generated code becomes the adopter's to maintain; updating the stack means hand-migrating breaking changes across a codebase they didn't design. The longer the project lives, the more stranded it gets.

Existing options solve only the first cost and make the second worse: scaffolds copy code and abandon it; headless CMS and front-end frameworks each cover half; all-in-one platforms remove the pain by removing your ownership. Nobody ships an opinionated, open stack that you can **keep updating without rewriting your project**.

## 2. The bet

Devs and small agencies will accept an **opinionated, framework-shaped** stack — giving up the freedom to assemble their own — in exchange for a guarantee that **the layer they own survives updates**. Concretely: they accept `@press/*` owning the stack, because `npm update @press/core` won't break their `press.config.ts`, `content/`, or `blocks/custom/`.

If that contract holds, press stops being "yet another starter" and becomes infrastructure a team can standardize on.

## 3. What the beta must prove

Two anchor questions. Everything in scope serves one of them.

- **Q1 — Flow:** Can an external dev go from `create` → running local stack → first deploy, **without the maintainers in the room**? (time-to-value, setup friction)
- **Q2 — Contract:** Does the non-breakage contract **survive a real update cycle**? I.e., a project built on `@press/core` vN keeps working after moving to vN+1, with the adopter's layer untouched. (the differentiating promise)

The beta is a success only if **both** get a credible yes. Q2 is the one that makes press different from a scaffold; if it fails, the product concept fails, not just the release.

## 4. The contract (core of this document)

press divides every generated project into two zones with a hard boundary between them.

| Zone | Belongs to | Examples | Update behavior |
|---|---|---|---|
| **Engine** | press (versioned) | `@press/core`, `@press/cms`, `@press/web`, type-sync generator, `<BlockRenderer />`, whitelabel resolver | Updated via `npm update @press/*`. The adopter never edits these. |
| **Project** | adopter (owned) | `press.config.ts`, `content/`, `blocks/custom/`, environment/secrets | Never touched by an update. Free to change. |

**Definition of "non-breakage" (testable):** Given a project on `@press/core` vN that builds and boots, bumping to vN+1 within the same major leaves the **Project zone** unchanged on disk and the project still builds, boots, and deploys. Any change required inside the Project zone to absorb an update is a **contract leak** — the central defect class the beta hunts for.

> The exact field/API surface of the contract (what `press.config.ts` exposes, the custom-block interface, the engine's public types) is defined in `ARCH.md`. This PRD fixes the *promise*; ARCH fixes the *interface*.

## 5. Users & access — two phases

Single persona: **full-stack dev or agency tech lead** building content-driven sites. The beta reaches them in two gated phases. We do **not** ship a public beta: while the contract is still being discovered, breaking it must not hurt strangers in production.

| Phase | What it is | Core visibility | Exit gate |
|---|---|---|---|
| **0 — Dogfood** | Maintainers ship ≥1 real client site on press | `@press/*` private | 1 site in production **and** ≥1 `npm update @press/core` cycle completed with **zero contract leaks** |
| **1 — Closed beta** | ~5–10 hand-picked devs/agencies, observed closely | `@press/*` private (invite install) | Contract honored in external hands across ≥1 update cycle each; qualitative adoption signal (they keep using it) |

Phase 0 is a prerequisite, not a warm-up: you cannot promise non-breakage to anyone before you've felt where the contract leaks on your own real project. Public distribution is **post-beta** and out of scope here.

## 6. Scope of the beta

### Must-have (serves Q1 or Q2)

- **CLI surface to create and run a project:** `press create` (or `npm create`) → installed, bootable project; `press dev`, `press build`, `press deploy` cover the local-to-deploy loop. *(Q1)*
- **An update path the adopter can run** so the contract is exercisable end-to-end. The minimal form (bump `@press/*` + boot) must work; whether a dedicated `press upgrade` command exists in the beta is an open question (§9). *(Q2)*
- **Shared type contract** between CMS and front-end, auto-synced, consumed by the Project zone. *(Q1, Q2)*
- **Dynamic block system** with reference blocks, plus a stable **custom-block interface** in `blocks/custom/`. *(Q2 — this is the most likely contract-leak surface)*
- **Whitelabel config** centralized in `press.config.ts`, consumed by the engine. *(contract boundary)*
- **Deploy guide** for at least one managed and one self-hosted path. *(Q1)*

### Out of beta scope

- Public/open distribution of `@press/*`.
- Admin auth beyond the CMS default.
- SEO defaults, sitemap/robots automation.
- Telemetry.
- Any second front-end framework or CMS.

## 7. Success metrics & exit criteria

Mostly qualitative — a closed beta with ~5–10 users measures depth, not volume.

**Phase 0 (Dogfood) — exit when all true:**

- 1 real site live in production on press.
- ≥1 `npm update @press/core` cycle completed with **zero contract leaks** (Project zone untouched, project still builds/boots/deploys).
- Maintainer can run `create → deploy` from a clean machine following only the written docs.

**Phase 1 (Closed beta) — exit when:**

- ≥3 external adopters complete `create → first deploy` unaided (**Q1 answered**).
- ≥3 external adopters complete ≥1 update cycle with no contract leak in their layer (**Q2 answered**).
- Adopters keep using press after the first project (retention as qualitative signal, gathered via interviews).

**Failure / stop signals:**

- Contract leaks recur across releases despite fixes → the framework concept is not viable as specced; revisit before opening further.
- External adopters cannot reach first deploy unaided after docs iteration → flow friction too high for the persona.

**Cadence:** short retro every **2 weeks** — (1) Did anyone reach the phase gate? (2) Where did the contract leak / where did the flow stall? (3) Fix, cut, or stop?

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Strapi-as-dependency (#1)** — the CMS is a full app, not a library; wrapping it as a consumable, updatable `@press/cms` may not be cleanly feasible | If false, the framework concept collapses — Phase 0 cannot be reached | Treat as the first thing Phase 0 proves; spike it before committing the rest of the engine. Decision recorded in `ARCH.md`. |
| **Contract leaks** — an engine update forces edits in the Project zone | Breaks the core promise; erodes the one thing that differentiates press | Snapshot/contract tests in CI that fail on any Project-zone change after a simulated update; treat each leak as a release blocker |
| **Engine surface too large to honor across updates** | Every public type/API becomes a non-breakage obligation the team can't sustain | Keep the public contract deliberately small in the beta; everything not in the contract is internal and free to change |
| **Team capacity** | A framework with an update guarantee is heavier to maintain than a scaffold | Confirm team size (§9); keep beta scope ruthlessly minimal |

## 9. Assumptions & open questions

**Assumptions**

- The opinionated stack carries over from the prior discovery work (Next + Strapi + TypeScript + Turborepo + pnpm + Tailwind). *To be confirmed in `ARCH.md`.*
- An npm scope for `@press/*` is available and reservable.
- A closed beta with private package access is operationally feasible (invite-based install).

**Open questions (resolved in ARCH or before Phase 1, do not block this PRD)**

- Exact CLI command surface — does `press upgrade` (assisted migration) exist in the beta, or is the update path just "bump `@press/*` + boot"?
- Does the prior stack (Next 15 / Strapi 5 / Turborepo / pnpm) carry over unchanged, or does the framework concept force a different composition (esp. for `@press/cms`)?
- Current team size and capacity (prior discovery assumed 2 full-time devs).
- How is the engine actually delivered — published private packages, git, or another mechanism?

## 10. Non-goals (beta)

- A SaaS / hosted offering.
- A WYSIWYG page builder.
- A theme/plugin marketplace.
- Custom RBAC or auth providers beyond the CMS default.
- Multiple front-end frameworks or CMS choices.
- Public distribution of `@press/*`.
