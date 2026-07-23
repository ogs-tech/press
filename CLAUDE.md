# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`press` is a CLI/engine for content-driven sites on **Strapi 5 + Next.js**, where the
whole stack ships as a versioned, updatable npm dependency. The core thesis: the
adopter owns a thin **Project zone** (`press.config.ts` + custom blocks); the engine
*materializes and runs* everything else. This monorepo develops the engine and
dogfoods it through `apps/playground`.

## Layout — four engine packages + the dogfood

- `packages/shared` — `@ogs-tech/press-shared`: the wire contract — the (still
  type-only) `PressSchema` shape PLUS the `PressTree` node types and the pure,
  sanitizing `validatePressTree`/`validateNodeArray` validators. Ships TS source
  (no build) but is **no longer type-only-consumed**: it is a PUBLISHED runtime
  dependency — `cms` bundles it into its compiled `dist` (a devDependency there;
  `strapi-plugin build` inlines it) and `web` depends on it directly (an
  adopter-installed package, transpiled by the Next host's `transpilePackages`
  like `press-web` itself). Zero Strapi/Next imports either way, so the same
  validator runs unmodified on the cms write path and the web render path.
- `packages/cms` — `@ogs-tech/press-cms`: a Strapi 5 **plugin**. Owns the `page` and
  `site-setting` content-types, injects the `preset-*` component palette, and serves
  `GET /api/press/schema`. Compiled with `strapi-plugin build`.
- `packages/web` — `@ogs-tech/press-web`: the Next.js host template, composition-tree
  renderer, runtime CLI (`press dev/build/upgrade`), config helpers, and CMS→TS
  type-sync. Ships TS source (no build).
- `packages/cli` — `@ogs-tech/create-press`: the run-once scaffolder behind
  `pnpm create @ogs-tech/press`. Pins engine versions via a generated versions file.
- `apps/playground` — committed real scaffold output, consumed via `workspace:*` for a
  fast dev loop. It is its own nested workspace (its `packages/cms` + `packages/shared`
  are members).

## Commands

Root requires **Node 20.x** and **pnpm 10.x**.

| Command | What it does |
| --- | --- |
| `pnpm install` | Install from the repo root. |
| `pnpm build` | `turbo run build` — only `cms` actually compiles (`strapi-plugin build`); `web`/`shared` ship source. |
| `pnpm -r test` | Run the vitest suites across `cli`, `web`, `cms`. |
| `pnpm -r --if-present typecheck` | `tsc --noEmit` per package. **There is no eslint** — typecheck + tests are the quality gate. |
| `pnpm dev` | Boot the dogfood playground (`press dev`: cms `:1337/admin` + web `:3000`); recreates `apps/playground` from the live scaffold when absent. Force-recreate: `pnpm exec tsx scripts/create-playground.ts`. |
| `pnpm pack:check` | `pnpm build` + dry-run publish of the engine packages. |

Focused / single test:

- `pnpm --filter @ogs-tech/press-web test src/generator/generate.test.ts` — one vitest file
- `pnpm --filter @ogs-tech/press-web test -t "renders heading"` — by test name
- `pnpm --filter @ogs-tech/create-press test` — CLI unit contracts
- `pnpm --filter @ogs-tech/press-cms test:ts:back` — Strapi backend `tsc` typecheck (cms has no vitest config; its `test` runs vitest with defaults)

Release (changesets): add a changeset under `.changeset/` for any engine change, then
`pnpm version-packages` (bumps + regenerates the CLI's pinned versions) and
`pnpm release` (build + `changeset publish`).

## Architecture — the moving parts

### Composition trees (`PressTree`)

Page `body` and Site Settings `pageDefaults` are no longer Dynamic Zones — both are
a JSON **composition tree**, `PressTree` (`@ogs-tech/press-shared`, `src/tree.ts`),
stored by one custom field, `plugin::press-cms.builder` (registered in
`server/src/register.ts`, `type: 'json'`; the admin Input is `builder-input.tsx`,
labelled "Composition"). `page.body` stores a full tree (`{ version, root }`);
`site-setting.pageDefaults` stores the same node shapes as a bare `{ header:
Node[]; footer: Node[] }` pair (`options: { mode: 'slots' }` on the field tells the
Input which shape to render).

- **Node kinds** (`Node = RowNode | ColumnNode | BlockNode`): the tree root is
  always a `LayoutNode` — `header`/`footer` are `Slot`s (`{ mode: 'inherit' }` |
  `{ mode: 'none' }` | `{ mode: 'custom'; children }`), plus top-level `children`.
  A `RowNode` carries 1–`MAX_COLUMNS` (12) `ColumnNode` children (no shared
  row-level ratio); each `ColumnNode` carries a `span` (`ColumnSpan`: `{ base;
  md?; lg? }`, `base` required, each tier 1–12 tracks, mobile-first) — the ONE
  responsive value stored in the tree — and is the recursion point: it nests
  arbitrary further `Node`s, including more rows, to unlimited depth; a
  `BlockNode` is a placed component.
- **The ONE `container` attr surface** (`ContainerAttrs`: `width | gap |
  verticalAlign`) is carried by every children-bearing node (layout root, row,
  column) as an optional `container` field. An attr that doesn't apply to a node
  type is ignored by the renderer and hidden by the builder form — never an
  error; an absent field (or the whole group) means the engine default.
  Column `span` (per-breakpoint, mobile-first) is the ONE responsive value the
  composition JSON carries — a deliberate reversal of the old
  "responsiveness never in the JSON" rule. Everything else stays code-side:
  `container` attrs are editorial intents only, mapped to `Responsive<T>`
  layout-primitive props by `web/src/tree/container-attrs.ts` (`GAP_TIERS`).
  `spanFor(column)` now passes the stored span straight to `<Column>` — the old
  `RATIO_SPANS`/`RATIO_SLOTS`/`setRowRatio` mapping table is retired.
- **Ids are builder-minted** (`crypto.randomUUID`), used only as React keys and as
  the addressing scheme for builder mutations (`tree-ops.ts`) — never an `Entity`,
  never a URN (see "Canonical identity" below: this is the one identity class kept
  deliberately OUT of the URN system).
- **Version-gated readers.** `PRESS_TREE_VERSION` (currently `2`) is served as
  `tree.version` in `/api/press/schema`; `validatePressTree` rejects any other
  `version` outright (fail-to-empty) — this is the seam a future tree migration
  hangs off.
- **Strict-write / tolerant-read validator split**, one shared implementation
  (`validate-tree.ts`) both sides import: structural failures null the value and
  land in `errors`; invalid container-attr values are stripped (attr-level failure
  never becomes tree-level) and land in `warnings`; an unknown slot `mode`
  degrades to `none` with a warning. **Writers reject on errors OR warnings**
  (cms `beforeCreate`/`beforeUpdate` lifecycle guards, `validate-write.ts` —
  the builder UI can't produce an invalid tree, so this backstops direct API
  writes only). **Readers render whenever `value` is non-null** (web sanitizes
  and renders best-effort: `TreeRenderer`, `map-site-settings.ts`).
- **Serve-time hydration** resolves `{ assetId }` (media) and `{ documentId }`
  (page relation) references to fresh values — a schema-driven walk
  (`cms/.../lib/hydrate-tree.ts`, batched per-request in `serve-hydrated.ts`) that
  never hardcodes block shapes, so the wire never rots and internal links survive
  page renames. This is the direct replacement for the old populate bug class:
  **`dz-populate`/`buildBodyPopulate` are gone** — there is no populate depth
  limit to fight because the tree carries its own refs and the cms resolves them
  before the response leaves.

### Layout primitives (`packages/web/src/layout/`)

Engine-owned responsive layout is code, not content. Four React primitives —
`Container`, `Grid`, `Row`, `Column` — live in `packages/web/src/layout/`,
exported from `@ogs-tech/press-web`. Every primitive emits semantic HTML +
`data-press-layout="<primitive>"` + per-instance CSS custom properties; visual
rules read the vars via a `var(a, var(b, var(c, default)))` cascade in
`theme.css` so three-tier responsive behavior (`base 0` / `md 768px` /
`lg 1024px`) is expressed in CSS with zero runtime JS. The `Responsive<T>` prop
shape (`T | { base: T; md?: T; lg?: T }`) is uniform across every responsive
primitive prop. Container is the one non-responsive primitive — it picks a
single tier from a fixed width scale (`prose | sm | md | lg | xl | full`).
Two CSS subtleties are load-bearing: (1) Column's span rides on
`grid-column-END` — the `grid-column: span N` shorthand stores the span in the
START longhand, so a later `grid-column-start: auto` (the undeclared-`start`
case) would erase it and collapse every column to one track. (2) A 12-track
grid always carries 11 interior column-gaps, so a Grid's minimum width is
`11 × gap` even when every column spans 12 — a flat `gap="lg"` (48px) means a
528px floor that overflows phones; organisms declare a tier-scaled gap
(`{ base: 'md', lg: 'lg' }`, the Hero pattern) instead.

**`TreeRenderer` is the primitives' first consumer.** `web/src/tree/tree-renderer.tsx`
maps tree nodes onto the primitives directly: a TOP-LEVEL `RowNode` becomes
`<Container maxWidth={row.container.width}><Grid>…</Grid></Container>` (width
applies only here, per the container-attrs contract above); a NESTED row (inside
a column) becomes a bare `<Grid>` — it fills its parent cell, no `Container` of
its own; each `ColumnNode` becomes `<Column span={…}>` wrapping a
`[data-press-cell]` div that stacks its children (gap/align read off that
column's `container` via `container-attrs.ts`). This is the mechanism behind the
tree's row/column recursion — arbitrary nesting depth costs nothing extra
because every level is just another `Grid`/`Column` pair. A column's
`<Column span>` now comes from its own stored `ColumnSpan` (`spanFor(column)` —
a passthrough); the retired `RowNode.ratio` no longer exists, so `spanFor`
takes the column, not `(ratio, index)`. `theme.css` and the four primitives
are untouched — `ColumnSpan` already matches the `Responsive<Span>` the
`<Column>` primitive consumes, and the `--press-col-span[-md|-lg]` var()
cascade handles mobile-first inheritance.

**Retired with the ratio→span change:** `RATIO_SPANS` (web,
`container-attrs.ts`), `setRowRatio`/`RATIO_SLOTS` (cms admin, the old builder
row-ratio control), and `MAX_ROW_COLUMNS` (shared validator, the old 1–4
column cap) are all gone; the builder's own `MAX_COLUMNS` is now 12.

**Why two surfaces named `layout`.** (1) DEV-facing — the React primitives above,
consumed by `TreeRenderer`, engine organisms, future page-set-plugin templates,
and adopter custom blocks. (2) CMS-facing — the `preset-layout` Atomic Design
category is no longer reserved-empty: `preset-layout.container/row/column` are
the composition tree's own node-shape descriptors, pure schema the builder's
admin form generator (`admin/src/lib/form-model.ts`) reads to build the row/column
edit forms. `container` is the ONE shared `ContainerAttrs` surface — row and
column both reference it via a `component:` field, so the "Container" form
section is defined exactly once and shared by both node types. None of the three
is ever directly PLACEABLE as a tree block: the builder's "Add node" picker
excludes the whole category (`NON_PLACEABLE = /^preset-(molecule|config|layout|
template)$/` in `form-model.ts`) — a row/column is minted structurally (the "Add
Row" control, or column recursion), never chosen from the palette like a block is.

**Data-attr namespace is distinct from blocks.** Primitives use
`data-press-layout="<primitive>"`, deliberately not `data-block="preset-*"`.
Primitives are never tree nodes themselves — no `component` uid, no `id`, no
entry in the generated `PageBody` (`= PressTree`) interfaces; `TreeRenderer`
instantiates them internally (above) to realize a row/column node's layout, but
the JSON never names them.

**Breakpoints are TS constants, not CSS vars.** `@media (min-width: var(--x))`
is unsupported in production browsers, so `BREAKPOINTS` in
`src/layout/breakpoints.ts` and the literal pixel values in `theme.css` media
queries are the two sources — `src/layout/breakpoints.test.ts` reads
`theme.css` and asserts both sides match, catching any drift.

**Tokens live in `FIXED_TOKENS`, not adopter config.** Container widths,
`paddingX`, and the three grid gap sizes are engine-fixed (same policy as
`--press-space-*` / `--press-text-*`). Values are duplicated literals — not
`var()`-referenced against `--press-space-*` — because FIXED_TOKENS is the
source of truth and cross-referencing scales makes future edits fragile. Every
new var goes through `buildThemeStyle`'s single `:root` injection point.

**Shell is full-width; atoms preserve prose width via a selector — scoped to
`<main>`'s DIRECT children only.** `main` has no `max-width`; a single rule
(`main > [data-block^="preset-atom."], main > [data-block^="custom-atom."] {
max-width: var(--press-container-prose); … }`) restores ~72ch editorial reading
width for every preset atom AND every custom atom placed at the TOP of the tree
(a body-level block, or the top level of an inherited/custom chrome slot) —
without touching a single atom `.tsx`. The child combinator (`>`, not a
descendant selector) is load-bearing post-tree: once composition trees let an
atom nest inside a row/column, that atom is no longer a `<main>`-direct child
and correctly inherits its grid cell's width instead of the prose clamp — a
`50-50` row's paragraph fills half the container, per the ratio's editorial
intent, rather than being force-clamped to a fixed 72ch that could overflow a
narrow cell. The `prose` token is
**rem-anchored** (`42rem` ≈ 72ch at the 16px body size) on purpose: a `ch`
value resolves against each consuming element's font, which would give a 28px
heading a ~2× wider "prose" column than a paragraph — the editorial column
must be identical for every atom. The column is **left-aligned to the lg
container rail**, not viewport-centered: its margin-start mirrors the
`<Container maxWidth="lg">` centering math + gutter, so atoms share one left
axis with hero/cta/callout at every viewport (a centered narrow column next to
lg organisms produced a zig-zag of left edges). Organisms and non-atom customs are excluded
on purpose: they own their own `<Container>` (the scaffold's example `Callout`
demonstrates the pattern). Header and footer chrome shells keep only the
border stroke + vertical padding; horizontal composition is the refactored
organisms' job — and BOTH chrome organisms (Navbar, Footer) use
`maxWidth="full"`: chrome is edge-to-edge, content Containers are the
constrained ones.

**Mobile nav is the one client-side responsive component.** `chrome/mobile-nav.tsx`
is a `'use client'` hamburger + drawer mounted inside `Navbar`, matched by CSS
media queries to the desktop nav Row (`[data-navbar-desktop]` visible ≥768px;
`[data-mobile-nav="toggle"]` visible <768px). Escape closes; a backdrop click
closes only when the click target IS the backdrop (`target === currentTarget` —
clicks inside the panel never close); body scroll locks while open — which is
why the drawer panel itself scrolls (`max-height` + `overflow-y: auto` +
`overscroll-behavior: contain`), or a long menu's tail would be unreachable;
aria-expanded/aria-modal wired; focus moves to the first link on open and
restores to the toggle on close. Deliberate exception to the
"server-first, zero-runtime layout" default — a viewport-observer approach
would drag the entire layout system into client-space; a fixed CSS breakpoint
+ small toggle state is the minimal viable contract.

### Materialization (`.press/web`)

The Next host is **not** scaffolded. `packages/web/templates/host/` is copied to
`<project>/.press/web/` on every `press dev`/`build` (`web/src/materialize.ts`). It
lives *inside* the project tree so Node resolution reaches the root `node_modules`
(`press-web`, `next`, `react`) and the adopter's `blocks/custom/`. `.press/` is
engine-owned, gitignored, regenerated every run — **never hand-edit it** (same for the
materialized `press-config.ts` / `press.blocks.ts` inside it).

### The contract + type-sync loop

1. cms serializes its **runtime view** — the `page` and `site-setting` content-types
   plus the FULL registered palette (every `preset-*` + `custom-*` component uid)
   — to `GET /api/press/schema` (`cms/.../lib/serialize-schema.ts`), plus
   `tree.version` (`PRESS_TREE_VERSION`). There is no Dynamic Zone admission list
   left to walk: `body`/`pageDefaults` reference components by uid at arbitrary
   depth via the `plugin::press-cms.builder` custom field, so the palette is
   exactly "every component the registry knows about that belongs to press".
   Reading the live registry means the schema can never disagree with what
   Strapi actually serves.
2. web's generator (`web/src/generator/generate.ts`) turns that JSON into
   framework-agnostic TS, written to the adopter's `shared/types/generated.ts`:
   every component becomes a plain data-shaped interface — no `__component`
   discriminator, no `id` (those exist only on tree `Node` wrappers, never on a
   generated component type); the page-picker relation (`preset-molecule.link`'s
   `page` field) emits as `PressPageRef` (`{ documentId; slug? }`); media emits as
   `PressMedia`; and `PageBody = PressTree` (imported type-only from
   `@ogs-tech/press-web`, which re-exports it from `@ogs-tech/press-shared`). The
   old `HeaderBlocks`/`FooterBlocks` unions are gone — chrome is just `PressTree`
   node slots now, not a distinct generated shape.
3. The wire shapes — `PressSchema` (still type-only) and the `PressTree`/validator
   types (now a runtime dependency, see the `packages/shared` bullet above) — are
   single-sourced in `@ogs-tech/press-shared`. The generator references **no
   Strapi types** on purpose. `press dev` re-syncs whenever the schema changes
   (`util/watch-schema.ts`). The ~2s poll is deliberately absent from the cms http
   log: the plugin drops that one line in development (`lib/quiet-schema-log.ts`)
   — don't "fix" the silence.

### Component palette — Atomic Design (`{owner}-{layer}.{name}`)

The palette is a unified Atomic Design model with ONE naming scheme: `{owner}-{layer}`
is the Strapi category, `{name}` the component. Owner ∈ `preset` (engine) | `custom`
(adopter); layer ∈ `atom | molecule | organism | config | layout | template`. The old
ad-hoc `press.*`/`section.*`/`chrome.*` prefixes are gone — this model replaced them
(a wire-breaking rename; fine pre-release). The word "press" survives only as the
PRODUCT/plugin id (`plugin::press-cms.*`, `/api/press/schema`), never as a category.

The palette is now a **pure schema catalog** — nothing is "admitted" anywhere. There
is no Dynamic Zone left to gate membership, so a component's uid and its registry
schema are the entire contract; the tree references components by uid at any depth,
and the serializer/builder simply discover "every component the registry knows
about that belongs to press" (`serialize-schema.ts`, `admin/src/lib/form-model.ts`).

- **Preset (engine) — the category IS the atomic LAYER.** Injected into the components
  registry during `register()` (`cms/.../lib/inject-components.ts`), since Strapi only
  scans the *host app's* `src/components`. `PRESET_LAYERS` is the single source of truth
  for the layer set; each entry registers under `preset-${layer}`:
  - `preset-atom.*` — paragraph, heading, list, quote, image, button, separator, spacer.
    Text atoms store **curated PLAIN TEXT**, not a Strapi blocks-editor AST: paragraph's
    `content` is `text` (a blank line starts a new paragraph — `splitParagraphs` in
    `web/src/blocks/paragraph.tsx`); list's `content` is `text`, one item per line. The
    blocks AST left the wire with this refactor — there is no `renderBlocks` anymore.
  - `preset-molecule.link` — the engine's ONE link concept (`label`/`page`/`url`/`newTab`):
    an internal page relation (survives renames, resolves to a fresh slug) takes
    precedence over a raw `url`. Referenced by `preset-atom.button`, `preset-organism.hero`
    (`cta`), `preset-organism.cta` (`button`), and `preset-organism.navbar` (`items[]` +
    `cta`) — this is the ONE nesting pattern the retired `nav-item`/`column` molecules used
    to each solve narrowly; a nav item was exactly a link, so it's gone, replaced by `link`
    itself. Never placed as a top-level tree block.
  - `preset-organism.*` — hero, cta (page body) **and** navbar, footer (site chrome): one
    layer, unified from the old `section.*`/`chrome.*` palettes. The old `columns` organism
    is RETIRED — its job (2–4 column layouts, closed `ratio`/`gap`/`verticalAlign` enums) is
    now native tree recursion (`RowNode`/`ColumnNode`, unlimited depth), not a discrete block.
  - `preset-config.*` — seo, theme-colors, theme-radius, cookie-consent, cookie-category:
    non-block settings referenced by `component:` fields on Site Settings, never a tree node.
  - `preset-layout.{container,row,column}` — no longer reserved-empty: pure registry
    descriptors the builder's admin form generator reads to build the row/column edit forms
    (see "Layout primitives" above for the full mechanics). Never placed as a tree block
    either — structural nodes are minted by the builder UI, not chosen from the palette.
  - `preset-template` is RESERVED (labelled, no components yet) — page-set plugins.
- **Placement is UNIVERSAL for every placeable component — preset and custom alike.**
  The old per-content-type `schema.json` placement lists (and the preset/custom asymmetry
  they encoded — "a hero is body-only, a navbar is chrome-only") are gone along with the
  Dynamic Zones that hosted them. The builder's "Add node" picker (`paletteGroups` in
  `form-model.ts`) offers the exact SAME full palette to every slot — page body, header,
  footer — filtered only by one `NON_PLACEABLE` regex (`preset-(molecule|config|layout|
  template)`; nested-only/settings/descriptor categories are never directly addable,
  whether preset or custom). The tree has no notion of "where a component belongs" —
  an editor could technically drop a navbar into the page body; that judgment is now
  entirely theirs, not a schema-enforced rule.
- **Custom (adopter) — the category is the atomic LAYER too; discovery, not admission.**
  The adopter drops a component under `src/components/custom-${layer}/` (e.g.
  `custom-organism/`); Strapi derives the `custom-${layer}` category from the folder.
  There is no more `admitCustomBlocks` step — every `custom-*` block (legacy bare
  `custom.*` still matches, for migration) is discovered straight from the components
  registry by `isCustomBlockUid` (`inject-components.ts`), used identically by
  `serialize-schema.ts` and the builder's palette. The engine NEVER names individual
  adopter blocks; the `custom-*` category prefix is the whole extension-point contract —
  it no longer carries any placement meaning either, now that placement is universal.
- **Navbar/footer hydration is now ONE hydration point for the whole tree.**
  `preset-organism.navbar`'s `items` are `preset-molecule.link[]` (not `nav-item[]`
  — a nav item was exactly a link); its `cta` is an optional `preset-atom.button`.
  Brand (logo + name) is never stored on the block — `resolveTree`
  (`web/src/tree/resolve-slots.ts`) hydrates it, plus every engine link field
  (`LINK_FIELDS`: navbar `items`/`cta`, `preset-atom.button.link`,
  `preset-organism.hero.cta`, `preset-organism.cta.button`) via `resolveLink`, for
  engine blocks WHEREVER they sit in the tree — page body, an inherited default, or
  page-custom chrome all resolve through the same function; adopter data passes
  through untouched (custom blocks resolve their own links via `<PressLink>`).
  `seedSiteSetting` seeds `pageDefaults.header: [preset-organism.navbar]`,
  `.footer: [preset-organism.footer]` exactly once (plugin-store flag
  `pageDefaultsSeeded`) as BARE blocks (no items/cta, fresh builder-minted ids) —
  Strapi can't tell a never-touched slot from an editor-emptied one, so after that
  one pass the defaults are never rewritten again. The CLI's `seed.mjs` fills real
  navigation (Home via a `preset-molecule.link` page ref, external GitHub, a
  "Get started" CTA) in the same idempotent pass that fills identity.
- **Picker presentation:** every engine component JSON still sets `info.icon` (Strapi's
  fixed icon enum) and the plugin's `./strapi-admin` bundle (`cms/admin/src/index.ts`)
  still registers `preset-*`/`custom-*` category labels via `registerTrads` (kept for any
  native Strapi component picker an adopter's own Dynamic Zone might use). But the
  composition builder's OWN "Add node" control (`AddControls` in `admin/src/components/
  tree-editor.tsx`) has its own palette select: an `<optgroup>` per category, grouped by
  `paletteGroups`, labelled with the RAW category string (no react-intl — this is
  plugin-owned React, not Strapi's content-manager DZ UI) and excluding the
  `NON_PLACEABLE` categories from the previous bullet. Labels are presentation-only;
  uids never change for display. Adopter `src/admin/app.tsx` translations still override
  the engine's for the legacy-picker path.
- **Page templates:** the once-shipped "Privacy Policy" bootstrap seed was RETIRED;
  what remains is `lib/seed-page.ts` — a generic, idempotent `seedPage(strapi, opts)`
  primitive (flag-first, slug-collision-respecting, DRAFT-only) that is deliberately
  exported-but-unused, awaiting future page-seeding consumers (Plugin/Legal,
  archetype templates). `bootstrap()` seeds NO page today; the only page an adopter
  starts with is the CLI seed's published `home`.
- On the web side, `TreeRenderer` (`web/src/tree/tree-renderer.tsx`) merges the engine
  registries with the adopter map by `component` uid: `{ ...atomBlocks, ...organismBlocks,
  ...components }` — engine `preset-atom.*` atoms (`src/atom-blocks.ts`), engine
  `preset-organism.*` organisms (`src/organism-blocks.ts`, sections + chrome unified),
  then the adopter's **explicit** `customBlocks` map (no global registry). Adopter blocks
  win last, so any `preset-organism.*` is overridable via
  `components={{ 'preset-organism.hero': MyHero, 'preset-organism.navbar': MyNavbar }}` —
  this override contract is UNCHANGED from the old `BlockRenderer` (now `TreeRenderer`;
  the DZ mechanism it replaced is gone, but the merge order and the override prop shape
  are the same). An unknown component is skipped with a dev-only warning, never a crash.

### Build-time anchors vs. runtime Site Settings

This split is recent and easy to get wrong:

- `press.config.ts` (Project zone, repo root) carries **build-time anchors only**:
  `routes.home`, `theme.name` (the `<html data-theme>` selector + `ThemeName` guard),
  and `theme.fonts` (which `next/font` must know at build time). The engine **reads**
  this file but **never rewrites** it. A destructive `ThemeName` change fails `tsc`
  right at the `defineConfig` call site.
- **Identity, SEO, theme color/radius VALUES, and the two `pageDefaults` composition-tree
  slots (header/footer)** live in the CMS **"Site Settings"** single type — edited in the
  admin's "Composition" field (the same `plugin::press-cms.builder` custom field as page
  `body`, in `slots` mode: a bare `{ header: Node[]; footer: Node[] }` pair), fetched at
  runtime by `getSiteConfig` (ISR ~60s), no redeploy. Any failure (CMS down, malformed
  record) maps as if the record were *empty* → the site renders unbranded/default-themed
  AND chrome-less rather than crashing. There is **no `press.config` fallback for
  identity** by design.
  - **Inheritance semantics:** a page's `header`/`footer` is a `Slot` — `inherit | none |
    custom`. `inherit` resolves against Site Settings `pageDefaults` at render time
    (`resolveTree`), so editing the site default updates every inheriting page on the next
    ISR cycle, no redeploy; `none` renders a bare page; `custom` is page-owned chrome that
    never reads `pageDefaults`. Strapi can't distinguish a never-touched slot from an
    editor-emptied one (both read back `[]`), so `seedSiteSetting` seeds `pageDefaults`
    exactly once (plugin-store flag `pageDefaultsSeeded`) and never rewrites it again — an
    editor-emptied default is respected forever.
  - `ResolvedPressConfig`'s old `chrome` key is now `pageDefaults: { header: Node[];
    footer: Node[] }` — RAW, unhydrated nodes; `map-site-settings.ts` only structurally
    validates each slot (`validateNodeArray`, fail-to-empty on invalid nodes). Engine-block
    hydration (brand injection, link resolution) happens at exactly ONE point, `resolveTree`
    (`web/src/tree/resolve-slots.ts`), never in the mapper.
- Routing reads only the build-time anchor, so the `/home → /` redirect stays
  deterministic and CMS-independent.

### Engine plugins + cookie consent

- **The plugin family:** `PressPlugin<Id>` (`packages/web/src/plugin.ts`) is the
  contract for optional engine capabilities — `extends Canonical<'plugin'>` with a
  SYNTHETIC `urn:plugin:{id}` (id is a compile-time constant per plugin, never
  CMS-sourced) plus the `enabled` flag. There is **no runtime registry**: each
  plugin is wired explicitly — config component on Site Settings → pure mapper →
  `ResolvedPressConfig.plugins.<key>` (a NAMED map, one required key per plugin;
  each new plugin is a deliberate press-web major) → explicit mount in the host
  `layout.tsx`. A second plugin (e.g. consent-gated third-party scripts) costs
  exactly what the first did: 1 CMS component + 1 mapper + 1 key + 1 mount line.
- **Cookie consent is plugin #1.** Config lives in the `preset-config.cookie-consent` /
  `preset-config.cookie-category` components on Site Settings (injected, never
  DZ-admitted, so — like `seo`/`themeColors` — they are OUTSIDE the type-sync
  pipeline and mirrored manually in `SiteSettingsData`/`ResolvedPressConfig`).
  Categories are a CLOSED code union (`necessary | analytics | marketing`) so
  `hasConsent('analytics')` can never drift; editors toggle/re-word categories,
  never rename keys. `necessary` is forced enabled/granted everywhere.
- **`mapCookieConsent` FAILS OPEN** — the deliberate exception to the
  identity/SEO fail-to-empty rule: CMS unreachable → banner still enabled with
  total default copy (`DEFAULT_COOKIE_CONSENT`, the DEFAULT_THEME precedent;
  copy merges with `||` so an editor-cleared `''` falls back too). A consent
  gate must not vanish on a CMS hiccup. `hasConsent` is independently
  FAIL-CLOSED: no stored decision ⇒ false for every optional category.
- **The visitor's decision is client-only state**: a versioned first-party
  cookie (`press_consent`, 180d) — cookie over localStorage so a future
  server-adjacent consumer can read it, but NEVER via `next/headers cookies()`
  in the RSC tree (that would force the whole route dynamic and poison the ISR
  cache). Anti-flash is `buildConsentBootstrapScript()` (inline `<head>` script
  stamps `<html data-press-consent="decided">` pre-paint; theme.css hides the
  banner) + a null `useSyncExternalStore` server snapshot (no hydration
  mismatch). `resetConsent()` is the minimal "change your mind" seam; a
  persistent reopen affordance is a known follow-up.
- **Seeding:** `seedCookieConsent` (flag `cookieConsentSeeded`) writes only the
  `enabled` booleans — an unsaved Strapi boolean renders as an unchecked toggle,
  contradicting the live default — while text stays empty ("no defaults
  duplicated in the CMS"). It does NOT set its flag when the Site Settings
  record is missing, so a broken bootstrap order self-heals next boot.
- **React version + admin bundle (load-bearing):** the whole monorepo is pinned
  to **React 19** via a root `pnpm.overrides` (`react`/`react-dom` = Strapi 5's
  `19.2.7`) so the Next host, the engine packages, and Strapi's admin all share
  ONE React. A React-18/19 split previously caused a duplicate-React admin crash
  ("Cannot read properties of null (reading 'useState')"). The cms plugin ALSO
  declares `react`/`react-dom` as **peerDependencies** so `@strapi/sdk-plugin`'s
  build EXTERNALIZES them (its vite config externalizes only the plugin's
  `dependencies`+`peerDependencies`) — otherwise the builder custom field bundles
  its own React copy and crashes the admin with a null hooks dispatcher. A guard
  test (`cms/server/src/lib/admin-react-externals.test.ts`) pins this, since
  build/test/typecheck all pass while only the browser catches it.
- **Testing note:** the banner's interactive tests (`// @vitest-environment
  jsdom`) use a hand-rolled `act()`+`createRoot` harness rather than
  `@testing-library/react` — a lightweight, zero-extra-dep choice (it also
  predates the React-19 unification above, which retired the earlier
  react-18/react-19 rendering split).

### Canonical identity (URNs)

- Web-only identity primitives in `packages/web/src/urn.ts`: the closed union
  `Entity` (`'page' | 'site-setting' | 'plugin' | 'component'`), the
  template-literal `Urn<E>` = `urn:{entity}:{id}`, the `Canonical<E extends
  Entity>` interface (`{ urn: Urn<E> }`), and the pure `buildUrn(entity, id)`
  factory (+ the `componentUrn(uid)` convenience) — interface + factory, no
  classes, so a urn stays a plain string across the RSC boundary. The wire/CMS
  contract is untouched: a urn is never sent or stored by press-cms.
- **Three identity CLASSES coexist — keep them straight.** (1) STORED (via
  `Canonical<E>`): a durable id fixed independent of render — `Page`
  (`urn:page:{documentId}`, attached by pure `mapPage`), `ResolvedPressConfig`
  (synthetic `urn:site-setting:default`), and `PressPlugin<Id>` (synthetic
  `urn:plugin:{id}`); the per-type id-sourcing rationale lives in the "Engine
  plugins" and "Build-time anchors" sections above, not repeated here. (2)
  TYPE-level: `component` → `urn:component:{uid}` via `componentUrn`, naming a
  palette REGISTRATION (`preset-atom.image`, `preset-organism.hero`,
  `preset-organism.navbar`, adopter `custom-*`). No object implements
  `Canonical<'component'>` — the atom/organism-block registries ARE the canonical
  base; today's one consumer is `TreeRenderer`'s "no component registered" dev
  warning (the `BlockRenderer`-era consumer of the same warning, renamed with the
  composition-builder refactor). (3) COMPUTED — **retired, not replaced 1:1**: the
  old `blockKey` formatted `Urn<string>` with `__component` as the entity segment
  (`urn:preset-atom.image:5`), keying off ephemeral DZ block ids. Tree `BlockNode`s
  carry their own builder-minted `id` (`crypto.randomUUID`, see "Composition trees"
  above) instead — `TreeRenderer` uses that `id` directly as the React key
  (`<BlockView key={node.id} .../>`), and it stays OUT of `Entity` the same way
  `blockKey` did: a tree node id is a React-key/builder-op address, never a
  durable, render-independent identity. Extending `Entity` is additive; widening a
  call site to plain `string` is not allowed.

### Versioning + upgrade

- Engine packages are versioned **independently** via changesets — `press-web` and
  `press-cms` can sit at different patch levels.
- A generated project pins `@ogs-tech/press-{web,cms}` at **exact** versions, so
  `pnpm update` is a no-op. `press upgrade` (`web/src/commands/upgrade.ts`) is the only
  coordinated path: rewrite both pins (latest per package, or an explicit target),
  reinstall, re-materialize to fail early. It never touches the adopter zone.
- The CLI bakes current engine versions into the scaffold via `gen:versions`
  (`versions.generated.ts`); CI runs `gen:versions --check` to keep it fresh.

## Conventions & gotchas

- Code comments cite **"Spec §…"** sections — historical design-spec references.
  The specs themselves were removed from the repo on purpose; **this file is now the
  living architectural reference**. Treat a `Spec §…` citation as a marker that the
  behavior was a deliberate design decision, and preserve that intent when changing it.
- Engine packages ship **TS source** (`web`/`shared` have echo-only `build`); only
  `cms` compiles. Don't introduce bundling without a reason.
- The package behind `pnpm create @ogs-tech/press` is `@ogs-tech/create-press` (the
  scaffolder) — it is run once and never added as a project dependency.
- Process orchestration is **crash-aware**: `press dev`/`build` use
  `waitForReadyOrExit` and propagate truthful exit codes — they never report a false
  success.
