# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`press` is a CLI/engine for content-driven sites on **Strapi 5 + Next.js**, where the
whole stack ships as a versioned, updatable npm dependency. The core thesis: the
adopter owns a thin **Project zone** (`press.config.ts` + custom blocks); the engine
*materializes and runs* everything else. This monorepo develops the engine and
dogfoods it through `apps/playground`.

## Layout — four engine packages + the dogfood

- `packages/shared` — `@ogs-tech/press-shared`: the `PressSchema` wire contract. Ships
  TS source (no build); imported **type-only** by cms + web so it never enters a
  runtime artifact.
- `packages/cms` — `@ogs-tech/press-cms`: a Strapi 5 **plugin**. Owns the `page` and
  `site-setting` content-types, injects the `preset-*` component palette, and serves
  `GET /api/press/schema`. Compiled with `strapi-plugin build`.
- `packages/web` — `@ogs-tech/press-web`: the Next.js host template, block renderer,
  runtime CLI (`press dev/build/upgrade`), config helpers, and CMS→TS type-sync. Ships
  TS source (no build).
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

**Why two surfaces named `layout`.** (1) DEV-facing — the React primitives above,
consumed by engine organisms, future page-set-plugin templates, and adopter
custom blocks. (2) CMS-facing — the `preset-layout` Atomic Design category
stays declared in `PRESET_LAYERS` and labelled in the admin picker but ships
ZERO components today. The palette is reserved for future *nested-only* config
components (pattern: `preset-molecule.nav-item`) that a future organism admits
via a `component:` field. Layout is NEVER placed by the editor as a top-level
block — the Strapi 5 constraint "a component cannot contain a `dynamiczone`"
rules out polymorphic-child nesting inside a component.

**Data-attr namespace is distinct from blocks.** Primitives use
`data-press-layout="<primitive>"`, deliberately not `data-block="preset-*"`.
Primitives never have a `__component`, never appear in `PageBody`, never flow
through `BlockRenderer`.

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

**Shell is full-width; atoms preserve prose width via a selector.** `main` has
no `max-width`; a single rule (`main [data-block^="preset-atom."],
main [data-block^="custom-atom."] { max-width: var(--press-container-prose);
… }`) restores ~72ch editorial reading width for every preset atom AND every
custom atom — without touching a single atom `.tsx`. The `prose` token is
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
   plus exactly the components admitted into the three engine Dynamic Zones (page
   `body`, site-setting `header`/`footer`), following nested component references —
   to `GET /api/press/schema` (`cms/.../lib/serialize-schema.ts`). Reading the live
   registry means the schema can never disagree with what Strapi actually serves.
2. web's generator (`web/src/generator/generate.ts`) turns that JSON into
   framework-agnostic TS, written to the adopter's `shared/types/generated.ts`.
3. The shape — `PressSchema` — is single-sourced in `@ogs-tech/press-shared` and imported
   **type-only** by both sides. The generator references **no Strapi types** on
   purpose. `press dev` re-syncs whenever the schema changes (`util/watch-schema.ts`).
   The ~2s poll is deliberately absent from the cms http log: the plugin drops that
   one line in development (`lib/quiet-schema-log.ts`) — don't "fix" the silence.

### Component palette — Atomic Design (`{owner}-{layer}.{name}`)

The palette is a unified Atomic Design model with ONE naming scheme: `{owner}-{layer}`
is the Strapi category, `{name}` the component. Owner ∈ `preset` (engine) | `custom`
(adopter); layer ∈ `atom | molecule | organism | config | layout | template`. The old
ad-hoc `press.*`/`section.*`/`chrome.*` prefixes are gone — this model replaced them
(a wire-breaking rename; fine pre-release). The word "press" survives only as the
PRODUCT/plugin id (`plugin::press-cms.*`, `/api/press/schema`), never as a category.

- **Preset (engine) — the category IS the atomic LAYER.** Injected into the components
  registry during `register()` (`cms/.../lib/inject-components.ts`), since Strapi only
  scans the *host app's* `src/components`. `PRESET_LAYERS` is the single source of truth
  for the layer set; each entry registers under `preset-${layer}`:
  - `preset-atom.*` — paragraph, heading, list, quote, image, button, separator, spacer.
  - `preset-molecule.nav-item` — nested inside the navbar; never a DZ member.
  - `preset-organism.*` — hero, cta (page body) **and** navbar, footer (site chrome):
    one layer, unified from the old `section.*`/`chrome.*` palettes.
  - `preset-config.*` — seo, theme-colors, theme-radius, cookie-consent, cookie-category:
    non-block settings referenced by `component:` fields on Site Settings, never a DZ member.
  - `preset-layout` is RESERVED (labelled, no components yet). The Grid System
    task shipped the DEV-facing layout primitives under
    `packages/web/src/layout/` (see "Layout primitives" above); the CMS-facing
    category stays labelled and empty, seat for a future *nested-only* config
    component (pattern: `preset-molecule.nav-item`) that a future organism admits
    via a `component:` field.
  - `preset-template` is RESERVED (labelled, no components yet) — page-set plugins.
- **Preset PLACEMENT is declared statically, per content-type — NOT by the category.**
  The category carries the layer; where a preset block may go is listed in each
  `schema.json`: `preset-atom.*` in all three engine DZs (page `body`, site-setting
  `header`/`footer`); `preset-organism.hero`/`.cta` in the page `body` only;
  `preset-organism.navbar`/`.footer` in `header`/`footer` only. This is why organisms
  span placements (a hero is body-only, a navbar is chrome-only) while sharing one
  category — placement lives in the schema, not the uid. Because the engine names its
  OWN blocks, per-block placement never violates the "never name individual blocks" rule
  (that rule protects the *adopter* extension point below).
- **Custom (adopter) — the category is the atomic LAYER too; placement is UNIVERSAL.**
  The adopter drops a component under `src/components/custom-${layer}/` (e.g.
  `custom-organism/`); Strapi derives the `custom-${layer}` category from the folder.
  Every `custom-*` block (legacy bare `custom.*` still matches, for migration) is
  admitted into EVERY engine DZ by `admitCustomBlocks` — the editor decides placement in
  the picker. The engine NEVER names individual adopter blocks; the `custom*` category
  prefix is the whole extension-point contract. (Deliberate asymmetry: the engine curates
  its own blocks' placement tightly in `schema.json`; adopter blocks are unrestricted —
  control differs, the layer axis is shared.)
- **Navbar/footer hydration:** `preset-organism.navbar` nests `preset-molecule.nav-item[]`
  + an optional `preset-atom.button` cta; brand (logo + name) is never stored on the
  block — `mapSiteSettings` hydrates it (and the resolved nav links) from Site Settings
  identity before rendering (specific to `preset-organism.navbar`/`.footer`). The
  serializer follows these nested refs; the generator emits nested-only components without
  `__component` and adds `HeaderBlocks`/`FooterBlocks` unions. `bootstrap()` seeds
  `header: [preset-organism.navbar]`, `footer: [preset-organism.footer]` exactly once
  (plugin-store flag) — an editor-emptied zone is respected. The bootstrap navbar is
  BARE (no items/cta); the CLI's `seed.mjs` fills it with demo navigation (Home,
  external GitHub, "Get started" CTA) in the same idempotent pass that fills identity.
- **Picker presentation (admin bundle):** every engine component JSON sets `info.icon`
  (Strapi's fixed icon enum); the plugin's `./strapi-admin` bundle (`cms/admin/src/index.ts`)
  exists solely to `registerTrads` the category labels — the picker resolves accordion
  titles via react-intl with the RAW category string as message id (`preset-atom` →
  "Atoms", `preset-organism` → "Organisms", `custom-organism` → "Custom organisms", en +
  pt). `preset-config`/`preset-molecule` never surface in a picker but are labelled for
  completeness; `preset-layout`/`preset-template` are labelled ahead of their components.
  Labels are presentation-only; uids never change for display. Adopter `src/admin/app.tsx`
  translations override the engine's.
- **Page templates:** the once-shipped "Privacy Policy" bootstrap seed was RETIRED;
  what remains is `lib/seed-page.ts` — a generic, idempotent `seedPage(strapi, opts)`
  primitive (flag-first, slug-collision-respecting, DRAFT-only) that is deliberately
  exported-but-unused, awaiting future page-seeding consumers (Plugin/Legal,
  archetype templates). `bootstrap()` seeds NO page today; the only page an adopter
  starts with is the CLI seed's published `home`.
- On the web side, `BlockRenderer` merges the engine registries with the adopter map by
  `__component`: `{ ...atomBlocks, ...organismBlocks, ...components }` — engine
  `preset-atom.*` atoms (`src/atom-blocks.ts`), engine `preset-organism.*` organisms
  (`src/organism-blocks.ts`, sections + chrome unified), then the adopter's **explicit**
  `customBlocks` map (no global registry). Adopter blocks win last, so any
  `preset-organism.*` is overridable via
  `components={{ 'preset-organism.hero': MyHero, 'preset-organism.navbar': MyNavbar }}`.
  An unknown component is skipped with a dev-only warning, never a crash.

### Build-time anchors vs. runtime Site Settings

This split is recent and easy to get wrong:

- `press.config.ts` (Project zone, repo root) carries **build-time anchors only**:
  `routes.home`, `theme.name` (the `<html data-theme>` selector + `ThemeName` guard),
  and `theme.fonts` (which `next/font` must know at build time). The engine **reads**
  this file but **never rewrites** it. A destructive `ThemeName` change fails `tsc`
  right at the `defineConfig` call site.
- **Identity, SEO, theme color/radius VALUES, and the block-composed `header`/`footer`
  chrome** live in the CMS **"Site Settings"** single type — edited in the admin,
  fetched at runtime by `getSiteConfig` (ISR ~60s), no redeploy. Any failure (CMS down,
  malformed body) maps as if the record were *empty* → the site renders
  unbranded/default-themed rather than crashing. There is **no `press.config` fallback
  for identity** by design.
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
- **Testing note:** the banner's interactive tests (`// @vitest-environment
  jsdom`) use a hand-rolled `act()`+`createRoot` harness, deliberately NOT
  `@testing-library/react` — the workspace's `node-linker=hoisted` layout
  (required by Strapi 5) materializes only Strapi-admin's react-19 RTL variant
  at the root, which cannot render this package's react-18 elements.

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
  base; today's one consumer is `BlockRenderer`'s "no component registered" dev
  warning. (3) COMPUTED: `blockKey` formats `Urn<string>` with `__component` as the
  entity segment (`urn:preset-atom.image:5`) — a per-instance key, never stored: DZ block ids
  are ephemeral (unique only per component table), so block INSTANCES stay OUT of
  `Entity`. Extending `Entity` is additive; widening a call site to plain
  `string` is not allowed.

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
