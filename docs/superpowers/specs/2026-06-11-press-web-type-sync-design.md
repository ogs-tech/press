---
title: "Spec — @press/web + type-sync contract (Spec 1)"
internal_name: press-cli
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-11
updated_at: 2026-06-11
---

# Spec — `@press/web` + type-sync contract (Spec 1)

> [!NOTE]
> Spec 1 of the press beta. Depends on Spec 0 (Strapi-as-dependency, done). It
> closes the **front-end half** of the block contract the spike left open: the
> spike proved a custom block flows into the CMS dynamic zone and saves; Spec 1
> proves the same block — reference **and** custom — syncs its type and renders
> end-to-end on the front-end. See [roadmap.md](../../beta/roadmap.md) Spec 1.

**TL;DR** — Ship `@press/web` (the front-end engine) and a type-sync contract so
that a page authored in `@press/cms` renders end-to-end in a server-rendered Next
front-end, with CMS schema → TypeScript types auto-synced and consumed by the
adopter's Project zone. The highest-risk surface (PRD §6) — an adopter **custom
block** crossing CMS → types → render — is exercised for real, not with fixtures.

## 1. The question (single anchor)

> Can the press engine deliver, from a versioned `@press/web` package, the types
> and the rendering for a page authored in `@press/cms` — including the adopter's
> own custom block — so that the CMS↔front-end contract holds end-to-end without
> the adopter editing the engine?

This answers **PRD Q2** (the type/block contract CMS→front-end) for the front-end
side. Spec 0 answered it for the CMS side.

## 2. Why end-to-end, and why custom-block render now

The roadmap scope decision (2026-06-11) is **end-to-end including custom-block
render**. Rationale: the custom block is the most likely contract-leak surface
(PRD §6). Proving only reference blocks, or proving render against a captured
fixture, would leave the real risk — a custom block crossing the full CMS → type
→ render path against **real Strapi Dynamic-Zone serialization** (`__component`,
nested component shapes) — unexercised. Front-loading it makes Q2 answerable as
early as possible, at the cost of a larger spec than a reference-blocks-only cut.

**Runtime is real, not fixtured** (decision 2026-06-11): `apps/web` fetches a page
from a running `@press/cms` over REST and server-renders it. A fixture can drift
from real serialization; the contract must be tested against the real payload.

## 3. Stack & runtime

Carried over from [PRD §9](../../beta/prd.md); nothing here justifies diverging.

- **Next 15, App Router**, React Server Components. Server-rendered HTML for SEO
  (a content-driven-site requirement). Rendering strategy (SSR / SSG / ISR) is a
  later tuning knob, not a contract concern — what matters is server-rendered HTML,
  which RSC provides.
- **Tailwind** for minimal block styling (carry-over; not load-bearing for the
  contract).
- **Strapi 5.48** REST content API for data (GraphQL rejected: extra plugin,
  larger contract surface).
- **TypeScript**, **Node 20 LTS**, pnpm workspaces + Turborepo (the existing
  monorepo).

## 4. Architecture — two zones, mirroring Spec 0

The Engine/Project boundary from [PRD §4](../../beta/prd.md), now extended to the
web side.

|        | Engine zone (versioned, `@press/*`)                                                                              | Project zone (adopter-owned)                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **CMS** | `@press/cms`: + REST `page` route (DZ populate) + `/press/schema` endpoint                                       | `apps/cms/src/components/custom/callout.json` (exists, Spec 0)     |
| **Web** | **`@press/web`** (new): `BlockRenderer`, reference block `Hero`, type-sync generator, `getPage()` fetch helper, generated types | **`apps/web`** (new): thin Next host + `blocks/custom/Callout.tsx` + custom-block registration |

`@press/core` is **not** introduced (YAGNI). The type-sync generator lives in
`@press/web`; it can be extracted to a shared package when a second consumer needs
it.

### 4.1 `@press/web` — the front-end engine (Engine zone, versioned)

```
packages/press-web/                  # published as @press/web — version bumped each release
├── package.json                     # name: @press/web; exports ./, ./types, ./bin/sync-types
├── src/
│   ├── block-renderer.tsx           # <BlockRenderer blocks={...} components={...} />
│   ├── blocks/
│   │   └── hero.tsx                 # reference block press.hero (server component)
│   ├── reference-blocks.ts          # map: { 'press.hero': Hero } — engine-owned registry
│   ├── get-page.ts                  # getPage(slug) → typed Page over REST
│   └── types/
│       └── generated.ts             # type-sync output (engine zone, invisible) — gitignored
└── bin/
    └── sync-types.ts                # fetches /press/schema, emits src/types/generated.ts
```

The adopter never edits anything under `packages/press-web/`. Generated types land
**here**, not in the Project zone, so the contract stays clean by construction
(same principle as Spec 0: no generated artifact in the Project zone).

> **"Versioned" scope for Spec 1.** `generated.ts` is gitignored and regenerated on
> demand, which works because Spec 1 lives in the monorepo: `sync-types` runs
> locally before `tsc`. How a *published* `@press/web` ships its types to an adopter
> who has never booted the CMS (generate-on-publish vs. committed artifact) is the
> **update/publish path — deferred to Spec 4/5** (§9). Here "versioned" means the
> local workspace package, not the npm publish story.

### 4.2 `apps/web` — the host (Project zone, adopter-owned)

```
apps/web/                            # the thinnest Next app that renders engine pages
├── package.json                     # deps: next, react, @press/web
├── app/
│   ├── layout.tsx                   # root layout                         ← owned
│   └── [...slug]/page.tsx           # server component: getPage → BlockRenderer ← stable, owned
├── blocks/
│   └── custom/
│       └── Callout.tsx              # adopter custom block React component  ← extension point
├── press.blocks.ts                  # map: { 'custom.callout': Callout }    ← extension point
└── .env                             # CMS base URL, etc.                    ← Project zone
```

> **Mapping note.** PRD §4 names `blocks/custom/` as the custom-block location. On
> the web side a custom block is a React component (`blocks/custom/Callout.tsx`)
> paired with a registration entry (`press.blocks.ts`). The CMS-side component for
> the same block (`apps/cms/src/components/custom/callout.json`) shipped in Spec 0.

## 5. The contract surfaces (three, all engine-owned)

### 5.1 Data: REST `page` route + DZ populate

`@press/cms` ships the route currently stubbed empty
(`server/src/routes/content-api/index.ts` → `routes: []`): `GET /api/pages` /
`findOne` with the `body` dynamic zone populated, read-public for `page`. Engine-
owned and versioned — the adopter never defines it. This is the wire shape the
front-end consumes.

**Published-only + 404 (decision 2026-06-11).** `getPage(slug)` fetches **published**
content only (Strapi draft/publish: the default published view); a missing or
unpublished slug yields a 404 via the App Router's `notFound()`. Draft preview is
**out of scope** here (revisit with whitelabel/config in Spec 2). This makes
"published-only" an explicit, intentional part of the contract rather than an
implicit side effect of the fetch.

**Media.** The `press.hero` reference block carries an image, so the route populates
its media and the front-end resolves the asset URL against the CMS base. Media
serialization is therefore exercised by the e2e render (see §7 AC 1), not deferred.

### 5.2 Schema: `/press/schema` endpoint (source of truth for type-sync)

`@press/cms` exposes a public, versioned endpoint returning the content-types and
DZ components it has **registered at runtime** — `press.*` reference blocks **and**
already-admitted `custom.*` blocks. This is the type-sync source of truth.

Rationale (the type-sync golden rule): **zero re-implementation of the merge.** The
engine already admits `custom.*` into the DZ at `register` time
(`inject-components.ts`). A generator that re-derived the merged shape from loose
JSON files would duplicate that admission logic — and any divergence between what
the generator thinks is in the DZ and what Strapi actually serves is a silent
contract leak. Reading the engine's own runtime view eliminates that class of bug
and makes the schema an explicit, engine-owned contract surface.

Rejected alternatives: (2) read schema JSON from disk and merge — duplicates
admission logic, can diverge; (3) post-process `strapi ts:generate-types` output —
brittle parsing coupled to Strapi's internal `@strapi/strapi`-namespaced type
format. Both reintroduce divergence risk that (1) removes.

### 5.3 Render: `BlockRenderer` + explicit block map

`@press/web` exports `BlockRenderer`. Reference blocks are pre-registered by the
engine (`reference-blocks.ts`: `{ 'press.hero': Hero }`). The adopter passes its
own blocks **explicitly** as a prop — an explicit map, not a global mutable
registry, so behavior is deterministic under RSC/SSR (no module-singleton state):

```tsx
// apps/web/press.blocks.ts (Project zone)
import { Callout } from './blocks/custom/Callout'
export const customBlocks = { 'custom.callout': Callout }

// apps/web/app/[...slug]/page.tsx (server component)
const page = await getPage(slug)
return <BlockRenderer blocks={page.body} components={customBlocks} />
```

`BlockRenderer` merges `{ ...referenceBlocks, ...components }`, iterates the DZ
array, and for each entry looks up `__component` to pick the React component,
rendering it with the block's (typed) props. The engine **never names `callout`** —
only the `custom.*` convention is the stable contract, mirroring the CMS side.
Unknown `__component` → tolerant fallback (render nothing + dev-only warning),
never a crash — mirroring the engine's tolerant admission.

**SSR/SEO.** `BlockRenderer` and `Hero` are server components (HTML rendered on the
server). The block map accepts client components too (`'use client'`) for an
interactive custom block. The page route derives `<title>`/meta from page fields
via `generateMetadata`.

## 6. Type-sync flow

1. CMS boots (engine registered, `custom.*` admitted).
2. `pnpm --filter @press/web sync-types` fetches `/press/schema`.
3. Generator emits plain, framework-agnostic TS to
   `packages/press-web/src/types/generated.ts` (engine zone; gitignored —
   regenerated on demand, never committed, never in the Project zone).
4. `@press/web` re-exports it via `@press/web/types`; `getPage()` returns `Page`;
   `BlockRenderer` props are typed; `apps/web` imports types from `@press/web/types`.

A reference-block or custom-block schema change in the CMS, after re-sync,
propagates to the front-end types with no Project-zone edit.

## 7. Acceptance criteria — testable

1. **End-to-end render.** A real page authored in `@press/cms` (containing a
   `press.hero` with an **image** **and** a `custom.callout`), fetched over REST by
   `apps/web`, renders both blocks as server-rendered HTML. Verified by an HTTP check
   on the rendered markup (both blocks' content present, and the Hero's image `src`
   resolved against the CMS base URL — proving media serialization crosses the
   contract).
2. **Type-sync fidelity.** With the CMS booted, `sync-types` then `tsc --noEmit`
   on `@press/web` + `apps/web` succeeds; `getPage()` and `BlockRenderer` props are
   typed from the generated types, including `custom.callout`'s fields.
3. **Schema-change propagation.** Changing a block's schema in the CMS and
   re-running `sync-types` updates the generated types accordingly. Two cases, both
   required: (a) an **additive** change (new field) re-syncs and `tsc --noEmit` still
   passes; (b) a **destructive** change (removed field a consumer used) makes `tsc`
   **fail at the consumer site** — the loud-failure behavior is the pass condition,
   not silent drift.
4. **Project-zone cleanliness.** Type-sync writes **nothing** into `apps/web`;
   generated types live only in the engine zone. Verified by `git status` after a
   sync (no Project-zone change).
5. **Custom-block contract.** The engine references `press.*` only; `custom.callout`
   renders solely via the adopter's `press.blocks.ts` map. Removing that entry makes
   only the callout fall back (engine and `press.hero` unaffected) — proving the
   engine never names the adopter's block.

## 8. Definition of done

`@press/web` + `apps/web` are committed; the three engine-owned contract surfaces
(§5) exist; all §7 acceptance criteria pass; a documented run (README section or
script) reproduces the end-to-end render and the type-sync from a clean state.

## 9. Out of scope (deferred to later specs)

- **`pnpm update @press/web` non-breakage proof** (web-side analog of Spec 0's
  `contract-check.mjs`). Spec 1 *establishes* the web contract; **Spec 4** (update
  path + CI guard) *proves it survives an update*, consistent with the roadmap.
- Whitelabel `press.config.ts` consumption by `@press/web` — **Spec 2**.
- CLI `press dev / build / deploy` orchestrating CMS + web — **Spec 3**.
- Real deploy (managed + self-hosted) — **Spec 5**.
- A second front-end framework or CMS; SEO defaults beyond title/meta; sitemap/
  robots; telemetry.

## 10. Risks & stop signals

| Risk                                                                                          | Signal                                          | Response                                                                                                             |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Real Strapi DZ serialization (`__component`, nested IDs, media) doesn't map cleanly to flat TS types | Generated types don't match the REST payload at render | Adjust the generator to the real wire shape (the reason runtime is real, not fixtured); record the mapping.         |
| `/press/schema` can't be exposed publicly without leaking admin surface                        | Endpoint needs admin auth                       | Ship a dedicated minimal public schema endpoint owned by the engine (not the CTB admin API); expose only what the contract needs. |
| Custom block needs client interactivity but `BlockRenderer` is a server component              | A `'use client'` custom block fails to render   | Block map accepts client components; verify a client custom block renders under RSC.                                |
| Codegen coupled to a running CMS complicates the dev loop                                       | `sync-types` requires a booted server           | Acceptable for Spec 1 (runtime is e2e anyway); the CLI (Spec 3) wires sync into `press dev` so it's invisible later. |

## 11. Results

**Outcome: PASS.** All §7 acceptance criteria met. Engine shipped as `@press/cms@0.3.2`
(0.3.0 added `press.hero.image`; two integration fixes found at the live gates bumped
it — see "Deviations" below). `@press/web@0.1.0` consumed by `apps/web` via `workspace:*`.

- **AC1 (e2e render):** `scripts/e2e-check.mjs` → both `press.hero` (with image) and
  `custom.callout` render as server-rendered HTML; hero image `src` resolved absolute
  against `CMS_URL` (`/uploads/hero_….png` → `http://localhost:1337/uploads/…`).
- **AC2 (type-sync fidelity):** `sync-types` then `tsc --noEmit` on `@press/web` and
  `apps/web` passes; `getPage`/`BlockRenderer` props typed, incl. `custom.callout`.
- **AC3 (propagation):** additive `eyebrow?` re-syncs, both typechecks pass; destructive
  removal of `custom.callout.variant` makes `tsc` fail loudly at
  `apps/web/blocks/custom/Callout.tsx` (`Property 'variant' does not exist`). Reverted.
- **AC4 (Project-zone cleanliness):** `git status` empty after sync — `generated.ts` is
  gitignored in the engine zone; nothing written under `apps/web/`.
- **AC5 (custom-block contract):** emptying `press.blocks.ts` drops only the callout;
  `press.hero` and the engine are unaffected — the engine never names the adopter's block.

**Contract surfaces shipped (engine-owned):** REST `page` route (`/api/pages[/:slug]`,
published-only, DZ-populated, `auth:false`, `prefix:''`), `/api/press/schema` (runtime
registry view), and the existing `custom.*` admission. `@press/web` provides
`BlockRenderer`, `Hero`, `getPage`, and the `sync-types` generator.

**Key mechanics learned:** `config.auth:false` makes routes public with zero
users-permissions seeding; **plugin content-api routes are namespaced under
`/api/<plugin-id>` by default — `config.prefix:''` mounts them at the `/api` root** as
the contract requires; Strapi 5 populates a dynamic zone via the per-component `on` map,
and that populate object must be passed under the **`populate` key** (not spread into the
query root, or the DZ is silently omitted); `getPage` runs in an RSC so the data fetch has
no browser-CORS surface; the `workspace:` protocol symlinks `@press/web` despite
`.npmrc`'s registry routing. Published-`@press/web` type delivery remains deferred to
Spec 4/5.

**Deviations / fixes found at the live gates (not anticipated by the plan):**
1. **Route prefixing (→0.3.1):** plugin content-api routes mounted under
   `/api/press-cms/…`; added `config.prefix:''` so they serve at `/api/pages`,
   `/api/press/schema` as the contract specifies.
2. **DZ populate wiring (→0.3.2):** the page controller spread the populate object into
   the `findMany` root instead of assigning it to `populate:`, so pages serialized
   *without* `body`. Caught by the first real seeded fetch (AC1 prep), confirmed by an
   in-process probe, fixed.
3. **`@types/react` 18/19 skew (apps/web `tsconfig`):** this pnpm monorepo runs Strapi
   on React 18 and Next on React 19; hoisted `next` bound to the repo-root
   `@types/react@18` while the app + symlinked `@press/web` source used 19, breaking the
   AC2 typecheck. Fixed with `typeRoots` + `react`/`react-dom` `paths` scoped to
   `apps/web` (Strapi side untouched). Root cause pinned with `tsc --explainFiles`.
4. **`Block` index signature (`@press/web`):** `BlockRenderer`'s `Block` had a
   `[key:string]: unknown` index signature the sync-generated interfaces can't satisfy,
   so `PageBody` failed to type-check as `blocks` — removed (the renderer never indexed
   it dynamically).
5. **Seed Strapi boot (`scripts/seed-e2e.mjs`):** Strapi's `.mjs` build does bare
   `lodash/fp` directory imports Node's ESM loader rejects; the seed loads Strapi through
   `createRequire` (CJS) instead.
