# Press — Layout / Grid System (`preset-layout`, v1)

**Status:** Approved design · **Date:** 2026-07-16 · **Scope:** engine-owned responsive layout primitives (Container, Grid, Row, Column) consumed in code; `preset-layout` CMS palette stays reserved (no components admitted).

## 1. Context

Press today has no engine-owned layout layer. Every preset organism
(`preset-organism.hero`, `.cta`, `.navbar`, `.footer`) emits ad-hoc inner markup
(`<section>`, `<div data-hero="content">`, flexbox `<div data-block=…navbar>`) and
is styled per-instance in `theme.css`. The page shell is prose-only:
`main { max-width: 72ch }` caps every body block at editorial width — a hero
cannot go full-bleed, a 3-column feature grid cannot fit, and mobile responsiveness
is a one-off `@media (max-width: 640px)` in the navbar section.

The Atomic Design layer `preset-layout` is already declared in
`packages/cms/server/src/lib/inject-components.ts` `PRESET_LAYERS` and labelled in
the admin picker (`packages/cms/admin/src/index.ts`), but **ships zero components** —
it is reserved for exactly this task.

### The Strapi 5 constraint that shapes the design

Strapi 5 components can nest other components (single or repeatable), but a
component **cannot contain a `dynamiczone` attribute** — only content-types can.
Genuine "row/column with polymorphic children" (a Row that contains N children,
each of which is any admissible block) is therefore **not expressable** as a CMS
schema. This eliminates a purely editor-facing layout palette and forces the
design toward a hybrid: **layout is a dev-facing primitive layer, with a reserved
CMS extension point for the rare knob-config case**.

### Where this lives in the architecture

Layout is **not** page content — it is not serialized, not typed via `PressSchema`,
not admitted to any Dynamic Zone. It lives entirely in `packages/web/src/layout/`
and is consumed by:

- Engine organism code (Hero, Cta, Navbar, Footer — refactored in §8).
- Future template code shipped by page-set plugins (Site for Company, Site OGS).
- Adopter custom blocks that opt in by importing `Container` / `Grid` / etc.

The `preset-layout` category on the CMS side stays labelled but empty (§9); it is
documented as the seat for future nested-only config components (pattern:
`preset-molecule.nav-item`).

## 2. Goals

- Ship four engine-owned React primitives — `Container`, `Grid`, `Row`, `Column` —
  as `packages/web/src/layout/*.tsx`, exported from `@ogs-tech/press-web`.
- Adopt a **mobile-first responsive prop shape** `Responsive<T> = T | { base: T; md?: T; lg?: T }`
  with three tiers: `base` (0), `md` (768px), `lg` (1024px).
- Introduce fixed layout tokens under `FIXED_TOKENS` (`--press-container-*`,
  `--press-container-padding-x`, `--press-grid-gap-*`), emitted by
  `buildThemeStyle` alongside the existing `--press-space-*` / `--press-text-*` scales.
- **Rewrite the page shell** so `main` is full-width; preserve editorial width for
  atom blocks via a single CSS selector; strip layout CSS from the `<header>` /
  `<footer>` shells so refactored organisms own their containers.
- **Refactor all four preset organisms** (`Hero`, `Cta`, `Navbar`, `Footer`) to
  consume the primitives; delete the redundant flex/grid rules from `theme.css`.
- Keep the engine's contract **wire-compatible** — no change to `PressSchema`,
  `PageBody`, or any DZ; visual-only breaking change (registered in §14).

## 3. Non-goals (explicitly deferred)

- **CMS `preset-layout.*` components.** The palette stays labelled + empty. When a
  future organism needs an editor-visible layout knob (e.g. a `FeatureGrid`
  organism exposing `columns: 2|3|4` to the editor), the task that adds *that*
  organism registers `preset-layout.<name>` as a nested-only config component
  (pattern: `preset-molecule.nav-item` — see §9). This task ships **zero**.
- **Fluid card grid** (`repeat(auto-fit, minmax(...))`). Not needed by any current
  consumer. If a future organism (`FeatureGrid`, `Testimonials`) wants it, that
  task introduces a `GridAuto` primitive alongside.
- **Extra breakpoints** (`sm`, `xl`, `2xl`). Three tiers cover mobile/tablet/desktop
  cleanly for the current organisms; wider scale added only if a real consumer
  needs it.
- **Adopter-overridable layout tokens.** Breakpoints, container widths, and grid
  gaps are engine-fixed for v1 (same policy as `--press-space-*` / `--press-text-*`).
  A future task can promote any of them to overridable if the need is real.
- **`preset-template.*`.** Templates are page-set plugins (Site for Company / Site
  OGS) — separate task, separate spec.
- **JS runtime hooks** (`useBreakpoint()`, viewport observers). Server-first,
  zero-runtime; every responsive behavior expressed in CSS via `var()` cascade.
- **Reintroducing `main { max-width }`.** The prose behavior is preserved via a
  selector on atom blocks (§7.2), not by re-capping the shell.

## 4. Architecture — hybrid path

Two surfaces under one family name (`layout`):

### 4.1 Dev-facing — React primitives

`Container`, `Grid`, `Row`, `Column` in `packages/web/src/layout/`. Exported from
`@ogs-tech/press-web`. Consumed by:

- Engine organism code (all four preset organisms — §8).
- Future page-set plugin templates.
- Adopter custom blocks (`custom-organism.*`, `custom-molecule.*`) that opt in by
  importing the primitives.

Every primitive emits **semantic HTML + `data-press-layout` data-attr + inline CSS
custom properties**. Visual rules live in `theme.css` and read the custom
properties via `var()` cascade (§6.3). This mirrors the existing block/organism
pattern (`data-block="preset-atom.*"` + `theme.css`) exactly — no new toolchain,
no runtime CSS, RSC-safe.

**Data-attr namespace.** Primitives use `data-press-layout="<primitive>"`, distinct
from the `data-block="preset-<layer>.<name>"` used by DZ blocks. This is
deliberate — primitives are not blocks; they never have a `__component`, never
appear in `PageBody`, never flow through `BlockRenderer`.

### 4.2 CMS-facing — reserved layer

`preset-layout` stays declared in `PRESET_LAYERS` and labelled in the picker
(`Layout` / `Layout` in pt-BR translations), **with zero components injected**
by this task. It is the documented seat for future *nested-only* config
components (see §9), never DZ-admitted, following the `preset-molecule.nav-item`
precedent.

### 4.3 Why not editor-facing layout blocks

The Strapi 5 constraint (§1) rules out polymorphic-child nesting inside a
component. The remaining options are:

- **Flat DZ layout blocks** (a `preset-layout.section` that wraps siblings via
  CSS/DOM tricks) — introduces implicit ordering coupling in editor content,
  contradicts "editors cannot break the chrome". Rejected.
- **Nested config components** on organism schemas (e.g. Hero gains a
  `container: preset-layout.container` field) — legitimate pattern, but no
  current organism needs editor-tunable layout, so shipping the shapes now is
  speculative design. Deferred (§9).

The dev-facing primitives address the immediate consumer set (existing
organisms, future templates, custom blocks) without violating either constraint.

## 5. The primitives

Four components in `packages/web/src/layout/`, each in its own `.tsx` file with a
colocated `.test.tsx`. All accept a semantic `as` prop
(`FlowElement = 'div' | 'section' | 'header' | 'footer' | 'main' | 'article' | 'aside' | 'nav' | 'ul' | 'ol'`,
default `'div'`), all support `children: ReactNode`, and all pass through any
additional `data-*` attributes so consumers can compose with existing block hooks
(e.g. `<Container as="section" data-block="preset-organism.hero">`).

### 5.1 Shared responsive shape

`packages/web/src/layout/breakpoints.ts`:

```typescript
export const BREAKPOINTS = { base: 0, md: 768, lg: 1024 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;
export type Responsive<T> = T | { base: T; md?: T; lg?: T };

// Normalizes a Responsive<T> to a full { base, md?, lg? } record for CSS var emission.
export function normalizeResponsive<T>(value: Responsive<T> | undefined, fallback: T): { base: T; md?: T; lg?: T };
```

### 5.2 `<Container>` — width constraint + horizontal gutter

```typescript
interface ContainerProps {
  maxWidth?: 'prose' | 'sm' | 'md' | 'lg' | 'xl' | 'full';  // default 'lg'
  padded?: boolean;                                          // default true
  as?: FlowElement;                                          // default 'div'
  children: ReactNode;
  // extra data-* attrs pass through to the root element
}
```

Emits `<div data-press-layout="container" data-max-width="lg" data-padded>`. CSS in
`theme.css`:

```css
[data-press-layout="container"] {
  margin-inline: auto;
  max-width: var(--press-container-lg);
}
[data-press-layout="container"][data-max-width="prose"] { max-width: var(--press-container-prose); }
[data-press-layout="container"][data-max-width="sm"]    { max-width: var(--press-container-sm); }
[data-press-layout="container"][data-max-width="md"]    { max-width: var(--press-container-md); }
[data-press-layout="container"][data-max-width="xl"]    { max-width: var(--press-container-xl); }
[data-press-layout="container"][data-max-width="full"]  { max-width: none; }
[data-press-layout="container"][data-padded]            { padding-inline: var(--press-container-padding-x); }
```

`maxWidth="full"` deliberately emits no width token — the CSS just drops
`max-width` to `none`, avoiding an unused variable.

### 5.3 `<Grid>` — 12-column CSS grid

```typescript
interface GridProps {
  gap?: Responsive<'none' | 'sm' | 'md' | 'lg'>;              // default 'md'
  alignItems?: 'start' | 'center' | 'end' | 'stretch';        // default 'stretch'
  as?: FlowElement;
  children: ReactNode;                                        // expected: <Column>
}
```

Emits `<div data-press-layout="grid" data-align-items="center" style="--press-grid-gap-current:...">`.
Always 12 tracks. Base rules in `theme.css`:

```css
[data-press-layout="grid"] {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--press-grid-gap-current);
  align-items: stretch;
}
[data-press-layout="grid"][data-align-items="start"]  { align-items: start; }
[data-press-layout="grid"][data-align-items="center"] { align-items: center; }
[data-press-layout="grid"][data-align-items="end"]    { align-items: end; }

@media (min-width: 768px) {
  [data-press-layout="grid"] { gap: var(--press-grid-gap-current-md, var(--press-grid-gap-current)); }
}
@media (min-width: 1024px) {
  [data-press-layout="grid"] { gap: var(--press-grid-gap-current-lg, var(--press-grid-gap-current-md, var(--press-grid-gap-current))); }
}
```

The responsive `gap` prop is normalized to CSS custom properties inline; the
`var()` fallback chain gives free breakpoint inheritance.

**Why `minmax(0, 1fr)`** instead of `1fr`: prevents child overflow from expanding
the track (a common CSS Grid footgun with long words / large images).

### 5.4 `<Column>` — Grid child, spans N tracks

```typescript
type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface ColumnProps {
  span?: Responsive<Span>;    // default 12
  start?: Responsive<Span>;   // optional, for offsets / reordering
  as?: FlowElement;
  children: ReactNode;
}
```

Emits `<div data-press-layout="column" style="--press-col-span:12; --press-col-span-md:7">`.
`start` only emits vars if declared. CSS:

```css
[data-press-layout="column"] {
  grid-column: span var(--press-col-span, 12);
}
@media (min-width: 768px) {
  [data-press-layout="column"] {
    grid-column: span var(--press-col-span-md, var(--press-col-span, 12));
  }
}
@media (min-width: 1024px) {
  [data-press-layout="column"] {
    grid-column: span var(--press-col-span-lg, var(--press-col-span-md, var(--press-col-span, 12)));
  }
}
/* start variants only apply when --press-col-start is set (unset → auto) */
[data-press-layout="column"] { grid-column-start: var(--press-col-start, auto); }
@media (min-width: 768px) {
  [data-press-layout="column"] { grid-column-start: var(--press-col-start-md, var(--press-col-start, auto)); }
}
@media (min-width: 1024px) {
  [data-press-layout="column"] { grid-column-start: var(--press-col-start-lg, var(--press-col-start-md, var(--press-col-start, auto))); }
}
```

Column is a plain CSS-grid child — it does not check its parent, so it works
correctly inside any CSS grid (not just `<Grid>`), which is useful for adopter
custom blocks that want to reuse just the span-emission logic.

### 5.5 `<Row>` — flexbox horizontal container

Row is a **flexbox** helper, not a grid row. Named for authoring ergonomics
(consumers say "give me a row of things") but implemented as `display: flex`.

```typescript
interface RowProps {
  gap?: Responsive<'none' | 'sm' | 'md' | 'lg'>;                         // default 'md'
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';           // align-items
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';           // justify-content
  wrap?: boolean;                                                        // default true
  as?: FlowElement;
  children: ReactNode;
}
```

Emits `<div data-press-layout="row" data-align="center" data-justify="between" style="--press-row-gap-current:...">`
(default values are elided from the DOM; only `data-wrap="false"` is emitted
when `wrap: false`). Same responsive-gap cascade as `<Grid>` (uses a distinct
var name to avoid inheritance collisions when a Row is nested in a Grid):

```css
[data-press-layout="row"] {
  display: flex;
  flex-wrap: wrap;
  gap: var(--press-row-gap-current);
  align-items: stretch;
  justify-content: flex-start;
}
[data-press-layout="row"][data-wrap="false"] { flex-wrap: nowrap; }
[data-press-layout="row"][data-align="center"]   { align-items: center; }
[data-press-layout="row"][data-align="baseline"] { align-items: baseline; }
/* ...align/justify variants... */
@media (min-width: 768px) { [data-press-layout="row"] { gap: var(--press-row-gap-current-md, var(--press-row-gap-current)); } }
@media (min-width: 1024px) { [data-press-layout="row"] { gap: var(--press-row-gap-current-lg, var(--press-row-gap-current-md, var(--press-row-gap-current))); } }
```

**Why Row exists alongside Grid.** Grid is 2D composition with fractional column
widths (hero 8/5, feature grid 4/4/4). Row is 1D horizontal alignment with content-
sized children (navbar: brand · links · cta). Collapsing both into Grid works
technically but requires span calculation for what is naturally a flex layout,
and forces the author to think in 12ths for things that are not columns.

## 6. Tokens

### 6.1 Breakpoints — TS constants, NOT CSS variables

`@media (min-width: var(--x))` is not supported in production browsers.
Breakpoints are TS constants in `packages/web/src/layout/breakpoints.ts` (§5.1),
mirrored as literal `768px` / `1024px` in `theme.css` media queries. A
`breakpoints.test.ts` reads the CSS file, extracts the literals from the layout
section, and asserts they match `BREAKPOINTS.md` / `BREAKPOINTS.lg`. Any change
to either side is caught by this test.

### 6.2 Container widths + padding — via `FIXED_TOKENS`

Extends `packages/web/src/config/default-theme.ts`:

```typescript
export const FIXED_TOKENS: {
  space: readonly string[];
  text: Record<string, string>;
  radiusPill: string;
  container: {
    widths: Record<'prose' | 'sm' | 'md' | 'lg' | 'xl', string>;
    paddingX: string;
  };
  gridGap: Record<'sm' | 'md' | 'lg', string>;
} = {
  // existing…
  container: {
    widths: { prose: '72ch', sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    paddingX: '24px',                                     // = space-5 literal
  },
  gridGap: { sm: '12px', md: '24px', lg: '48px' },        // = space-3/5/7 literals
};
```

`buildThemeStyle` emits `--press-container-<size>` (five vars),
`--press-container-padding-x` (one), and `--press-grid-gap-<size>` (three).
`build-theme-style.test.ts` asserts each is present with the correct value.

Values are duplicated (not `var()`-referenced against `--press-space-*`) because
`FIXED_TOKENS` is the source of truth and cross-referencing token scales makes
future edits fragile. The `= space-N literal` comment is the coordination hint.

### 6.3 Per-instance CSS custom properties

Emitted inline on primitives; local scope, not `:root`:

| Primitive | Vars (base / md / lg) |
|---|---|
| `<Column>` | `--press-col-span[-md|-lg]`, `--press-col-start[-md|-lg]` |
| `<Grid>` | `--press-grid-gap-current[-md|-lg]` |
| `<Row>` | `--press-row-gap-current[-md|-lg]` |

The `var(a, var(b, var(c, default)))` cascade in the CSS handles cross-breakpoint
inheritance without JS.

## 7. Shell change

The most impactful edit — repositioned as a foundational move, isolated to
`packages/web/theme.css` (the host `app/layout.tsx` template is untouched).

### 7.1 `<main>` becomes full-width

Before: `main { display: block; max-width: 72ch; margin: 0 auto; padding: var(--press-space-7) var(--press-space-5) }`.

After: `main { display: block; padding-block: var(--press-space-7) }`. Horizontal
padding is dropped — every block owns its own gutter via `<Container padded>`,
either explicitly (organisms — §8) or implicitly (atoms — §7.2). A body block
that opts out of `<Container>` touches the viewport edge, which is the correct
signal that the block author needs to wrap.

### 7.2 Prose containment for atom blocks — single selector

The editorial 72ch reading width is preserved for every preset atom (and every
custom atom) rendered inside `main`, via one rule added to `theme.css`:

```css
/* Prose atoms in the page body still read at ~72ch — the shell dropped its
   own max-width (§7.1), so this selector restores editorial width for every
   atom rendered inside main. Custom atoms follow the same convention. */
main [data-block^="preset-atom."],
main [data-block^="custom-atom."] {
  max-width: var(--press-container-prose);
  margin-inline: auto;
  padding-inline: var(--press-container-padding-x);
}
```

Covers all eight preset atoms (paragraph, heading, list, quote, image, button,
separator, spacer) **without touching a single atom `.tsx`**. Custom atoms
(`custom-atom.*`) inherit the same behavior by convention. Organisms and
non-atom customs are deliberately excluded — they own their own container.

### 7.3 Chrome shells lose layout CSS

The `<header>` / `<footer>` shells in the host template stay as semantic wrappers.
`theme.css` reduces to the visual separator + vertical padding only (horizontal
padding is the organism's job, via its internal `<Container padded>`):

```css
header { border-bottom: 1px solid var(--press-color-border); padding-block: var(--press-space-4); }
footer { border-top: 1px solid var(--press-color-border); padding-block: var(--press-space-6); }
```

All flex/padding/max-width rules on `header {}` and `footer {}` are deleted; all
`[data-block="preset-organism.navbar"] { display: flex; ... }` and
`nav[data-press-nav="header"] { display: flex; margin-left: auto }` and the
navbar-specific `@media (max-width: 640px)` block are deleted. Their behavior
moves into the refactored organisms (§8).

## 8. Organism refactor

All four preset organisms adopt the primitives. The root element preserves
`data-block="preset-organism.<name>"` so existing inner-markup rules
(`[data-hero="eyebrow"] {...}`, `[data-navbar="brand"] {...}`, etc) keep applying.

### 8.1 Hero (`sections/hero.tsx`) — gains responsive 2-col layout

Today the Hero is a 1-column grid with the image stacked below the text.
Refactored, it becomes text 7 / image 5 on desktop, stacked on mobile:

```tsx
export function Hero({ eyebrow, title, subtitle, image, ctaLabel, ctaHref, align }: PresetOrganismHero) {
  if (!title) return null;
  const hasCta = Boolean(ctaLabel && ctaHref);
  const hasImage = Boolean(image?.url);
  return (
    <Container as="section" maxWidth="lg" data-block="preset-organism.hero" data-align={align ?? 'left'}>
      <Grid gap="lg" alignItems="center">
        <Column span={{ base: 12, md: hasImage ? 7 : 12 }}>
          <div data-hero="content">
            {eyebrow ? <p data-hero="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p data-hero="subtitle">{subtitle}</p> : null}
            {hasCta ? <a data-hero="cta" href={ctaHref}>{ctaLabel}</a> : null}
          </div>
        </Column>
        {hasImage ? (
          <Column span={{ base: 12, md: 5 }}>
            <img src={new URL(image!.url, CMS_URL).toString()} alt={image!.alternativeText ?? ''} />
          </Column>
        ) : null}
      </Grid>
    </Container>
  );
}
```

`theme.css` delta:
- **Remove** `[data-block="preset-organism.hero"] { display: grid; gap; align-items }` (Grid owns).
- **Remove** `[data-block="preset-organism.hero"][data-align="center"] { justify-items: center }` (no longer meaningful with 2-col; replaced by text-align on content).
- **Add** `[data-block="preset-organism.hero"][data-align="center"] [data-hero="content"] { text-align: center }`.
- **Keep** `margin-block: var(--press-space-7)` on the wrapper (breathing between organisms), plus every eyebrow / h1 / subtitle / cta / img rule.

### 8.2 Cta (`sections/cta.tsx`) — inner `data-cta="frame"` wrapper

The boxy visual (border + padding + background) moves off the outer `<section>`
onto an inner `data-cta="frame"` div, because the outer is now `<Container>`:

```tsx
export function Cta({ title, subtitle, buttonLabel, buttonHref, align }: PresetOrganismCta) {
  if (!title) return null;
  const hasButton = Boolean(buttonLabel && buttonHref);
  return (
    <Container as="section" maxWidth="lg" data-block="preset-organism.cta" data-align={align ?? 'left'}>
      <div data-cta="frame">
        <h2>{title}</h2>
        {subtitle ? <p data-cta="subtitle">{subtitle}</p> : null}
        {hasButton ? <a data-cta="button" href={buttonHref}>{buttonLabel}</a> : null}
      </div>
    </Container>
  );
}
```

`theme.css` delta: every `[data-block="preset-organism.cta"] { padding | border | border-radius | background }` rule moves to `[data-block="preset-organism.cta"] [data-cta="frame"] { ... }`. Wrapper keeps `margin-block: var(--press-space-7)`; `[data-align="center"]` naturally inherits into the frame.

### 8.3 Navbar (`chrome/navbar.tsx`) — nested Rows

Brand LEFT, links + cta grouped RIGHT via `justify="between"`:

```tsx
export function Navbar({ brand, links, cta }: ResolvedChromeNavbar) {
  const hasCta = Boolean(cta?.label && cta?.href);
  return (
    <Container as="div" maxWidth="full" padded data-block="preset-organism.navbar">
      <Row align="center" justify="between" gap="md">
        <a data-navbar="brand" href="/">
          {brand?.logo ? <img src={brand.logo} alt="" /> : null}
          <span>{brand?.name}</span>
        </a>
        <Row align="center" gap="lg">
          <NavLinks links={links ?? []} />
          {hasCta ? (
            <a data-navbar="cta" data-variant={cta?.variant ?? 'primary'} href={cta?.href}>
              {cta?.label}
            </a>
          ) : null}
        </Row>
      </Row>
    </Container>
  );
}
```

`NavLinks` (`chrome/nav-links.tsx`) also converts its internal `<nav>` to
`<Row as="nav" data-press-nav="header" gap="md">…</Row>`, retiring the manual
flex rule.

Mobile behavior: `Row` defaults to `wrap: true`. On narrow viewports, the outer
Row's `justify="between"` + wrap naturally puts brand on the top row and the
right-side group on a new row spanning full width. The custom
`@media (max-width: 640px)` block from `theme.css` is deleted — behavior comes
from the primitive.

`theme.css` delta:
- **Remove** `[data-block="preset-organism.navbar"] { display: flex; ... flex: 1 }`.
- **Remove** `nav[data-press-nav="header"] { display: flex; flex-wrap; align-items; margin-left: auto }`.
- **Remove** the `@media (max-width: 640px)` chrome block.
- **Keep** every visual rule (`[data-navbar="brand"] {...}`, `[data-navbar="cta"][data-variant="…"] {...}`, `nav[data-press-nav="header"] a { hover, aria-current }`).

### 8.4 Footer (`chrome/footer.tsx`) — Container-wrapped `<small>`

```tsx
export function Footer({ text, brand }: ResolvedChromeFooter) {
  return (
    <Container as="div" maxWidth="lg" padded data-block="preset-organism.footer">
      <small>{text || `${brand?.name ?? ''} · ${new Date().getFullYear()}`}</small>
    </Container>
  );
}
```

`theme.css` delta:
- **Remove** the old `footer { max-width: 72ch; margin: 0 auto; padding: ...; color: muted; font-size: sm }` shell rule (superseded by §7.3 minimal shell).
- **Add** `[data-block="preset-organism.footer"] { color: var(--press-color-muted); font-size: var(--press-text-sm) }` (typography moves to the organism, which is where it semantically belongs).

## 9. `preset-layout` palette layer — reserved, documented

`PRESET_LAYERS` already includes `'layout'`; the admin picker already labels it
(`Layout` en, `Layout` pt). This task **adds no components** to that category —
the layer stays visible in the model but empty in content.

Documented pattern (in `CLAUDE.md` update — §14) for future consumers:

> A future organism that needs an editor-visible layout knob (e.g. `FeatureGrid`
> exposing `columns: 2|3|4`) registers `preset-layout.<name>` as a **nested-only
> config component** — never DZ-admitted, referenced from that organism's
> `schema.json` via a `component:` field. Pattern: `preset-molecule.nav-item`
> nested inside `preset-organism.navbar`.
>
> Layout is *never* placed by the editor as a block. Composition and placement
> are code-owned via the React primitives (`Container` / `Grid` / `Row` /
> `Column`). The CMS layer only exposes discrete knobs on organisms that
> deliberately opt in.

## 10. Data flow — none

Layout primitives are **not** in the type-sync pipeline. No component is
injected, no attribute is added to any content-type, no serialization changes,
no generator changes, no impact on `PressSchema` / `PageBody` / `HeaderBlocks` /
`FooterBlocks`. `packages/shared` is untouched.

Adopters who run `press upgrade` receive the new primitives via the
re-materialized `.press/web` and the updated engine package — no config change,
no re-run of `press dev`'s schema sync required for layout to work.

## 11. Error handling / edge cases

- **`<Column>` without a parent `<Grid>`** — renders correctly against any CSS
  grid (its `grid-column` styles are a no-op outside grid context). No warning:
  intentional, so authors can compose the primitive with a hand-rolled parent
  grid when the built-in `<Grid>` (12 tracks) is not the right shape.
- **`<Row>` with `wrap: false` and children that overflow** — respects the
  author's intent (`overflow` is not clipped). Documented as an author choice.
- **Responsive prop with only `md`, no `base`** — `Responsive<T>` requires
  `base` at the type level; TS catches at compile time.
- **`maxWidth="full"` with `padded` false** — legal (edge-to-edge full-bleed);
  used for `<header>` chrome (navbar case) which wants no width cap but keeps
  padding for gutter.
- **Unknown `as` element** — `FlowElement` is a closed union; TS refuses non-flow
  elements at compile time.
- **Missing / partial breakpoints in `Responsive<T>`** — the CSS `var()` fallback
  cascade handles it (`md` inherits `base`; `lg` inherits `md` or `base`); no
  runtime normalization needed.

## 12. Testing (repo gate: vitest + tsc, no eslint)

**New — primitive tests** (`packages/web/src/layout/*.test.tsx`, one per primitive):

- Renders default `as` element (`div`) and honors `as="section"` / `"header"` etc.
- Emits the correct `data-press-layout` value and passes through extra `data-*`.
- Responsive prop normalization: `span={6}` emits only `--press-col-span: 6`;
  `span={{ base: 12, md: 6, lg: 4 }}` emits all three; `span={{ base: 12, lg: 4 }}` skips `-md`.
- `<Container>` size/padded matrix: correct `data-max-width` + `data-padded` per props.
- `<Row>` align/justify/wrap matrix + gap emission.
- `<Grid>` alignItems matrix + gap emission.
- `<Column>` inside `<Grid>` renders in a real CSS-grid context (jsdom lacks
  layout, so we assert data + style, not computed geometry).

**New — coordination test** (`packages/web/src/layout/breakpoints.test.ts`):
reads `theme.css`, extracts `@media (min-width: NNNpx)` literals from the layout
section, asserts they match `BREAKPOINTS.md` / `BREAKPOINTS.lg`.

**Modified — refactored organism tests** (existing files, not new):

- `sections/hero.test.ts` — assert `data-press-layout="container"` root,
  `data-press-layout="grid"` inner, and the text column's
  `--press-col-span-md` reflects the `hasImage` branch.
- `sections/cta.test.ts` — assert inner `data-cta="frame"` wrapper.
- `chrome/navbar.test.ts` + `chrome/nav-links.test.ts` — assert
  `data-press-layout="row"` structures replacing the old flex hooks.
- `chrome/footer.test.ts` — assert `<Container>` root wrap.

**Modified — theme tests**:

- `config/build-theme-style.test.ts` — assert every new `--press-container-*`,
  `--press-container-padding-x`, `--press-grid-gap-*` var is emitted with the
  correct value from `FIXED_TOKENS`.

**Playground (dogfood)**:

- Home page in `apps/playground` gets a `preset-organism.hero` with an image
  (exercises the responsive 2-col path) and a `preset-organism.cta` (exercises
  the frame wrapper). `pnpm dev` visually confirms mobile stacking, desktop
  side-by-side, no regression to navbar / footer.

No new test in `packages/cms` — the CMS is untouched by this task.

## 13. Files created / modified

**Created (`packages/web`):**

- `src/layout/breakpoints.ts` — `BREAKPOINTS`, `Breakpoint`, `Responsive<T>`, `normalizeResponsive`.
- `src/layout/container.tsx` — `<Container>` + `ContainerProps`.
- `src/layout/grid.tsx` — `<Grid>` + `GridProps`.
- `src/layout/row.tsx` — `<Row>` + `RowProps`.
- `src/layout/column.tsx` — `<Column>` + `ColumnProps`.
- `src/layout/index.ts` — barrel re-export of the four components + types.
- `src/layout/breakpoints.test.ts` — coordination test.
- `src/layout/container.test.tsx`, `grid.test.tsx`, `row.test.tsx`, `column.test.tsx`.

**Modified (`packages/web`):**

- `src/index.ts` — re-export `Container`, `Grid`, `Row`, `Column`, `Breakpoint`, `Responsive`, `BREAKPOINTS` from `./layout`.
- `src/config/default-theme.ts` — extend `FIXED_TOKENS` with `container` and `gridGap`.
- `src/config/build-theme-style.ts` — emit `--press-container-*`, `--press-container-padding-x`, `--press-grid-gap-*`.
- `src/config/build-theme-style.test.ts` — assert new vars.
- `theme.css` — §7 shell edits + §8 organism CSS deltas + §5 primitive CSS.
- `src/sections/hero.tsx` + `hero.test.ts` — refactor per §8.1.
- `src/sections/cta.tsx` + `cta.test.ts` — refactor per §8.2.
- `src/chrome/navbar.tsx` + `navbar.test.ts` — refactor per §8.3.
- `src/chrome/nav-links.tsx` + `nav-links.test.ts` — Row-based NavLinks.
- `src/chrome/footer.tsx` + `footer.test.ts` — refactor per §8.4.

**Modified (playground):**

- One page in `apps/playground` with a Hero+image and a Cta to dogfood the refactor.

**Modified (docs):**

- `CLAUDE.md` — add a "Layout primitives" subsection under "Architecture" describing the two surfaces (§4) and the reserved `preset-layout` extension point (§9).

**Untouched:** `packages/cms/**` (no component injection, no schema.json change),
`packages/shared/**`, `packages/cli/**`, `packages/web/src/generator/**`,
`packages/web/src/materialize.ts`, `packages/web/templates/host/**`.

## 14. Delivery

- **Changeset:** minor bump for `@ogs-tech/press-web` only. `press-cms` is
  untouched, so it stays at its current version.
- **Changelog:** highlight the **visual-breaking** change — `main` no longer caps
  at `72ch`. Migration for adopter custom blocks: wrap in
  `<Container maxWidth="prose">` if the old width is desired. Preset atoms
  (`preset-atom.*`) preserve their editorial width automatically (§7.2).
- **Contract stability:** `PressSchema`, `PageBody`, `HeaderBlocks`, `FooterBlocks`
  are byte-identical. No CMS re-seed, no admin re-login, no data migration.

## 15. Open items (confirmed during design)

- **Layout surface = hybrid** (React primitives + reserved CMS layer). Approved.
- **Shell = full-width main + prose atoms + minimal chrome shell.** Approved.
- **Breakpoints = 3 tiers** (`base 0`, `md 768`, `lg 1024`). Approved.
- **Grid = 12-column classic.** Approved.
- **CMS scope = zero components** in this task. Approved.
- **Refactor scope = all four preset organisms** (Hero, Cta, Navbar, Footer). Approved.
