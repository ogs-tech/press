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
> This is a **spike spec**. It exists to answer one feasibility question before the
> rest of the engine is committed, per [beta-prd.md §8 Risk #1](../../beta-prd.md).
> It fixes the *experiment and its acceptance criteria*; the resulting architecture
> becomes the foundational skeleton of `@press/cms`.

**TL;DR** — Prove that Strapi 5 can be delivered as a versioned, updatable
dependency (`@press/cms`) that an adopter consumes through a thin owned host,
such that `npm update @press/cms` upgrades the engine **without touching the
adopter's Project zone**. Success is the full contract loop on the CMS side:
boot on vN → adopter adds a custom block → bump to vN+1 → Project zone is
byte-identical on disk and the project still builds and boots. If this fails,
the press framework concept fails (beta-prd.md §3, Q2).

## 1. Why this spike, and why first

[beta-prd.md §8](../../beta-prd.md) names **Strapi-as-dependency** as Risk #1:
Strapi is a full application, not a library, and wrapping it as a consumable,
updatable package may not be cleanly feasible. If it is not, Phase 0 cannot be
reached and the framework concept collapses. The PRD's instruction is explicit:
*"spike it before committing the rest of the engine."*

This spec is the realization of that instruction. It is intentionally narrow so
the bet is cheap to test and the answer is unambiguous.

## 2. The question (single anchor)

> Can the press engine ship Strapi content-types **and** the dynamic block
> components from a versioned package, so that the adopter's owned host stays
> untouched across an engine update?

Everything in scope serves this question. Anything that does not is out of scope
(§9).

## 3. Scope

**In scope — CMS only.**
The contract loop is exercised entirely on the `@press/cms` side: a host app, the
engine plugin, a custom block, and one simulated update cycle.

**Deliverable — foundational skeleton.**
The validated architecture (folder structure, package names, the contract test)
is kept and built upon. Names and structure are definitive, not throwaway.

**Explicitly deferred to later specs:**
`@press/web`, the CMS↔web type-sync contract, real deploy (managed/self-hosted),
a second front-end framework or CMS, and admin auth beyond the Strapi default.

## 4. Target architecture

Two zones with a hard boundary, mirroring [beta-prd.md §4](../../beta-prd.md).

### 4.1 `@press/cms` — the engine (Engine zone, versioned)

A Strapi plugin published as an npm package. It carries everything volatile.

```
packages/press-cms/                 # published as @press/cms
├── package.json                    # name: @press/cms — version bumped each release
├── strapi-server.ts                # plugin server entry
└── server/
    ├── content-types/              # base content-types (e.g. `page` with a dynamic zone)
    ├── components/                 # reference blocks — IF plugin-shippable (see T1)
    ├── register.ts                 # engine register lifecycle
    └── bootstrap.ts                # engine bootstrap lifecycle
```

The adopter never edits anything under `packages/press-cms/`. In the real
product this is installed from a registry into `node_modules`; in the spike repo
it is a workspace package published to a local registry (§6).

### 4.2 `apps/cms` — the host (Project zone, adopter-owned)

The thinnest Strapi application that can boot the engine.

```
apps/cms/
├── package.json                    # deps: @strapi/strapi + @press/cms
│                                   #   ONLY the @press/cms range is touched by an update
├── config/
│   ├── plugins.ts                  # enables @press/cms                 ← stable, owned
│   ├── database.ts                 # env-driven                         ← Project zone
│   └── server.ts                   # env-driven                         ← Project zone
├── src/
│   ├── index.ts                    # empty register/bootstrap           ← stable, owned
│   └── components/custom/          # adopter custom blocks              ← CMS-side `blocks/custom/`
├── press.config.ts                 # whitelabel config                  ← Project zone
└── .env                            # secrets                            ← Project zone
```

> **Mapping note.** [beta-prd.md](../../beta-prd.md) names `blocks/custom/` as the
> custom-block location. On the CMS side a custom block is a Strapi component, so
> it lives in `apps/cms/src/components/custom/`. The web-side renderer for the
> same block is part of the deferred `@press/web` spec.

### 4.3 Primary path (A) and fallback (B)

| Path | Mechanism | When |
|---|---|---|
| **A — thin host + fat plugin** *(primary)* | Engine content-types **and** components ship from the `@press/cms` plugin; host `src/` holds only adopter custom blocks | Default. Chosen if T1 confirms components are plugin-shippable. |
| **B — programmatic boot wrapper** *(fallback)* | `@press/cms` exports `createPressCms()` wrapping `createStrapi`, injecting engine content-types/components in memory; host shrinks to a ~5-line entry | Adopted only if T1 shows components cannot ship from a plugin. |
| **C — generated host, patched on upgrade** *(failure signal)* | Host files patched by a `press upgrade` step on each bump | Not built. If both A and B leak, this is the **stop signal**: the contract is weaker than specced — revisit before continuing. |

Confirmed from Strapi 5 docs: **plugins can ship content-types** from the
package. **Unconfirmed and pivotal:** whether a plugin can ship Dynamic-Zone
**components** from `node_modules` (components conventionally live in the app's
`src/components`). T1 exists to resolve exactly this.

## 5. Spike tasks (sequenced)

- **T1 — Resolve A vs B (the pivot).**
  Determine whether the engine can deliver Dynamic-Zone components from the
  `@press/cms` plugin. Yes → proceed on A. No → switch to B (programmatic
  injection). This is the only genuine unknown remaining; it gates everything
  after it.

- **T2 — Boot from the dependency.**
  The minimal host boots Strapi with base content-types and reference blocks
  coming **100% from `@press/cms`**. No engine code in the owned `src/`. The
  admin panel must show the engine's content-types and blocks.

- **T3 — Custom block in the Project zone.**
  The adopter adds a component under `apps/cms/src/components/custom/` and uses
  it in the page Dynamic Zone, **without editing the engine**. Proves the
  custom-block extension point — the surface [beta-prd.md §6](../../beta-prd.md)
  flags as the most likely contract-leak site.

- **T4 — The update loop vN → vN+1.**
  Bump `@press/cms`, re-boot, and run the contract verification (§7). This is the
  Q2 proof.

## 6. Update-cycle methodology

**Local registry — Verdaccio.**
Publish `@press/cms@0.1.0`, then `@0.2.0`, to a local Verdaccio registry and run
a real `npm update @press/cms` against it. A pnpm `workspace:*` link would not
exercise real version resolution; Verdaccio makes the PRD's literal
`npm update @press/cms` flow testable.

**vN+1 must carry a real change, not a no-op.**
A no-op bump proves nothing. v0.2.0 must change engine **internals** while
keeping the **public contract** stable. At least one of:

- Restructure the plugin's internal folder layout.
- Rename an **internal** field on a reference block (public block type unchanged).
- Change an engine-internal `register`/`bootstrap` detail.

The public contract held stable across the bump: the public block type/`__component`
identifier and the custom-block interface used by `apps/cms/src/components/custom/`.

## 7. Acceptance criteria — testable "non-breakage"

After `npm update @press/cms` (v0.1.0 → v0.2.0):

1. **Allowed delta only.** The *only* permitted on-disk change in the Project
   zone is the `@press/cms` version in `apps/cms/package.json` plus the lockfile.
   Every other Project-zone path (`config/`, `src/`, `press.config.ts`, `.env`)
   must be **byte-identical**, verified by `git diff`.
2. **Still builds.** The host build succeeds.
3. **Still boots.** Strapi boots; the admin shows engine content-types, reference
   blocks, and the adopter's custom block; the page Dynamic Zone still renders all
   blocks.
4. **Deploy.** Treated as a documentary check for the spike (config still valid),
   not an executed deploy. Real deploy is deferred (§9).

Any required change inside the Project zone beyond the allowed delta is a
**contract leak** — the central defect class, and a release blocker per
[beta-prd.md §8](../../beta-prd.md).

## 8. Contract test (reusable deliverable)

A contract script that becomes the seed of the CI guard the PRD §8 asks for
("snapshot/contract tests in CI that fail on any Project-zone change after a
simulated update"):

1. Snapshot the Project zone (hashes of all files except the allowed delta).
2. Run the simulated `npm update @press/cms`.
3. Re-snapshot; **fail** if anything outside the allowed delta changed.
4. Run build + boot smoke checks.

Because the deliverable is foundational, this script is kept and hardened, not
discarded.

## 9. Out of scope

- `@press/web`, and the CMS↔web type-sync contract.
- Real deploy execution (managed and self-hosted) — documentary check only here.
- A second front-end framework or CMS.
- Admin auth beyond the Strapi default.
- Telemetry, SEO defaults, sitemap/robots.

## 10. Risks & stop signals

| Risk | Signal | Response |
|---|---|---|
| Components not shippable by plugin (A) **nor** injectable programmatically (B) | T1/T2 fail on both paths | **Stop signal C.** Reference blocks would be forced into the owned host = structural leak. Contract is weaker than specced — revisit beta-prd.md before continuing. |
| Admin build does not surface plugin-provided components | T2 admin check fails on A | Degrade to B; if B's admin also fails, document as a hard limitation. |
| `npm update` rewrites more of `package.json` than the dependency range | T4 acceptance #1 fails on an unexpected field | Investigate whether the extra change is npm-mechanical (acceptable, refine the allowed-delta definition) or engine-induced (a real leak). |
| Strapi 6 lands during the spike | n/a | Out of spike scope; pin Strapi 5.x for the spike, record the pin in this spec's results section. |

## 11. Definition of done

The spike is done when **either**:

- **A or B passes** all §7 acceptance criteria across the v0.1.0 → v0.2.0 loop, the
  chosen path's skeleton (`packages/press-cms/` + `apps/cms/`) is committed, and the
  contract test (§8) is green — **or**
- **The stop signal (§10, path C)** is reached and recorded, with evidence of why
  both A and B leak.

Either outcome is a credible answer to beta-prd.md Risk #1. The decision and its
evidence are recorded in a **results section appended to this spec** (and promoted
into `ARCH.md` if and when that document is (re)created).
