---
title: "Spec — Strapi-as-dependency spike (@press/cms)"
internal_name: press-cli
relates_to: docs/beta-prd.md
status: Design approved
created_at: 2026-06-10
updated_at: 2026-06-10
---

# Spec — Strapi-as-dependency spike (`@press/cms`)

> [!NOTE]
> This is a **spike spec** — spec 0 of the press beta and the hard gate for every
> other spec. It exists to answer one feasibility question before the rest of the
> engine is committed, per [beta-prd.md §8, Risk #1](../../beta-prd.md). It fixes
> the *experiment and its acceptance criteria*; the resulting architecture becomes
> the foundational skeleton of `@press/cms` and bootstraps the monorepo.

**TL;DR** — Prove that Strapi 5 can be delivered as a versioned, updatable
dependency (`@press/cms`) that an adopter consumes through a thin owned host, such
that `pnpm update @press/cms` upgrades the engine **without touching the adopter's
Project zone**. Success is the full contract loop: boot on vN → adopter adds a
custom block → bump to vN+1 → the Project zone is byte-identical on disk and the
project still builds and boots. If this fails, the press framework concept fails
([beta-prd.md §3, Q2](../../beta-prd.md)).

## 1. Why this spike, and why first

[beta-prd.md §8](../../beta-prd.md) names **Strapi-as-dependency** as Risk #1:
Strapi is a full application, not a library, and wrapping it as a consumable,
updatable package may not be cleanly feasible. If it is not, Phase 0 cannot be
reached and the framework concept collapses. The PRD's instruction is explicit:
*"spike it before committing the rest of the engine."*

This spec is the realization of that instruction. It is the first of six specs in
the beta roadmap and the only hard gate — specs 1–5 (`@press/web`, type-sync,
whitelabel, CLI, update/CI, deploy) change shape or become moot if this one fails.
It is kept deliberately narrow so the bet is cheap to test and the answer is
unambiguous.

## 2. The question (single anchor)

> Can the press engine ship Strapi content-types **and** the dynamic block
> components from a versioned package, so that the adopter's owned host stays
> untouched across an engine update?

Everything in scope serves this question. Anything that does not is out of scope
(§10).

## 3. Success bar

The spike must exercise the **full contract loop** — not just "can it be packaged",
but "does it survive an update". Concretely: boot the engine from package vN → the
adopter adds a custom block in the owned host → bump to vN+1 → verify the Project
zone is byte-identical on disk and the project still builds and boots (§7). A spike
that only proves boot-from-dependency, or boot plus custom block without an update,
is explicitly **not** sufficient — it would answer "can we package it?" while
leaving the differentiating Q2 ("does it survive the update?") unanswered.

## 4. Stack & runtime

Carried over from [beta-prd.md §9](../../beta-prd.md); nothing in this spike
justifies diverging.

- **Strapi 5.x**, pinned. A Strapi 6 release mid-spike would poison the reading of
  the result, so the exact 5.x version is pinned and recorded in §10's results.
- **pnpm workspaces + Turborepo** — the monorepo this spike bootstraps.
- **TypeScript**, **Node 20 LTS**.

## 5. Target architecture

Two zones with a hard boundary, mirroring [beta-prd.md §4](../../beta-prd.md).

### 5.1 `@press/cms` — the engine (Engine zone, versioned)

A Strapi plugin published as an npm package. It carries everything volatile. The
adopter never edits anything under `packages/press-cms/`. In the real product this
is installed from a registry into `node_modules`; in the spike it is published to a
local Verdaccio registry (§6).

```
packages/press-cms/                 # published as @press/cms — version bumped each release
├── package.json                    # name: @press/cms
├── strapi-server.ts                # plugin server entry
└── server/
    ├── content-types/              # base content-types (e.g. `page` with a dynamic zone)
    ├── components/                 # reference blocks — IF plugin-shippable (see §6, the pivot)
    ├── register.ts                 # engine register lifecycle
    └── bootstrap.ts                # engine bootstrap lifecycle
```

### 5.2 `apps/cms` — the host (Project zone, adopter-owned)

The thinnest Strapi application that can boot the engine. Only the `@press/cms`
version range is ever touched by an update.

```
apps/cms/
├── package.json                    # deps: @strapi/strapi + @press/cms
├── config/
│   ├── plugins.ts                  # enables @press/cms                 ← stable, owned
│   ├── database.ts                 # env-driven                         ← Project zone
│   └── server.ts                   # env-driven                         ← Project zone
├── src/
│   ├── index.ts                    # empty register/bootstrap           ← stable, owned
│   └── components/custom/          # adopter custom blocks              ← extension point
├── press.config.ts                 # whitelabel config                  ← Project zone
└── .env                            # secrets                            ← Project zone
```

> **Mapping note.** [beta-prd.md](../../beta-prd.md) names `blocks/custom/` as the
> custom-block location. On the CMS side a custom block is a Strapi component, so it
> lives in `apps/cms/src/components/custom/`. The web-side renderer for the same
> block is part of the deferred `@press/web` spec (spec 1).

### 5.3 Primary path (A), fallback (B), failure signal (C)

The one genuine unknown: **can a Strapi 5 plugin deliver Dynamic-Zone components
from `node_modules`?** Strapi plugins can ship content-types; components
conventionally live in the app's `src/components`. The architecture is therefore a
decision tree, not a single path.

| Path | Mechanism | When |
|---|---|---|
| **A — thin host + fat plugin** *(primary)* | Engine content-types **and** components ship from the `@press/cms` plugin; host `src/` holds only adopter custom blocks | Default. Chosen if the §6 pivot confirms components are plugin-shippable. Keeps the host in standard Strapi-app shape, so `strapi develop/build/deploy` works unmodified — this pays off in specs 3 (CLI) and 5 (deploy). |
| **B — programmatic boot wrapper** *(fallback)* | `@press/cms` exports `createPressCms()` wrapping `createStrapi`, injecting engine content-types/components in memory; host shrinks to a ~5-line entry | Adopted only if A fails. More deterministic injection, but fights the standard Strapi CLI. |
| **C — generated host, patched on upgrade** *(failure signal)* | Host files patched by an upgrade step on each bump | **Not built.** If both A and B leak, this is the **stop signal**: reference blocks would be forced into the owned host = structural leak. The contract is weaker than specced — revisit [beta-prd.md](../../beta-prd.md) before continuing the roadmap. |

The decision between A and B is **the first spike task** (§6, T1); it gates
everything after it.

## 6. Spike tasks (sequenced)

- **T1 — Resolve A vs B (the pivot).**
  Determine whether the engine can deliver Dynamic-Zone components from the
  `@press/cms` plugin. Yes → proceed on A. No → switch to B (programmatic
  injection). This is the only genuine unknown remaining; it gates everything after
  it.

- **T2 — Boot from the dependency.**
  The minimal host boots Strapi with base content-types and reference blocks coming
  **100% from `@press/cms`**. No engine code in the owned `src/`. The admin panel
  must show the engine's content-types and blocks.

- **T3 — Custom block in the Project zone.**
  The adopter adds a component under `apps/cms/src/components/custom/` and uses it
  in the page Dynamic Zone, **without editing the engine**. Proves the custom-block
  extension point — the surface [beta-prd.md §6](../../beta-prd.md) flags as the
  most likely contract-leak site.

- **T4 — The update loop vN → vN+1.**
  Bump `@press/cms`, re-boot, and run the contract verification (§7). This is the
  Q2 proof.

## 7. Update-cycle methodology

**Local registry — Verdaccio.**
Publish `@press/cms@0.1.0`, then `@0.2.0`, to a local Verdaccio registry and run a
real `pnpm update @press/cms` against it. This is the only mechanism that exercises
real version resolution + lockfile the way production does. A `workspace:*` link is
a symlink and would make the PRD's literal `npm update @press/cms` flow fiction; an
`npm pack` + `file:` tarball installs a real package but the "update" is just
swapping a tarball pointer, so it never tests semver-range resolution. Verdaccio's
one-time setup cost buys a faithful proof.

**vN+1 must carry a real change, not a no-op.**
A no-op bump proves nothing. v0.2.0 must change engine **internals** while keeping
the **public contract** stable. At least one of:

- Restructure the plugin's internal folder layout.
- Rename an **internal** field on a reference block (public block type unchanged).
- Change an engine-internal `register`/`bootstrap` detail.

The public contract held stable across the bump: the public block
type/`__component` identifier and the custom-block interface used by
`apps/cms/src/components/custom/`.

## 8. Acceptance criteria — testable "non-breakage"

After `pnpm update @press/cms` (v0.1.0 → v0.2.0):

1. **Allowed delta only.** The *only* permitted on-disk change in the Project zone
   is the `@press/cms` version in `apps/cms/package.json` plus the lockfile. Every
   other Project-zone path (`config/`, `src/`, `press.config.ts`, `.env`) must be
   **byte-identical**, verified by `git diff`.
2. **Still builds.** The host build succeeds.
3. **Still boots.** Strapi boots; the admin shows engine content-types, reference
   blocks, and the adopter's custom block; the page Dynamic Zone still renders all
   blocks.
4. **Deploy.** Treated as a documentary check for the spike (config still valid),
   not an executed deploy. Real deploy is deferred (§10).

Any required change inside the Project zone beyond the allowed delta is a
**contract leak** — the central defect class, and a release blocker per
[beta-prd.md §8](../../beta-prd.md).

## 9. Contract test (reusable deliverable)

A contract script that becomes the seed of the CI guard the PRD §8 asks for
("snapshot/contract tests in CI that fail on any Project-zone change after a
simulated update"):

1. Snapshot the Project zone (hashes of all files except the allowed delta).
2. Run the simulated `pnpm update @press/cms`.
3. Re-snapshot; **fail** if anything outside the allowed delta changed.
4. Run build + boot smoke checks.

Because the deliverable is foundational, this script is kept and hardened in spec 4
(update path + CI guard), not discarded.

## 10. Out of scope

- `@press/web`, and the CMS↔web type-sync contract (spec 1).
- Real deploy execution (managed and self-hosted) — documentary check only here
  (spec 5).
- Whitelabel config beyond a placeholder `press.config.ts` in the Project zone
  (spec 2).
- A second front-end framework or CMS.
- Admin auth beyond the Strapi default.
- Telemetry, SEO defaults, sitemap/robots.

## 11. Risks & stop signals

| Risk | Signal | Response |
|---|---|---|
| Components not shippable by plugin (A) **nor** injectable programmatically (B) | T1/T2 fail on both paths | **Stop signal C.** Reference blocks would be forced into the owned host = structural leak. Contract is weaker than specced — revisit beta-prd.md before continuing. |
| Admin build does not surface plugin-provided components | T2 admin check fails on A | Degrade to B; if B's admin also fails, document as a hard limitation. |
| `pnpm update` rewrites more of `package.json` than the dependency range | T4 acceptance #1 fails on an unexpected field | Investigate whether the extra change is package-manager-mechanical (acceptable — refine the allowed-delta definition) or engine-induced (a real leak). |
| Strapi 6 lands during the spike | n/a | Out of spike scope; pin Strapi 5.x for the spike, record the pin in this spec's results section. |

## 12. Definition of done

The spike is done when **either**:

- **A or B passes** all §8 acceptance criteria across the v0.1.0 → v0.2.0 loop, the
  chosen path's skeleton (`packages/press-cms/` + `apps/cms/`) is committed, and the
  contract test (§9) is green — **or**
- **The stop signal (§11, path C)** is reached and recorded, with evidence of why
  both A and B leak.

Either outcome is a credible answer to [beta-prd.md Risk #1](../../beta-prd.md).
The decision and its evidence are recorded in a **results section appended to this
spec**.

## 13. Results

> _To be appended when the spike completes (chosen path, Strapi 5.x pin, acceptance
> evidence, or the recorded stop signal)._
