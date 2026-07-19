# Layout / Grid System (`preset-layout`, v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four engine-owned React layout primitives (`Container`, `Grid`, `Row`, `Column`) plus a mobile hamburger drawer, refactor all four preset organisms to consume them, rewrite the page shell so `main` is full-width, and preserve editorial 72ch prose width for atom blocks via a single CSS selector — while keeping the CMS wire contract byte-identical.

**Architecture:** Layout is code-owned and lives under `packages/web/src/layout/`; it is never serialized, never in `PressSchema`, never admitted to a Dynamic Zone. Primitives emit semantic HTML + `data-press-layout="<primitive>"` + inline CSS custom properties; visual rules live in `theme.css` and read the vars via a `var(a, var(b, var(c, default)))` cascade so three-tier responsive behavior (`base=0`, `md=768px`, `lg=1024px`) is expressed in CSS with zero runtime JS. The one deliberate exception is the mobile hamburger — a small `MobileNav` client component with toggle drawer, added on top of the CSS-only navbar to give nav-items a real mobile UX. The `preset-layout` CMS category stays declared in `PRESET_LAYERS` and labelled in the picker but ships **zero** components in this task (spec §9 non-goal).

**Tech Stack:** React 18 + TypeScript, Next.js host template, `@ogs-tech/press-web` (TS source, no build), vitest + tsc as the quality gate, changesets for release, hand-rolled `act()`+`createRoot` harness for interactive client-component tests (per CLAUDE.md, deliberately NOT `@testing-library/react`).

## Global Constraints

Every task's requirements implicitly include this section.

- **Runtime:** Node 20.x, pnpm 10.x. Run all commands from the repo root.
- **Quality gate:** there is **no eslint**. The gate is `tsc --noEmit` (typecheck) + vitest. A task is done only when both pass for the touched package(s).
- **Engine ships TS source:** `web` and `shared` have echo-only `build`; only `cms` compiles. Do not introduce bundling.
- **CMS is UNTOUCHED.** No component injection, no `schema.json` change, no serializer change, no seed. `preset-layout` category stays labelled in the picker and empty in content (spec §9). `packages/cms/**`, `packages/shared/**`, and `packages/cli/**` are OFF-LIMITS for this task.
- **Wire contract stable.** `PressSchema`, `PageBody`, `HeaderBlocks`, `FooterBlocks` are byte-identical after this plan. No generator changes, no `map-site-settings` changes for the primitives themselves. Zero re-seed, zero admin re-login, zero data migration.
- **Layout is not a block.** Primitives use `data-press-layout="<primitive>"`, NEVER `data-block="preset-<layer>.*"`. Primitives have no `__component`, never appear in a DZ, never flow through `BlockRenderer`.
- **Three responsive tiers, fixed.** `BREAKPOINTS = { base: 0, md: 768, lg: 1024 }`. No `sm`/`xl`/`2xl` in v1. Breakpoints are TS constants; `@media (min-width: 768px|1024px)` in `theme.css` uses LITERAL pixel values (CSS does not accept `var()` inside media queries). A coordination test (Task 8) reads `theme.css` and asserts the literals match the TS constants.
- **Server-first, zero-runtime layout.** Every responsive behavior for the primitives is expressed in CSS via the `var()` cascade. The mobile hamburger (Task 13) is the deliberate, spec-approved-in-this-plan exception — a client component with toggle state, isolated to `chrome/mobile-nav.tsx`.
- **Zero adopter-overridable layout tokens.** Container widths, paddingX, grid gaps live in `FIXED_TOKENS` (same policy as `--press-space-*` / `--press-text-*`).
- **Visual-breaking change:** `main` no longer caps at 72ch. Preset atoms (`preset-atom.*`) and custom atoms (`custom-atom.*`) still read at ~72ch inside `main` via a single new selector. Adopter custom NON-ATOMS that assumed the old cap must wrap in `<Container maxWidth="prose">` — documented in the changeset.
- **`press-web` bumps MAJOR.** Two reasons: (1) visual-breaking shell change; (2) hamburger adds a new interactive client component to the public surface. `press-cms` stays untouched → no bump.
- **Interactive tests use hand-rolled harness.** Any test that renders a client component with state (Task 13) uses `// @vitest-environment jsdom` + `act()` + `createRoot` from `react-dom/client`, following `plugins/cookie-consent/cookie-consent-banner.test.tsx` exactly. Never `@testing-library/react` — the workspace's `node-linker=hoisted` layout materializes only Strapi-admin's react-19 RTL variant at root, which cannot render this package's react-18 elements.
- **Comment convention:** cite deliberate design decisions as `Spec §…` referencing `docs/superpowers/specs/2026-07-16-layout-grid-system-design.md`.
- **Language:** all code, comments, identifiers, and test descriptions in English.

## File Structure

**Create (`packages/web/src/layout/`):**
- `breakpoints.ts` — `BREAKPOINTS`, `Breakpoint`, `Responsive<T>`, `normalizeResponsive`.
- `breakpoints.test.ts` — TS ↔ theme.css coordination test.
- `container.tsx` — `<Container>` + `ContainerProps`.
- `container.test.tsx` — Container SSR tests.
- `grid.tsx` — `<Grid>` + `GridProps`.
- `grid.test.tsx` — Grid SSR tests.
- `row.tsx` — `<Row>` + `RowProps`.
- `row.test.tsx` — Row SSR tests.
- `column.tsx` — `<Column>` + `ColumnProps` + `Span` (1..12).
- `column.test.tsx` — Column SSR tests (inside a `<Grid>` for shape realism).
- `index.ts` — barrel re-export of the four components + `Breakpoint` / `Responsive` / `BREAKPOINTS`.

**Create (`packages/web/src/chrome/`):**
- `mobile-nav.tsx` — client component: hamburger button + drawer + toggle state + a11y (aria-expanded, aria-controls, Escape closes, body scroll lock).
- `mobile-nav.test.tsx` — interactive test with hand-rolled `act()`+`createRoot` harness under `// @vitest-environment jsdom`.

**Modify (`packages/web`):**
- `src/index.ts` — re-export `Container`, `Grid`, `Row`, `Column`, `Breakpoint`, `Responsive`, `BREAKPOINTS`. Do NOT re-export `MobileNav` (internal to `Navbar`).
- `src/config/default-theme.ts` — extend `FIXED_TOKENS` with `container` (`widths` + `paddingX`) and `gridGap`.
- `src/config/build-theme-style.ts` — emit `--press-container-<size>` (5 vars), `--press-container-padding-x` (1 var), `--press-grid-gap-<size>` (3 vars).
- `src/config/build-theme-style.test.ts` — assert every new var is present with the correct value.
- `theme.css` — add primitive rules (§5 of the spec) and mobile-nav rules; then the shell/organism deltas from §7–§8 land in dedicated tasks.
- `src/sections/hero.tsx` + `src/sections/hero.test.ts` — refactor per §8.1 (responsive 2-col via `<Container><Grid><Column>`).
- `src/sections/cta.tsx` + `src/sections/cta.test.ts` — refactor per §8.2 (inner `data-cta="frame"` wrapper).
- `src/chrome/navbar.tsx` + `src/chrome/navbar.test.ts` — refactor per §8.3 (Container + nested Rows, plus mount `MobileNav`).
- `src/chrome/nav-links.tsx` + `src/chrome/nav-links.test.ts` — internal `<nav>` becomes `<Row as="nav">`.
- `src/chrome/footer.tsx` + `src/chrome/footer.test.ts` — refactor per §8.4 (Container-wrapped `<small>`).

**Create (top-level):**
- `.changeset/layout-grid-system.md` — MAJOR bump for `@ogs-tech/press-web`.

**Modify (top-level):**
- `CLAUDE.md` — add a "Layout primitives" subsection under "Architecture — the moving parts", plus a "Mobile hamburger" note.

**Untouched:** `packages/cms/**`, `packages/shared/**`, `packages/cli/**`, `packages/web/src/generator/**`, `packages/web/src/materialize.ts`, `packages/web/templates/host/**`, `packages/web/src/block-renderer.tsx`, `packages/web/src/organism-blocks.ts`, `packages/web/src/atom-blocks.ts`, `packages/web/src/map-site-settings.ts`.

---

## Task 1: Foundations — breakpoints + Responsive type

**Files:**
- Create: `packages/web/src/layout/breakpoints.ts`
- Test: (deferred to Task 8 where the coordination test lives — this task ships pure TS with typecheck as the gate)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BREAKPOINTS: { readonly base: 0; readonly md: 768; readonly lg: 1024 }` — literal-typed constants.
  - `type Breakpoint = 'base' | 'md' | 'lg'` (`keyof typeof BREAKPOINTS`).
  - `type Responsive<T> = T | { base: T; md?: T; lg?: T }` — the shared prop shape for `<Grid gap>`, `<Row gap>`, `<Column span>`, `<Column start>`.
  - `normalizeResponsive<T>(value: Responsive<T> | undefined, fallback: T): { base: T; md?: T; lg?: T }` — flattens a scalar or partial record into a full `{ base, md?, lg? }` record; used by every primitive to emit CSS custom properties.

- [ ] **Step 1: Create `breakpoints.ts`**

Create `packages/web/src/layout/breakpoints.ts`:

```typescript
/**
 * Layout breakpoints (Spec §5.1, §6.1). Three tiers cover mobile/tablet/desktop
 * cleanly for v1; extra tiers are a deliberate non-goal (Spec §3). Kept as TS
 * constants (not CSS vars) because `@media (min-width: var(--x))` is not
 * supported in production browsers — theme.css mirrors these literals in its
 * media queries, and `breakpoints.test.ts` (Task 8) asserts both sides match.
 */
export const BREAKPOINTS = { base: 0, md: 768, lg: 1024 } as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Shared responsive prop shape (Spec §5.1). Every primitive that accepts a
 * responsive value uses this: a bare `T` means "same at every tier"; the object
 * form declares per-tier values with a required `base` and optional `md`/`lg`
 * that inherit through the CSS var() cascade emitted by the primitive.
 */
export type Responsive<T> = T | { base: T; md?: T; lg?: T };

/**
 * Flattens a Responsive<T> to a full { base, md?, lg? } record for CSS-var
 * emission. Scalars are lifted to `{ base: value }`; an undefined value uses
 * `fallback`. Does NOT fill md/lg from base — the CSS var() cascade handles
 * inheritance (Spec §5.4/§5.5/§6.3), so we emit only the tiers the author
 * declared, keeping the DOM minimal.
 */
export function normalizeResponsive<T>(
  value: Responsive<T> | undefined,
  fallback: T,
): { base: T; md?: T; lg?: T } {
  if (value === undefined) return { base: fallback };
  if (typeof value === 'object' && value !== null && 'base' in (value as { base: T })) {
    const record = value as { base: T; md?: T; lg?: T };
    const out: { base: T; md?: T; lg?: T } = { base: record.base };
    if (record.md !== undefined) out.md = record.md;
    if (record.lg !== undefined) out.lg = record.lg;
    return out;
  }
  return { base: value as T };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS (no diagnostic changes; this file is unreferenced yet).

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/layout/breakpoints.ts
git commit -m "feat(web): add layout breakpoints and Responsive prop shape"
```

---

## Task 2: Tokens — FIXED_TOKENS extension + buildThemeStyle emission

**Files:**
- Modify: `packages/web/src/config/default-theme.ts`
- Modify: `packages/web/src/config/build-theme-style.ts`
- Test: `packages/web/src/config/build-theme-style.test.ts`

**Interfaces:**
- Consumes: existing `FIXED_TOKENS` shape and `buildThemeStyle(resolved)` signature.
- Produces:
  - `FIXED_TOKENS.container.widths: Record<'prose' | 'sm' | 'md' | 'lg' | 'xl', string>`
  - `FIXED_TOKENS.container.paddingX: string`
  - `FIXED_TOKENS.gridGap: Record<'sm' | 'md' | 'lg', string>`
  - Emitted CSS vars (Tasks 3–8 consume these in theme.css and in primitive tests):
    - `--press-container-prose`, `--press-container-sm`, `--press-container-md`, `--press-container-lg`, `--press-container-xl`
    - `--press-container-padding-x`
    - `--press-grid-gap-sm`, `--press-grid-gap-md`, `--press-grid-gap-lg`

- [ ] **Step 1: Write the failing build-theme-style test**

Append inside the existing `describe('buildThemeStyle', …)` block in `packages/web/src/config/build-theme-style.test.ts`, before its closing `});`:

```typescript
  it('emits the container width tokens from FIXED_TOKENS.container.widths (Spec §6.2)', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css).toContain('--press-container-prose: 72ch;');
    expect(css).toContain('--press-container-sm: 640px;');
    expect(css).toContain('--press-container-md: 768px;');
    expect(css).toContain('--press-container-lg: 1024px;');
    expect(css).toContain('--press-container-xl: 1280px;');
  });

  it('emits --press-container-padding-x from FIXED_TOKENS.container.paddingX (Spec §6.2)', () => {
    expect(buildThemeStyle(baseResolved)).toContain('--press-container-padding-x: 24px;');
  });

  it('emits the grid gap tokens from FIXED_TOKENS.gridGap (Spec §6.2)', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css).toContain('--press-grid-gap-sm: 12px;');
    expect(css).toContain('--press-grid-gap-md: 24px;');
    expect(css).toContain('--press-grid-gap-lg: 48px;');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-theme-style.test.ts`

Expected: 3 FAILs (`--press-container-prose`, `--press-container-padding-x`, `--press-grid-gap-sm` not found in output).

- [ ] **Step 3: Extend FIXED_TOKENS**

Replace the existing `FIXED_TOKENS` declaration in `packages/web/src/config/default-theme.ts` with:

```typescript
/**
 * Engine-FIXED scales (Spec §4 "derived (fixed)") — NOT adopter-overridable.
 * Emitted as constants by `buildThemeStyle` so all token values still enter
 * through the single `:root` injection point (Spec §0).
 *
 * `container` and `gridGap` are added for the layout primitives (Spec §6.2).
 * Values are duplicated literals (not `var()`-referenced against
 * `--press-space-*`) because FIXED_TOKENS is the source of truth and
 * cross-referencing token scales makes future edits fragile — the
 * `= space-N literal` comments are the coordination hints.
 */
export const FIXED_TOKENS: {
  space: readonly string[]; // index 0 → --press-space-1
  text: Record<string, string>;
  radiusPill: string;
  container: {
    widths: Record<'prose' | 'sm' | 'md' | 'lg' | 'xl', string>;
    paddingX: string;
  };
  gridGap: Record<'sm' | 'md' | 'lg', string>;
} = {
  space: ['4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px', '96px'],
  text: {
    kicker: '12px',
    sm: '14px',
    body: '16px',
    lg: '18px',
    h3: '20px',
    h2: '28px',
    h1: '40px',
  },
  radiusPill: '999px',
  container: {
    widths: { prose: '72ch', sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
    paddingX: '24px', // = space-5 literal
  },
  gridGap: { sm: '12px', md: '24px', lg: '48px' }, // = space-3/5/7 literals
};
```

- [ ] **Step 4: Emit the new vars in buildThemeStyle**

In `packages/web/src/config/build-theme-style.ts`, inside `buildThemeStyle`, after the existing `lines.push(\`  --press-radius-pill: ${FIXED_TOKENS.radiusPill};\`);` and BEFORE the font loop, add:

```typescript
  for (const [key, value] of Object.entries(FIXED_TOKENS.container.widths)) {
    lines.push(`  --press-container-${key}: ${value};`);
  }
  lines.push(`  --press-container-padding-x: ${FIXED_TOKENS.container.paddingX};`);
  for (const [key, value] of Object.entries(FIXED_TOKENS.gridGap)) {
    lines.push(`  --press-grid-gap-${key}: ${value};`);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/config/build-theme-style.test.ts`

Expected: PASS (all previous assertions + the 3 new ones).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/config/default-theme.ts packages/web/src/config/build-theme-style.ts packages/web/src/config/build-theme-style.test.ts
git commit -m "feat(web): emit container width, paddingX, and grid gap tokens"
```

---

## Task 3: `<Container>` primitive

**Files:**
- Create: `packages/web/src/layout/container.tsx`
- Test: `packages/web/src/layout/container.test.tsx`

**Interfaces:**
- Consumes: nothing from Task 1/2 at runtime (Container is not responsive; it emits static `data-*` attrs only). Reads no CSS vars at emission time.
- Produces:
  - `FlowElement = 'div' | 'section' | 'header' | 'footer' | 'main' | 'article' | 'aside' | 'nav' | 'ul' | 'ol'` — the shared closed union for the `as` prop across ALL primitives (Tasks 4–6 import it from here).
  - `ContainerMaxWidth = 'prose' | 'sm' | 'md' | 'lg' | 'xl' | 'full'`.
  - `ContainerProps` (see Step 3) and the `<Container>` component. Passthrough `data-*` props allowed via a controlled index signature so Tasks 9–13 can do `<Container as="section" data-block="preset-organism.hero" data-align="left">`.

- [ ] **Step 1: Write the failing container test**

Create `packages/web/src/layout/container.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Container } from './container';

const render = (props: Parameters<typeof Container>[0]): string =>
  renderToStaticMarkup(createElement(Container, props));

describe('<Container>', () => {
  it('renders a <div> by default with data-press-layout="container"', () => {
    const html = render({ children: 'x' });
    expect(html.startsWith('<div data-press-layout="container"')).toBe(true);
  });

  it('honors as="section"', () => {
    expect(render({ as: 'section', children: 'x' })).toContain('<section');
  });

  it('defaults maxWidth to "lg"', () => {
    expect(render({ children: 'x' })).toContain('data-max-width="lg"');
  });

  it('emits every maxWidth value', () => {
    for (const size of ['prose', 'sm', 'md', 'lg', 'xl', 'full'] as const) {
      expect(render({ maxWidth: size, children: 'x' })).toContain(`data-max-width="${size}"`);
    }
  });

  it('defaults padded to true and emits data-padded', () => {
    expect(render({ children: 'x' })).toContain('data-padded');
  });

  it('omits data-padded when padded={false}', () => {
    expect(render({ padded: false, children: 'x' })).not.toContain('data-padded');
  });

  it('passes through extra data-* attributes (Spec §5)', () => {
    const html = render({
      as: 'section',
      children: 'x',
      'data-block': 'preset-organism.hero',
      'data-align': 'center',
    } as any);
    expect(html).toContain('data-block="preset-organism.hero"');
    expect(html).toContain('data-align="center"');
  });

  it('renders children', () => {
    expect(render({ children: 'hello' })).toContain('hello');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/container.test.tsx`

Expected: FAIL — `Cannot find module './container'` (module does not exist yet).

- [ ] **Step 3: Create the Container primitive**

Create `packages/web/src/layout/container.tsx`:

```tsx
import { createElement, type ReactNode } from 'react';

/**
 * The closed union of semantic elements a layout primitive may render as
 * (Spec §5). Shared by every primitive so `as` is uniformly restricted at
 * compile time — an unknown element is refused by TS, never rendered.
 */
export type FlowElement =
  | 'div'
  | 'section'
  | 'header'
  | 'footer'
  | 'main'
  | 'article'
  | 'aside'
  | 'nav'
  | 'ul'
  | 'ol';

export type ContainerMaxWidth = 'prose' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Props for `<Container>` (Spec §5.2). `maxWidth` picks one of the fixed
 * container width tokens (or `'full'` for edge-to-edge); `padded` toggles
 * horizontal gutter via `--press-container-padding-x`. Extra `data-*` attrs
 * pass through to the root element so consumers can compose block hooks
 * (e.g. `<Container as="section" data-block="preset-organism.hero">`).
 */
export interface ContainerProps {
  maxWidth?: ContainerMaxWidth;
  padded?: boolean;
  as?: FlowElement;
  children: ReactNode;
  [dataAttr: `data-${string}`]: string | undefined;
}

/**
 * `<Container>` — width constraint + horizontal gutter (Spec §5.2). The one
 * primitive with no responsive prop: consumers pick a single tier of the
 * fixed width scale. Emits static `data-max-width` / `data-padded` attrs and
 * relies on `theme.css` to consume them via attribute selectors — no inline
 * style, no CSS vars beyond those already emitted by `buildThemeStyle`.
 *
 * `maxWidth="full"` deliberately emits no width token: the CSS just drops
 * `max-width` to `none`, avoiding an unused variable.
 */
export function Container({
  maxWidth = 'lg',
  padded = true,
  as = 'div',
  children,
  ...rest
}: ContainerProps) {
  return createElement(
    as,
    {
      ...rest,
      'data-press-layout': 'container',
      'data-max-width': maxWidth,
      'data-padded': padded ? '' : undefined,
    },
    children,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/container.test.tsx`

Expected: PASS (all 8 assertions).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/layout/container.tsx packages/web/src/layout/container.test.tsx
git commit -m "feat(web): add <Container> layout primitive"
```

---

## Task 4: `<Grid>` primitive

**Files:**
- Create: `packages/web/src/layout/grid.tsx`
- Test: `packages/web/src/layout/grid.test.tsx`

**Interfaces:**
- Consumes: `Responsive<T>`, `normalizeResponsive` from `./breakpoints`; `FlowElement` from `./container`.
- Produces:
  - `GridGap = 'none' | 'sm' | 'md' | 'lg'`.
  - `GridAlignItems = 'start' | 'center' | 'end' | 'stretch'`.
  - `GridProps` (Step 3) and `<Grid>`. Task 5 (`<Column>`) is the intended child; Task 9 (Hero refactor) consumes both together.

- [ ] **Step 1: Write the failing grid test**

Create `packages/web/src/layout/grid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Grid } from './grid';

const render = (props: Parameters<typeof Grid>[0]): string =>
  renderToStaticMarkup(createElement(Grid, props));

describe('<Grid>', () => {
  it('renders a <div data-press-layout="grid"> by default', () => {
    expect(render({ children: 'x' })).toContain('data-press-layout="grid"');
  });

  it('honors as="section"', () => {
    expect(render({ as: 'section', children: 'x' })).toContain('<section');
  });

  it('defaults alignItems to "stretch" (elided from the DOM)', () => {
    expect(render({ children: 'x' })).not.toContain('data-align-items');
  });

  it('emits data-align-items for non-default values', () => {
    expect(render({ alignItems: 'center', children: 'x' })).toContain('data-align-items="center"');
    expect(render({ alignItems: 'start', children: 'x' })).toContain('data-align-items="start"');
    expect(render({ alignItems: 'end', children: 'x' })).toContain('data-align-items="end"');
  });

  it('emits --press-grid-gap-current from a bare scalar gap', () => {
    expect(render({ gap: 'lg', children: 'x' })).toContain('--press-grid-gap-current:var(--press-grid-gap-lg)');
  });

  it('defaults gap to "md"', () => {
    expect(render({ children: 'x' })).toContain('--press-grid-gap-current:var(--press-grid-gap-md)');
  });

  it('emits per-tier grid gap vars for a Responsive gap (Spec §5.3)', () => {
    const html = render({ gap: { base: 'sm', md: 'md', lg: 'lg' }, children: 'x' });
    expect(html).toContain('--press-grid-gap-current:var(--press-grid-gap-sm)');
    expect(html).toContain('--press-grid-gap-current-md:var(--press-grid-gap-md)');
    expect(html).toContain('--press-grid-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('skips missing tiers so the CSS var() cascade inherits', () => {
    const html = render({ gap: { base: 'sm', lg: 'lg' }, children: 'x' });
    expect(html).not.toContain('--press-grid-gap-current-md');
    expect(html).toContain('--press-grid-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('emits gap "none" as 0', () => {
    expect(render({ gap: 'none', children: 'x' })).toContain('--press-grid-gap-current:0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/grid.test.tsx`

Expected: FAIL — module missing.

- [ ] **Step 3: Create the Grid primitive**

Create `packages/web/src/layout/grid.tsx`:

```tsx
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { normalizeResponsive, type Responsive } from './breakpoints';
import type { FlowElement } from './container';

export type GridGap = 'none' | 'sm' | 'md' | 'lg';
export type GridAlignItems = 'start' | 'center' | 'end' | 'stretch';

export interface GridProps {
  gap?: Responsive<GridGap>;
  alignItems?: GridAlignItems;
  as?: FlowElement;
  children: ReactNode;
}

/**
 * Resolves a `GridGap` symbolic value to the CSS expression stored in the
 * per-instance custom property (Spec §5.3). `'none'` short-circuits to `0`
 * so the DOM stays honest and `var(--press-grid-gap-none)` never leaks.
 */
function gapExpr(gap: GridGap): string {
  return gap === 'none' ? '0' : `var(--press-grid-gap-${gap})`;
}

/**
 * `<Grid>` — 12-column CSS grid with responsive gap (Spec §5.3). Always 12
 * tracks (`repeat(12, minmax(0, 1fr))` in theme.css); the `minmax(0, 1fr)`
 * form prevents child overflow from expanding a track (a common CSS-grid
 * footgun with long words / large images).
 *
 * `gap` normalizes to `--press-grid-gap-current[-md|-lg]` custom properties
 * inline; theme.css consumes them through `var(a, var(b, var(c, default)))`
 * so a missing `md` cleanly inherits `base` (Spec §6.3).
 */
export function Grid({ gap, alignItems = 'stretch', as = 'div', children }: GridProps) {
  const normalized = normalizeResponsive<GridGap>(gap, 'md');
  const style: CSSProperties & Record<string, string> = {
    ['--press-grid-gap-current' as any]: gapExpr(normalized.base),
  };
  if (normalized.md !== undefined) style['--press-grid-gap-current-md' as any] = gapExpr(normalized.md);
  if (normalized.lg !== undefined) style['--press-grid-gap-current-lg' as any] = gapExpr(normalized.lg);
  return createElement(
    as,
    {
      'data-press-layout': 'grid',
      'data-align-items': alignItems === 'stretch' ? undefined : alignItems,
      style,
    },
    children,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/grid.test.tsx`

Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/layout/grid.tsx packages/web/src/layout/grid.test.tsx
git commit -m "feat(web): add <Grid> 12-column layout primitive"
```

---

## Task 5: `<Column>` primitive

**Files:**
- Create: `packages/web/src/layout/column.tsx`
- Test: `packages/web/src/layout/column.test.tsx`

**Interfaces:**
- Consumes: `Responsive<T>`, `normalizeResponsive`; `FlowElement`.
- Produces:
  - `Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12` — literal union (1..12).
  - `ColumnProps` and `<Column>`. Task 9 (Hero refactor) is the primary consumer.

- [ ] **Step 1: Write the failing column test**

Create `packages/web/src/layout/column.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Column } from './column';
import { Grid } from './grid';

const render = (props: Parameters<typeof Column>[0]): string =>
  renderToStaticMarkup(createElement(Column, props));

describe('<Column>', () => {
  it('renders a <div data-press-layout="column"> by default', () => {
    expect(render({ children: 'x' })).toContain('data-press-layout="column"');
  });

  it('honors as="section"', () => {
    expect(render({ as: 'section', children: 'x' })).toContain('<section');
  });

  it('defaults span to 12 (emitted as --press-col-span:12)', () => {
    expect(render({ children: 'x' })).toContain('--press-col-span:12');
  });

  it('emits only --press-col-span for a bare scalar (Spec §12)', () => {
    const html = render({ span: 6, children: 'x' });
    expect(html).toContain('--press-col-span:6');
    expect(html).not.toContain('--press-col-span-md');
    expect(html).not.toContain('--press-col-span-lg');
  });

  it('emits per-tier vars for a Responsive span', () => {
    const html = render({ span: { base: 12, md: 6, lg: 4 }, children: 'x' });
    expect(html).toContain('--press-col-span:12');
    expect(html).toContain('--press-col-span-md:6');
    expect(html).toContain('--press-col-span-lg:4');
  });

  it('skips missing tiers so the CSS cascade inherits', () => {
    const html = render({ span: { base: 12, lg: 4 }, children: 'x' });
    expect(html).not.toContain('--press-col-span-md');
    expect(html).toContain('--press-col-span-lg:4');
  });

  it('emits --press-col-start only when start is declared', () => {
    expect(render({ children: 'x' })).not.toContain('--press-col-start');
    expect(render({ start: 3, children: 'x' })).toContain('--press-col-start:3');
  });

  it('emits per-tier start vars', () => {
    const html = render({ start: { base: 1, md: 2, lg: 3 }, children: 'x' });
    expect(html).toContain('--press-col-start:1');
    expect(html).toContain('--press-col-start-md:2');
    expect(html).toContain('--press-col-start-lg:3');
  });

  it('renders correctly nested inside <Grid> (Spec §5.4 — plain grid child)', () => {
    const html = renderToStaticMarkup(
      createElement(Grid, { children: createElement(Column, { span: 6, children: 'cell' }) }),
    );
    expect(html).toContain('data-press-layout="grid"');
    expect(html).toContain('data-press-layout="column"');
    expect(html).toContain('--press-col-span:6');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/column.test.tsx`

Expected: FAIL — module missing.

- [ ] **Step 3: Create the Column primitive**

Create `packages/web/src/layout/column.tsx`:

```tsx
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { normalizeResponsive, type Responsive } from './breakpoints';
import type { FlowElement } from './container';

export type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface ColumnProps {
  span?: Responsive<Span>;
  start?: Responsive<Span>;
  as?: FlowElement;
  children: ReactNode;
}

/**
 * `<Column>` — a plain CSS-grid child that spans N of the 12 tracks (Spec §5.4).
 * Does NOT check its parent: `grid-column` styles are a no-op outside a grid
 * context, which is what lets an adopter compose a `<Column>` inside a
 * hand-rolled parent grid when the built-in `<Grid>` (12 tracks) is not the
 * right shape.
 *
 * Emits `--press-col-span[-md|-lg]` unconditionally at base (default 12) and
 * only for declared tiers on md/lg. `--press-col-start[-md|-lg]` is emitted
 * only when `start` is declared, so an undeclared start cleanly resolves to
 * `auto` via the CSS var() fallback (Spec §5.4).
 */
export function Column({ span, start, as = 'div', children }: ColumnProps) {
  const spanTiers = normalizeResponsive<Span>(span, 12);
  const style: CSSProperties & Record<string, string> = {
    ['--press-col-span' as any]: String(spanTiers.base),
  };
  if (spanTiers.md !== undefined) style['--press-col-span-md' as any] = String(spanTiers.md);
  if (spanTiers.lg !== undefined) style['--press-col-span-lg' as any] = String(spanTiers.lg);

  if (start !== undefined) {
    const startTiers = normalizeResponsive<Span>(start, 1);
    style['--press-col-start' as any] = String(startTiers.base);
    if (startTiers.md !== undefined) style['--press-col-start-md' as any] = String(startTiers.md);
    if (startTiers.lg !== undefined) style['--press-col-start-lg' as any] = String(startTiers.lg);
  }

  return createElement(as, { 'data-press-layout': 'column', style }, children);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/column.test.tsx`

Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/layout/column.tsx packages/web/src/layout/column.test.tsx
git commit -m "feat(web): add <Column> layout primitive"
```

---

## Task 6: `<Row>` primitive

**Files:**
- Create: `packages/web/src/layout/row.tsx`
- Test: `packages/web/src/layout/row.test.tsx`

**Interfaces:**
- Consumes: `Responsive<T>`, `normalizeResponsive`; `FlowElement`.
- Produces:
  - `RowGap = 'none' | 'sm' | 'md' | 'lg'` — same shape as `GridGap`, distinct name for local clarity.
  - `RowAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch'`.
  - `RowJustify = 'start' | 'center' | 'end' | 'between' | 'around'`.
  - `RowProps` and `<Row>`. Tasks 12–13 (Navbar refactor + hamburger mount) are the primary consumers.

- [ ] **Step 1: Write the failing row test**

Create `packages/web/src/layout/row.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Row } from './row';

const render = (props: Parameters<typeof Row>[0]): string =>
  renderToStaticMarkup(createElement(Row, props));

describe('<Row>', () => {
  it('renders a <div data-press-layout="row"> by default', () => {
    expect(render({ children: 'x' })).toContain('data-press-layout="row"');
  });

  it('honors as="nav"', () => {
    expect(render({ as: 'nav', children: 'x' })).toContain('<nav');
  });

  it('defaults gap to "md" via --press-row-gap-current', () => {
    expect(render({ children: 'x' })).toContain('--press-row-gap-current:var(--press-grid-gap-md)');
  });

  it('reuses --press-grid-gap-* symbolic tokens for scalar gaps', () => {
    expect(render({ gap: 'lg', children: 'x' })).toContain('--press-row-gap-current:var(--press-grid-gap-lg)');
  });

  it('emits per-tier row gap vars for a Responsive gap (distinct var name from Grid, Spec §5.5)', () => {
    const html = render({ gap: { base: 'sm', md: 'md', lg: 'lg' }, children: 'x' });
    expect(html).toContain('--press-row-gap-current:var(--press-grid-gap-sm)');
    expect(html).toContain('--press-row-gap-current-md:var(--press-grid-gap-md)');
    expect(html).toContain('--press-row-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('emits gap "none" as 0', () => {
    expect(render({ gap: 'none', children: 'x' })).toContain('--press-row-gap-current:0');
  });

  it('elides default align/justify from the DOM (Spec §5.5)', () => {
    const html = render({ children: 'x' });
    expect(html).not.toContain('data-align');
    expect(html).not.toContain('data-justify');
  });

  it('emits data-align and data-justify for non-default values', () => {
    const html = render({ align: 'center', justify: 'between', children: 'x' });
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-justify="between"');
  });

  it('defaults wrap to true (elided) and emits data-wrap="false" when off (Spec §5.5)', () => {
    expect(render({ children: 'x' })).not.toContain('data-wrap');
    expect(render({ wrap: false, children: 'x' })).toContain('data-wrap="false"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/row.test.tsx`

Expected: FAIL — module missing.

- [ ] **Step 3: Create the Row primitive**

Create `packages/web/src/layout/row.tsx`:

```tsx
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { normalizeResponsive, type Responsive } from './breakpoints';
import type { FlowElement } from './container';

export type RowGap = 'none' | 'sm' | 'md' | 'lg';
export type RowAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
export type RowJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface RowProps {
  gap?: Responsive<RowGap>;
  align?: RowAlign;
  justify?: RowJustify;
  wrap?: boolean;
  as?: FlowElement;
  children: ReactNode;
}

/**
 * Resolves a `RowGap` to the CSS expression stored in the row's per-instance
 * custom property (Spec §5.5). Reuses the `--press-grid-gap-*` symbolic
 * tokens (single source of gap values in FIXED_TOKENS.gridGap) but writes to
 * a DISTINCT variable name (`--press-row-gap-current`) so a Row nested inside
 * a Grid does not accidentally inherit the grid's gap.
 */
function gapExpr(gap: RowGap): string {
  return gap === 'none' ? '0' : `var(--press-grid-gap-${gap})`;
}

/**
 * `<Row>` — flexbox horizontal container (Spec §5.5). Named for authoring
 * ergonomics ("give me a row of things") but implemented as `display: flex`
 * (theme.css) so it composes 1D content-sized children — the natural shape
 * for a navbar (brand · links · cta), the wrong shape for a 2-col hero
 * (that is what `<Grid>` + `<Column>` are for).
 *
 * `wrap` defaults to `true`; `data-wrap="false"` is the only wrap-related
 * attribute emitted, so the DOM stays clean for the default case. Align and
 * justify default to their flexbox defaults (`stretch`, `flex-start`) and
 * are elided when unset.
 */
export function Row({
  gap,
  align = 'stretch',
  justify = 'start',
  wrap = true,
  as = 'div',
  children,
}: RowProps) {
  const normalized = normalizeResponsive<RowGap>(gap, 'md');
  const style: CSSProperties & Record<string, string> = {
    ['--press-row-gap-current' as any]: gapExpr(normalized.base),
  };
  if (normalized.md !== undefined) style['--press-row-gap-current-md' as any] = gapExpr(normalized.md);
  if (normalized.lg !== undefined) style['--press-row-gap-current-lg' as any] = gapExpr(normalized.lg);
  return createElement(
    as,
    {
      'data-press-layout': 'row',
      'data-align': align === 'stretch' ? undefined : align,
      'data-justify': justify === 'start' ? undefined : justify,
      'data-wrap': wrap === false ? 'false' : undefined,
      style,
    },
    children,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/row.test.tsx`

Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/layout/row.tsx packages/web/src/layout/row.test.tsx
git commit -m "feat(web): add <Row> flexbox layout primitive"
```

---

## Task 7: Barrel export + public surface

**Files:**
- Create: `packages/web/src/layout/index.ts`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `Container`, `Grid`, `Row`, `Column`, `BREAKPOINTS`, `Breakpoint`, `Responsive`, `FlowElement` from the layout module.
- Produces: the public surface adopters import from `@ogs-tech/press-web`. Tasks 9–13 use the top-level import path (`import { Container, Grid, Column, Row } from '@ogs-tech/press-web'`) inside the engine — but for the ORGANISM refactors we use the direct relative path (`../layout`) to keep the internal package graph honest; the top-level re-export exists for adopters and downstream tests.

- [ ] **Step 1: Create the layout barrel**

Create `packages/web/src/layout/index.ts`:

```typescript
export { BREAKPOINTS, normalizeResponsive } from './breakpoints';
export type { Breakpoint, Responsive } from './breakpoints';
export { Container } from './container';
export type { ContainerProps, ContainerMaxWidth, FlowElement } from './container';
export { Grid } from './grid';
export type { GridProps, GridGap, GridAlignItems } from './grid';
export { Row } from './row';
export type { RowProps, RowGap, RowAlign, RowJustify } from './row';
export { Column } from './column';
export type { ColumnProps, Span } from './column';
```

- [ ] **Step 2: Re-export from the package entrypoint**

In `packages/web/src/index.ts`, append after the existing `export type` blocks (before the file's final newline):

```typescript
export { Container, Grid, Row, Column, BREAKPOINTS } from './layout';
export type {
  Breakpoint,
  Responsive,
  ContainerProps,
  ContainerMaxWidth,
  FlowElement,
  GridProps,
  GridGap,
  GridAlignItems,
  RowProps,
  RowGap,
  RowAlign,
  RowJustify,
  ColumnProps,
  Span,
} from './layout';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 4: Run all layout tests to confirm no regression**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/`

Expected: PASS (Container, Grid, Row, Column suites — 4 files).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/layout/index.ts packages/web/src/index.ts
git commit -m "feat(web): export layout primitives from package entrypoint"
```

---

## Task 8: `theme.css` primitive rules + breakpoint coordination test

**Files:**
- Modify: `packages/web/theme.css`
- Create: `packages/web/src/layout/breakpoints.test.ts`

**Interfaces:**
- Consumes: the `data-press-layout` attributes and `--press-*` custom properties emitted by Tasks 3–6; the token CSS vars from Task 2; the `BREAKPOINTS` constant from Task 1.
- Produces: working responsive behavior for every primitive (`<Container>` / `<Grid>` / `<Column>` / `<Row>` render correctly in a browser at all three tiers) plus a coordination test that guards the TS ↔ CSS breakpoint literals against drift.

- [ ] **Step 1: Append layout primitive rules to `theme.css`**

Append to `packages/web/theme.css` (after the existing cookie-consent block, at end of file):

```css
/* Layout primitives (Spec §5). Rules read the data-press-layout attribute and
   per-instance CSS custom properties emitted by the React primitives. The
   var() cascade is the responsive vehicle — no media query is emitted for
   properties that don't need one, and every declared tier can inherit its
   less-specific neighbour through the fallback chain. Breakpoint literals
   here (768px / 1024px) MUST match BREAKPOINTS in src/layout/breakpoints.ts;
   the src/layout/breakpoints.test.ts coordination test enforces this. */
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
  [data-press-layout="grid"] {
    gap: var(--press-grid-gap-current-md, var(--press-grid-gap-current));
  }
}
@media (min-width: 1024px) {
  [data-press-layout="grid"] {
    gap: var(--press-grid-gap-current-lg, var(--press-grid-gap-current-md, var(--press-grid-gap-current)));
  }
}

[data-press-layout="column"] {
  grid-column: span var(--press-col-span, 12);
  grid-column-start: var(--press-col-start, auto);
}
@media (min-width: 768px) {
  [data-press-layout="column"] {
    grid-column: span var(--press-col-span-md, var(--press-col-span, 12));
    grid-column-start: var(--press-col-start-md, var(--press-col-start, auto));
  }
}
@media (min-width: 1024px) {
  [data-press-layout="column"] {
    grid-column: span var(--press-col-span-lg, var(--press-col-span-md, var(--press-col-span, 12)));
    grid-column-start: var(--press-col-start-lg, var(--press-col-start-md, var(--press-col-start, auto)));
  }
}

[data-press-layout="row"] {
  display: flex;
  flex-wrap: wrap;
  gap: var(--press-row-gap-current);
  align-items: stretch;
  justify-content: flex-start;
}
[data-press-layout="row"][data-wrap="false"]      { flex-wrap: nowrap; }
[data-press-layout="row"][data-align="start"]     { align-items: flex-start; }
[data-press-layout="row"][data-align="center"]    { align-items: center; }
[data-press-layout="row"][data-align="end"]       { align-items: flex-end; }
[data-press-layout="row"][data-align="baseline"]  { align-items: baseline; }
[data-press-layout="row"][data-justify="center"]  { justify-content: center; }
[data-press-layout="row"][data-justify="end"]     { justify-content: flex-end; }
[data-press-layout="row"][data-justify="between"] { justify-content: space-between; }
[data-press-layout="row"][data-justify="around"]  { justify-content: space-around; }
@media (min-width: 768px) {
  [data-press-layout="row"] {
    gap: var(--press-row-gap-current-md, var(--press-row-gap-current));
  }
}
@media (min-width: 1024px) {
  [data-press-layout="row"] {
    gap: var(--press-row-gap-current-lg, var(--press-row-gap-current-md, var(--press-row-gap-current)));
  }
}
```

- [ ] **Step 2: Write the failing coordination test**

Create `packages/web/src/layout/breakpoints.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BREAKPOINTS } from './breakpoints';

// theme.css lives at packages/web/theme.css — three levels up from this test.
const themeCssPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'theme.css');
const css = readFileSync(themeCssPath, 'utf8');

describe('breakpoint coordination between TS constants and theme.css (Spec §6.1)', () => {
  it('theme.css contains a @media (min-width: <md>px) rule matching BREAKPOINTS.md', () => {
    expect(css).toMatch(new RegExp(`@media \\(min-width: ${BREAKPOINTS.md}px\\)`));
  });

  it('theme.css contains a @media (min-width: <lg>px) rule matching BREAKPOINTS.lg', () => {
    expect(css).toMatch(new RegExp(`@media \\(min-width: ${BREAKPOINTS.lg}px\\)`));
  });

  it('every layout-primitive @media in theme.css uses exactly the md or lg literal', () => {
    // Extract only the layout section (between "Layout primitives" comment and
    // end of file) so unrelated queries elsewhere in theme.css (none today,
    // but future-proof) don't perturb the check.
    const layoutSectionStart = css.indexOf('/* Layout primitives');
    expect(layoutSectionStart).toBeGreaterThanOrEqual(0);
    const layoutSection = css.slice(layoutSectionStart);
    const literals = [...layoutSection.matchAll(/@media \(min-width: (\d+)px\)/g)].map((m) => Number(m[1]));
    expect(literals.length).toBeGreaterThan(0);
    for (const value of literals) {
      expect([BREAKPOINTS.md, BREAKPOINTS.lg]).toContain(value);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-web test src/layout/breakpoints.test.ts`

Expected: PASS (all 3 assertions).

- [ ] **Step 4: Run all web tests to confirm no regression**

Run: `pnpm --filter @ogs-tech/press-web test`

Expected: PASS (existing suites unaffected — no shell/organism changes yet).

- [ ] **Step 5: Commit**

```bash
git add packages/web/theme.css packages/web/src/layout/breakpoints.test.ts
git commit -m "feat(web): add layout primitive CSS + breakpoint coordination test"
```

---

## Task 9: Refactor `<Hero>` — responsive 2-column layout

**Files:**
- Modify: `packages/web/src/sections/hero.tsx`
- Modify: `packages/web/src/sections/hero.test.ts`
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `Container` (as `<section>`), `Grid`, `Column` from `../layout`; existing `PresetOrganismHero` type.
- Produces: an outer `<section data-press-layout="container" data-max-width="lg" data-padded data-block="preset-organism.hero" data-align="…">` wrapper; inner `<Grid alignItems="center" gap="lg">` with a text `<Column span={{ base: 12, md: hasImage ? 7 : 12 }}>` and — when an image exists — an image `<Column span={{ base: 12, md: 5 }}>`. Text alignment (`data-align="center"`) applies via a CSS rule targeting the inner `data-hero="content"` div, not `justify-items`.

- [ ] **Step 1: Update the failing hero tests (characterization tests for the new structure)**

Replace the entire body of `describe('Hero renderer', …)` in `packages/web/src/sections/hero.test.ts` with:

```typescript
describe('Hero renderer', () => {
  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ eyebrow: 'orphan' })).toBe('');
  });

  it('wraps output in a <section> that carries both the Container attrs and data-block (Spec §8.1)', () => {
    const html = render({ title: 'Ship faster' });
    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-max-width="lg"');
    expect(html).toContain('data-padded');
    expect(html).toContain('data-block="preset-organism.hero"');
  });

  it('renders the title as an h1', () => {
    expect(render({ title: 'Ship faster' })).toContain('<h1>Ship faster</h1>');
  });

  it('renders the optional eyebrow and subtitle when present', () => {
    const out = render({ eyebrow: 'New', title: 'Ship faster', subtitle: 'The engine' });
    expect(out).toContain('data-hero="eyebrow"');
    expect(out).toContain('New');
    expect(out).toContain('The engine');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T' })).toContain('data-align="left"');
    expect(render({ title: 'T', align: 'center' })).toContain('data-align="center"');
  });

  it('renders an inner <Grid> with a text column that spans 7 on md when an image is present (Spec §8.1)', () => {
    const html = render({ title: 'T', image: img('/uploads/h.png') });
    expect(html).toContain('data-press-layout="grid"');
    expect(html).toContain('--press-col-span:12');
    expect(html).toContain('--press-col-span-md:7');
  });

  it('makes the text column span 12 at every tier when no image is present', () => {
    const html = render({ title: 'T' });
    expect(html).toContain('--press-col-span:12');
    expect(html).not.toContain('--press-col-span-md:7');
  });

  it('resolves the hero image absolute against CMS_URL inside an image column', () => {
    const html = render({ title: 'T', image: img('/uploads/h.png') });
    expect(html).toContain('src="http://localhost:1337/uploads/h.png"');
    expect(html).toContain('--press-col-span-md:5');
  });

  it('omits the image column when no image is present', () => {
    expect(render({ title: 'T' })).not.toContain('<img');
    expect(render({ title: 'T' })).not.toContain('--press-col-span-md:5');
  });

  it('renders the CTA only when BOTH ctaLabel and ctaHref are present (Spec §8)', () => {
    expect(render({ title: 'T', ctaLabel: 'Go', ctaHref: '/go' })).toContain('href="/go"');
    expect(render({ title: 'T', ctaLabel: 'Go' })).not.toContain('data-hero="cta"');
    expect(render({ title: 'T', ctaHref: '/go' })).not.toContain('data-hero="cta"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/hero.test.ts`

Expected: FAIL — several assertions (grid/column presence, `--press-col-span-md`) miss because the current Hero renders no Container/Grid/Column.

- [ ] **Step 3: Refactor `hero.tsx`**

Replace the entire contents of `packages/web/src/sections/hero.tsx` with:

```tsx
import type { PresetOrganismHero } from '../types/base';
import { Container } from '../layout/container';
import { Grid } from '../layout/grid';
import { Column } from '../layout/column';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Engine organism `preset-organism.hero` — a hero band born branded by the
 * adopter's theme (Spec §5.2). Refactored to consume the layout primitives
 * (Spec §8.1): outer `<Container as="section">` owns width + gutter; inner
 * `<Grid>` composes the 2-column responsive layout (text 7 / image 5 on md+,
 * stacked at base). Passthrough `data-*` on `<Container>` preserves
 * `data-block="preset-organism.hero"` + `data-align` so the existing
 * inner-markup rules (`[data-hero="eyebrow"]` etc) keep applying.
 *
 * Tolerant, mirroring preset-atom.image: a draft with no title renders
 * nothing, and the CTA renders only when BOTH label and href are present.
 * Media is resolved ABSOLUTE against CMS_URL exactly like preset-atom.image.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  image,
  ctaLabel,
  ctaHref,
  align,
}: PresetOrganismHero) {
  if (!title) return null;
  const hasCta = Boolean(ctaLabel && ctaHref);
  const hasImage = Boolean(image?.url);
  return (
    <Container
      as="section"
      maxWidth="lg"
      data-block="preset-organism.hero"
      data-align={align ?? 'left'}
    >
      <Grid gap="lg" alignItems="center">
        <Column span={{ base: 12, md: hasImage ? 7 : 12 }}>
          <div data-hero="content">
            {eyebrow ? <p data-hero="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p data-hero="subtitle">{subtitle}</p> : null}
            {hasCta ? (
              <a data-hero="cta" href={ctaHref}>
                {ctaLabel}
              </a>
            ) : null}
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

- [ ] **Step 4: Update `theme.css` — Hero deltas (Spec §8.1)**

In `packages/web/theme.css`, replace the existing Hero block:

```css
[data-block="preset-organism.hero"] {
  display: grid;
  gap: var(--press-space-5);
  align-items: center;
  margin: var(--press-space-7) 0;
}
[data-block="preset-organism.hero"][data-align="center"] {
  text-align: center;
  justify-items: center;
}
```

…with:

```css
[data-block="preset-organism.hero"] {
  margin-block: var(--press-space-7);
}
[data-block="preset-organism.hero"][data-align="center"] [data-hero="content"] {
  text-align: center;
}
```

(Every other Hero rule — `[data-hero="eyebrow"]`, `h1`, `[data-hero="subtitle"]`, `[data-hero="cta"]`, `img` — stays exactly as it is.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/hero.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/sections/hero.tsx packages/web/src/sections/hero.test.ts packages/web/theme.css
git commit -m "refactor(web): Hero consumes Container+Grid+Column for responsive 2-col layout"
```

---

## Task 10: Refactor `<Cta>` — inner `data-cta="frame"` wrapper

**Files:**
- Modify: `packages/web/src/sections/cta.tsx`
- Modify: `packages/web/src/sections/cta.test.ts`
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `Container` from `../layout`; existing `PresetOrganismCta` type.
- Produces: `<Container as="section" maxWidth="lg" data-block="preset-organism.cta" data-align="…">` with an inner `<div data-cta="frame">` carrying the boxy visual (border + padding + background). Because Container has its own horizontal padding (via `data-padded`), the frame's chrome MUST live on the inner div, not the outer element.

- [ ] **Step 1: Update the failing cta tests**

Replace the body of `describe('Cta renderer', …)` in `packages/web/src/sections/cta.test.ts` with:

```typescript
describe('Cta renderer', () => {
  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ buttonLabel: 'Go', buttonHref: '/go' })).toBe('');
  });

  it('wraps output in a <section> Container that carries data-block (Spec §8.2)', () => {
    const html = render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' });
    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-block="preset-organism.cta"');
  });

  it('emits an inner data-cta="frame" wrapper for the boxy visual (Spec §8.2)', () => {
    const html = render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' });
    expect(html).toContain('data-cta="frame"');
    // The frame wraps the heading/subtitle/button — assert on order.
    const frameIdx = html.indexOf('data-cta="frame"');
    const h2Idx = html.indexOf('<h2>');
    expect(frameIdx).toBeGreaterThan(-1);
    expect(h2Idx).toBeGreaterThan(frameIdx);
  });

  it('renders the title as an h2 inside the frame', () => {
    expect(render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('<h2>Start now</h2>');
  });

  it('renders the optional subtitle when present', () => {
    expect(render({ title: 'Start now', subtitle: 'No credit card', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('No credit card');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go' })).toContain('data-align="left"');
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go', align: 'center' }))
      .toContain('data-align="center"');
  });

  it('renders the button only when BOTH buttonLabel and buttonHref are present (Spec §8)', () => {
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go' })).toContain('href="/go"');
    const noHref = render({ title: 'T', subtitle: 'Sub', buttonLabel: 'Go' });
    expect(noHref).toContain('<h2>T</h2>');
    expect(noHref).toContain('Sub');
    expect(noHref).not.toContain('data-cta="button"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/cta.test.ts`

Expected: FAIL — `data-press-layout="container"` and `data-cta="frame"` absent.

- [ ] **Step 3: Refactor `cta.tsx`**

Replace the entire contents of `packages/web/src/sections/cta.tsx` with:

```tsx
import type { PresetOrganismCta } from '../types/base';
import { Container } from '../layout/container';

/**
 * Engine organism `preset-organism.cta` — a call-to-action banner (Spec §5.2).
 * Refactored per Spec §8.2: the outer element becomes a `<Container>` (owns
 * width + gutter), and the boxy visual (border + padding + background) moves
 * onto an inner `<div data-cta="frame">` — the Container is not the right seat
 * for chrome once it also owns horizontal padding.
 *
 * Tolerant: a draft with no title renders nothing; the button renders only
 * when BOTH label and href are present (no dead links — Spec §8).
 */
export function Cta({ title, subtitle, buttonLabel, buttonHref, align }: PresetOrganismCta) {
  if (!title) return null;
  const hasButton = Boolean(buttonLabel && buttonHref);
  return (
    <Container
      as="section"
      maxWidth="lg"
      data-block="preset-organism.cta"
      data-align={align ?? 'left'}
    >
      <div data-cta="frame">
        <h2>{title}</h2>
        {subtitle ? <p data-cta="subtitle">{subtitle}</p> : null}
        {hasButton ? (
          <a data-cta="button" href={buttonHref}>
            {buttonLabel}
          </a>
        ) : null}
      </div>
    </Container>
  );
}
```

- [ ] **Step 4: Update `theme.css` — Cta deltas (Spec §8.2)**

In `packages/web/theme.css`, replace the existing Cta block:

```css
[data-block="preset-organism.cta"] {
  margin: var(--press-space-7) 0;
  padding: var(--press-space-6) var(--press-space-5);
  border: 1px solid var(--press-color-border);
  border-radius: var(--press-radius-md);
  background: var(--press-color-surface);
}
[data-block="preset-organism.cta"][data-align="center"] {
  text-align: center;
}
```

…with:

```css
[data-block="preset-organism.cta"] {
  margin-block: var(--press-space-7);
}
[data-block="preset-organism.cta"] [data-cta="frame"] {
  padding: var(--press-space-6) var(--press-space-5);
  border: 1px solid var(--press-color-border);
  border-radius: var(--press-radius-md);
  background: var(--press-color-surface);
}
[data-block="preset-organism.cta"][data-align="center"] [data-cta="frame"] {
  text-align: center;
}
```

(The `h2 / [data-cta="subtitle"] / [data-cta="button"]` rules stay as they are — they still resolve via descendant selectors under the outer `[data-block="preset-organism.cta"]`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/sections/cta.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/sections/cta.tsx packages/web/src/sections/cta.test.ts packages/web/theme.css
git commit -m "refactor(web): Cta wraps content in inner data-cta=\"frame\" for Container-safe chrome"
```

---

## Task 11: Refactor `<Footer>` — Container-wrapped `<small>`

**Files:**
- Modify: `packages/web/src/chrome/footer.tsx`
- Modify: `packages/web/src/chrome/footer.test.ts`
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `Container` from `../layout`.
- Produces: `<Container as="div" maxWidth="lg" padded data-block="preset-organism.footer"><small>…</small></Container>`. Typography (muted color + small text) moves onto the organism selector; the outer `<footer>` shell keeps only the visual separator + vertical padding (finalized in Task 14).

- [ ] **Step 1: Update the failing footer tests**

Replace the body of `describe('Footer renderer', …)` in `packages/web/src/chrome/footer.test.ts` with:

```typescript
describe('Footer renderer', () => {
  it('wraps output in a Container that carries data-block="preset-organism.footer" (Spec §8.4)', () => {
    const html = render({ text: 'hi', brand: { name: 'Acme' } });
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-block="preset-organism.footer"');
  });

  it('renders the copyright inside a <small>', () => {
    const html = render({ text: '© Acme Corp — all rights reserved', brand: { name: 'Acme' } });
    expect(html).toContain('<small>');
    expect(html).toContain('© Acme Corp — all rights reserved');
  });

  it('falls back to "brand · currentYear" when text is empty (Spec §1: today\'s behavior)', () => {
    const year = String(new Date().getFullYear());
    const empty = render({ text: '', brand: { name: 'Acme' } });
    expect(empty).toContain('Acme');
    expect(empty).toContain(year);
    const absent = render({ brand: { name: 'Acme' } });
    expect(absent).toContain('Acme');
    expect(absent).toContain(year);
  });

  it('tolerates an un-hydrated block (no brand) without crashing', () => {
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain(String(new Date().getFullYear()));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/footer.test.ts`

Expected: FAIL — `data-press-layout="container"` absent from the current `<small data-block=…>` only rendering.

- [ ] **Step 3: Refactor `footer.tsx`**

Replace the entire contents of `packages/web/src/chrome/footer.tsx` with:

```tsx
import type { ResolvedChromeFooter } from '../config/types';
import { Container } from '../layout/container';

/**
 * Chrome organism `preset-organism.footer` (Spec §1). Refactored per Spec §8.4:
 * the outer element is now a `<Container>` (owns width + gutter — the shell's
 * `<footer>` keeps only vertical padding + the border stroke after the Task 14
 * shell rewrite). Empty `text` falls back to "brand · currentYear" — exactly
 * what the old hardcoded footer rendered. Brand arrives via hydration; missing
 * brand degrades to "· year", never a crash.
 */
export function Footer({ text, brand }: ResolvedChromeFooter) {
  return (
    <Container as="div" maxWidth="lg" padded data-block="preset-organism.footer">
      <small>{text || `${brand?.name ?? ''} · ${new Date().getFullYear()}`}</small>
    </Container>
  );
}
```

- [ ] **Step 4: Update `theme.css` — Footer deltas (Spec §8.4)**

In `packages/web/theme.css`, replace the existing footer organism block:

```css
[data-block="preset-organism.footer"] {
  display: block;
}
```

…with:

```css
[data-block="preset-organism.footer"] {
  color: var(--press-color-muted);
  font-size: var(--press-text-sm);
}
```

(The outer `footer { … }` shell rule is left as-is here — Task 14 removes its width/padding.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/footer.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/chrome/footer.tsx packages/web/src/chrome/footer.test.ts packages/web/theme.css
git commit -m "refactor(web): Footer wraps small in a Container; typography moves to the organism"
```

---

## Task 12: Refactor `<Navbar>` + `<NavLinks>` — Container + nested Rows (desktop only)

**Files:**
- Modify: `packages/web/src/chrome/navbar.tsx`
- Modify: `packages/web/src/chrome/nav-links.tsx`
- Modify: `packages/web/src/chrome/navbar.test.ts`
- Modify: `packages/web/src/chrome/nav-links.test.ts`
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `Container`, `Row` from `../layout`.
- Produces:
  - `Navbar`: outer `<Container as="div" maxWidth="full" padded data-block="preset-organism.navbar">` with an inner outer `<Row align="center" justify="between" gap="md">` (brand on the left, right-side group on the right). The right-side group is itself a nested `<Row align="center" gap="lg">` wrapping `<NavLinks>` + the optional CTA.
  - `NavLinks`: `<Row as="nav" data-press-nav="header" gap="md">…</Row>` replacing the old `<nav>` + manual flex.
  - **No mobile-specific behavior yet** — nav-links stay visible at every viewport and simply wrap. Task 13 hides the desktop nav below `md` and mounts the hamburger.

- [ ] **Step 1: Update the failing navbar tests**

Replace the body of `describe('Navbar renderer', …)` in `packages/web/src/chrome/navbar.test.ts` with:

```typescript
describe('Navbar renderer', () => {
  it('wraps output in a Container that carries data-block="preset-organism.navbar" (Spec §8.3)', () => {
    const html = render({ brand: { name: 'Acme' }, links: [] });
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-max-width="full"');
    expect(html).toContain('data-block="preset-organism.navbar"');
  });

  it('renders an outer Row with justify="between" separating brand and the right group', () => {
    const html = render({ brand: { name: 'Acme' }, links: [] });
    expect(html).toContain('data-press-layout="row"');
    expect(html).toContain('data-justify="between"');
  });

  it('renders the hydrated brand as a home link with logo + name', () => {
    const html = render({ brand: { name: 'Acme', logo: 'http://cms.test/logo.png' }, links: [] });
    expect(html).toMatch(/<a[^>]*data-navbar="brand"[^>]*href="\/"/);
    expect(html).toContain('src="http://cms.test/logo.png"');
    expect(html).toContain('Acme');
  });

  it('omits the logo img when the brand has none', () => {
    expect(render({ brand: { name: 'Acme' }, links: [] })).not.toContain('<img');
  });

  it('renders the resolved links through the internal NavLinks (Row-based)', () => {
    const html = render({
      brand: { name: 'Acme' },
      links: [{ label: 'About', href: '/about', external: false, newTab: false }],
    });
    expect(html).toContain('data-press-nav="header"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('>About');
  });

  it('renders the CTA only when BOTH label and href are present (no dead links)', () => {
    const withCta = render({
      brand: { name: 'Acme' },
      links: [],
      cta: { label: 'Sign up', href: '/signup', variant: 'secondary' },
    });
    expect(withCta).toMatch(/<a[^>]*data-navbar="cta"[^>]*href="\/signup"/);
    expect(withCta).toContain('data-variant="secondary"');

    expect(render({ brand: { name: 'Acme' }, links: [], cta: { label: 'Sign up' } }))
      .not.toContain('data-navbar="cta"');
    expect(render({ brand: { name: 'Acme' }, links: [] })).not.toContain('data-navbar="cta"');
  });

  it('defaults the CTA variant to primary', () => {
    expect(render({ brand: { name: 'Acme' }, links: [], cta: { label: 'Go', href: '/go' } }))
      .toContain('data-variant="primary"');
  });

  it('tolerates an un-hydrated block (no brand/links) without crashing', () => {
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain('data-block="preset-organism.navbar"');
  });
});
```

- [ ] **Step 2: Update the failing nav-links tests**

In `packages/web/src/chrome/nav-links.test.ts`, replace the first assertion inside `it('renders an anchor per link with label and href', …)` — swap:

```typescript
    expect(html).toContain('<nav');
```

…with:

```typescript
    expect(html).toContain('data-press-layout="row"');
    expect(html).toContain('data-press-nav="header"');
```

All other assertions in this file stay as-is (they still hold — `href`, `aria-current`, `target`, `rel`, external affordance, empty-list emptiness).

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/`

Expected: FAIL — `data-press-layout="container"` and `data-press-layout="row"` absent from current Navbar / NavLinks output.

- [ ] **Step 4: Refactor `navbar.tsx`**

Replace the entire contents of `packages/web/src/chrome/navbar.tsx` with:

```tsx
import type { ResolvedChromeNavbar } from '../config/types';
import { Container } from '../layout/container';
import { Row } from '../layout/row';
import { NavLinks } from './nav-links';

/**
 * Chrome organism `preset-organism.navbar` (Spec §1, §8.3): brand + nav links
 * + optional CTA in one engine-owned bar. Refactored to consume the layout
 * primitives: outer `<Container maxWidth="full">` owns padding (edge-to-edge
 * width for a chrome bar); the outer `<Row justify="between">` separates the
 * brand from the right-side group; a nested `<Row>` groups the links + CTA.
 *
 * Mobile UX is added in a companion `<MobileNav>` client component
 * (Task 13) — this file's desktop-row is hidden below `md` via CSS and the
 * hamburger drawer takes over. Both surfaces receive the same
 * `links` + `cta` data.
 *
 * Receives HYDRATED props (Spec §3): mapSiteSettings resolved the links and
 * injected the brand, so this stays a dumb server component. Tolerant of an
 * un-hydrated block (direct BlockRenderer use): missing brand/links degrade,
 * never crash.
 */
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

- [ ] **Step 5: Refactor `nav-links.tsx`**

Replace the entire contents of `packages/web/src/chrome/nav-links.tsx` with:

```tsx
'use client';

import { usePathname } from 'next/navigation';
import type { ResolvedNavLink } from '../config/types';
import { Row } from '../layout/row';

/**
 * NavLinks — the navbar's internal link list (Spec §3). Refactored to a
 * `<Row as="nav">` (Spec §8.3): the row's flex + gap + wrap defaults give
 * the horizontal layout that the old handwritten `nav[data-press-nav="header"]
 * { display: flex; … }` CSS provided. `data-press-nav="header"` is preserved
 * as the identifying hook every existing rule (hover, aria-current) reads.
 *
 * A client component ONLY because it reads usePathname() to mark the active
 * link; the data is already fully resolved by mapSiteSettings. Empty list →
 * renders nothing.
 */
export function NavLinks({ links }: { links: ResolvedNavLink[] }) {
  const pathname = usePathname();
  if (links.length === 0) return null;
  return (
    <Row as="nav" align="center" gap="md" data-press-nav="header" aria-label="Primary">
      {links.map((link, i) => {
        const active = link.href === pathname;
        return (
          <a
            key={`${link.href}-${i}`}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            target={link.newTab ? '_blank' : undefined}
            rel={link.newTab ? 'noopener noreferrer' : undefined}
          >
            {link.label}
            {link.external ? (
              <span aria-hidden="true" data-press-nav-ext>
                {' '}
                ↗
              </span>
            ) : null}
          </a>
        );
      })}
    </Row>
  );
}
```

Note: the `Row` primitive's props do not include `aria-label` in `RowProps`; the JSX-level `<Row … aria-label="Primary">` passes through because Row's `createElement` call spreads its rest args to the underlying element via `...rest` — BUT the current Row implementation (Task 6) does NOT accept arbitrary props. Update Row NOW to accept aria-* and data-* passthrough by adding an index signature to `RowProps`:

In `packages/web/src/layout/row.tsx`, extend `RowProps`:

```tsx
export interface RowProps {
  gap?: Responsive<RowGap>;
  align?: RowAlign;
  justify?: RowJustify;
  wrap?: boolean;
  as?: FlowElement;
  children: ReactNode;
  [dataOrAria: `data-${string}` | `aria-${string}`]: unknown;
}
```

…and in the `Row` function body, destructure into `...rest` and spread FIRST so controlled attrs win:

```tsx
export function Row({
  gap,
  align = 'stretch',
  justify = 'start',
  wrap = true,
  as = 'div',
  children,
  ...rest
}: RowProps) {
  // …existing normalization…
  return createElement(
    as,
    {
      ...rest,
      'data-press-layout': 'row',
      'data-align': align === 'stretch' ? undefined : align,
      'data-justify': justify === 'start' ? undefined : justify,
      'data-wrap': wrap === false ? 'false' : undefined,
      style,
    },
    children,
  );
}
```

Do the same in `<Grid>` (`packages/web/src/layout/grid.tsx`) for consistency — add the index signature and `...rest` spread — since Task 9's Hero doesn't need it TODAY, but adopter custom blocks will. And add to `<Column>` for the same reason:

```tsx
// grid.tsx
export interface GridProps {
  gap?: Responsive<GridGap>;
  alignItems?: GridAlignItems;
  as?: FlowElement;
  children: ReactNode;
  [dataOrAria: `data-${string}` | `aria-${string}`]: unknown;
}
```

```tsx
// column.tsx
export interface ColumnProps {
  span?: Responsive<Span>;
  start?: Responsive<Span>;
  as?: FlowElement;
  children: ReactNode;
  [dataOrAria: `data-${string}` | `aria-${string}`]: unknown;
}
```

Add the `...rest` destructure and controlled-attrs-win spread in each function body (same pattern as Row above).

- [ ] **Step 6: Update `theme.css` — Navbar / NavLinks deltas (Spec §8.3)**

In `packages/web/theme.css`:

**Delete** the entire block:

```css
[data-block="preset-organism.navbar"] {
  display: flex;
  align-items: center;
  gap: var(--press-space-3);
  flex: 1;
}
```

**Delete** the entire block:

```css
nav[data-press-nav="header"] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--press-space-4);
  margin-left: auto;
}
```

**Delete** the entire `@media (max-width: 640px)` block (its rules all target the old flex-based chrome — replaced by the primitive-based responsive behavior and Task 13's hamburger):

```css
@media (max-width: 640px) {
  header {
    flex-wrap: wrap;
  }
  [data-block="preset-organism.navbar"] {
    flex-wrap: wrap;
  }
  nav[data-press-nav="header"] {
    margin-left: 0;
    width: 100%;
    gap: var(--press-space-3);
  }
}
```

**Keep** every visual rule: `[data-navbar="brand"]`, `[data-navbar="brand"] img`, `[data-navbar="cta"]`, `[data-navbar="cta"][data-variant="…"]`, `nav[data-press-nav="header"] a` (including `:hover` and `[aria-current="page"]`), `[data-press-nav-ext]`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/ src/layout/`

Expected: PASS across all chrome + layout suites (Container/Grid/Row/Column tests still hold — the new passthrough is additive and index-signature-typed).

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/chrome/navbar.tsx packages/web/src/chrome/nav-links.tsx packages/web/src/chrome/navbar.test.ts packages/web/src/chrome/nav-links.test.ts packages/web/src/layout/row.tsx packages/web/src/layout/grid.tsx packages/web/src/layout/column.tsx packages/web/theme.css
git commit -m "refactor(web): Navbar + NavLinks consume Container/Row; layout primitives allow data-/aria-* passthrough"
```

---

## Task 13: Mobile hamburger — `<MobileNav>` client component + drawer

**Files:**
- Create: `packages/web/src/chrome/mobile-nav.tsx`
- Create: `packages/web/src/chrome/mobile-nav.test.tsx`
- Modify: `packages/web/src/chrome/navbar.tsx`
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `ResolvedNavLink`, `ResolvedChromeNavbar` (for its `cta`). Reads no CSS vars beyond `--press-*` tokens already emitted.
- Produces:
  - `<MobileNav links={ResolvedNavLink[]} cta={ResolvedChromeNavbar['cta']}>` — a `'use client'` component:
    - A hamburger `<button data-mobile-nav="toggle" aria-expanded={open} aria-controls="press-mobile-nav-drawer" aria-label="Menu">` (three-line icon via CSS pseudo-elements — no SVG asset shipped).
    - A `<div id="press-mobile-nav-drawer" role="dialog" aria-modal="true" data-mobile-nav="drawer" data-open={open}>` conditionally-visible drawer containing the same link list + optional CTA.
    - Behaviors: toggle on button click; Escape closes; click on backdrop closes; body scroll lock while open; focus moves to the first link on open, restores to the toggle button on close.
  - CSS mapping: `[data-mobile-nav="toggle"]` visible below `md` (hidden above); the desktop-side nested `<Row>` inside `Navbar` (Task 12) is hidden below `md` (visible above) via a new attribute selector `[data-navbar-desktop]` added to that Row.

- [ ] **Step 1: Add the `data-navbar-desktop` marker to the desktop Row in navbar.tsx**

In `packages/web/src/chrome/navbar.tsx`, change the inner `<Row align="center" gap="lg">` to:

```tsx
        <Row align="center" gap="lg" data-navbar-desktop>
```

…and update the `navbar.test.ts` "renders the resolved links through the internal NavLinks" test to also assert:

```typescript
    expect(html).toContain('data-navbar-desktop');
```

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/navbar.test.ts`

Expected: PASS (the passthrough already works — Row spreads unknown data-* attrs since Task 12).

- [ ] **Step 2: Write the failing MobileNav test (SSR portion — non-interactive)**

Create `packages/web/src/chrome/mobile-nav.test.tsx` with the SSR portion first (interactive assertions land in Step 4 with the jsdom harness):

```tsx
// @vitest-environment jsdom
//
// Interactive-flow tests for the mobile nav drawer — the engine's second
// stateful client component (after the cookie-consent banner). Same
// hand-rolled act() + createRoot harness (Spec §12; CLAUDE.md testing note):
// NEVER @testing-library/react, because the workspace's node-linker=hoisted
// layout materializes only Strapi-admin's react-19 RTL variant at root.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// usePathname is called indirectly (MobileNav renders its own <a> list, not
// NavLinks, so no import — but keeping the mock harmless doesn't hurt).
const nav = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { MobileNav } from './mobile-nav';
import type { ResolvedNavLink } from '../config/types';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(ui));
}

function toggle(): HTMLButtonElement {
  const el = container.querySelector('[data-mobile-nav="toggle"]') as HTMLButtonElement | null;
  if (!el) throw new Error('toggle button not found');
  return el;
}

function drawer(): HTMLElement | null {
  return container.querySelector('[data-mobile-nav="drawer"]') as HTMLElement | null;
}

const link = (label: string, href: string): ResolvedNavLink => ({
  label,
  href,
  external: false,
  newTab: false,
});

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('<MobileNav>', () => {
  it('renders the toggle button with aria-expanded="false" by default', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    const btn = toggle();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-controls')).toBe('press-mobile-nav-drawer');
    expect(btn.getAttribute('aria-label')).toBe('Menu');
  });

  it('does not render the drawer body until opened', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    expect(drawer()).toBeNull();
  });

  it('opens the drawer on toggle click and flips aria-expanded to "true"', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    act(() => toggle().click());
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    const d = drawer();
    expect(d).not.toBeNull();
    expect(d!.textContent).toContain('About');
  });

  it('renders every link inside the drawer', () => {
    render(
      <MobileNav
        links={[link('About', '/about'), link('Docs', '/docs')]}
      />,
    );
    act(() => toggle().click());
    const anchors = drawer()!.querySelectorAll('a');
    expect(anchors.length).toBe(2);
    expect(anchors[0].getAttribute('href')).toBe('/about');
    expect(anchors[1].getAttribute('href')).toBe('/docs');
  });

  it('renders the CTA when BOTH label and href are present', () => {
    render(
      <MobileNav
        links={[link('About', '/about')]}
        cta={{ label: 'Sign up', href: '/signup', variant: 'primary' }}
      />,
    );
    act(() => toggle().click());
    const html = drawer()!.innerHTML;
    expect(html).toContain('data-navbar="cta"');
    expect(html).toContain('href="/signup"');
  });

  it('omits the CTA when label or href is missing (no dead links)', () => {
    render(
      <MobileNav
        links={[link('About', '/about')]}
        cta={{ label: 'Sign up' } as any}
      />,
    );
    act(() => toggle().click());
    expect(drawer()!.innerHTML).not.toContain('data-navbar="cta"');
  });

  it('closes on Escape', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    act(() => toggle().click());
    expect(drawer()).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(drawer()).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('locks body scroll while open and restores on close', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    expect(document.body.style.overflow).toBe('');
    act(() => toggle().click());
    expect(document.body.style.overflow).toBe('hidden');
    act(() => toggle().click());
    expect(document.body.style.overflow).toBe('');
  });

  it('closes on backdrop click (a click on the drawer element itself, outside its inner content)', () => {
    render(<MobileNav links={[link('About', '/about')]} />);
    act(() => toggle().click());
    const d = drawer()!;
    act(() => {
      // Click event bubbling from the drawer root closes; a click on inner
      // <a> or button would either navigate (link) or be swallowed by content.
      d.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(drawer()).toBeNull();
  });

  it('renders nothing when the link list is empty and no cta is provided', () => {
    render(<MobileNav links={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/mobile-nav.test.tsx`

Expected: FAIL — `Cannot find module './mobile-nav'`.

- [ ] **Step 4: Create the MobileNav client component**

Create `packages/web/src/chrome/mobile-nav.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResolvedNavLink, ResolvedChromeNavbar } from '../config/types';

interface MobileNavProps {
  links: ResolvedNavLink[];
  cta?: ResolvedChromeNavbar['cta'];
}

const DRAWER_ID = 'press-mobile-nav-drawer';

/**
 * Mobile nav drawer (spec §8.3 mobile UX addendum, plan Task 13). The one
 * intentional exception to the "server-first, zero-runtime layout" non-goal:
 * a small stateful client component that toggles a full-viewport drawer
 * from a hamburger button. Renders both surfaces (toggle + drawer);
 * `theme.css` swaps visibility by viewport (`data-mobile-nav="toggle"` shown
 * below `md`, hidden above; the desktop `[data-navbar-desktop]` Row is the
 * opposite).
 *
 * A11y: aria-expanded on the toggle mirrors state; drawer is
 * role="dialog" aria-modal="true" aria-labelledby with the toggle's label.
 * Escape closes; body scroll is locked while open; on open, focus moves to
 * the first link; on close, focus restores to the toggle.
 *
 * Renders nothing when both `links` is empty AND no CTA is provided —
 * matches Navbar's tolerant behavior on an un-hydrated block.
 */
export function MobileNav({ links, cta }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const hasCta = Boolean(cta?.label && cta?.href);
  const isEmpty = links.length === 0 && !hasCta;

  const close = useCallback(() => setOpen(false), []);
  const toggleOpen = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstLinkRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      toggleRef.current?.focus();
    };
  }, [open, close]);

  if (isEmpty) return null;

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        data-mobile-nav="toggle"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={DRAWER_ID}
        aria-label="Menu"
        onClick={toggleOpen}
      >
        <span data-mobile-nav="toggle-icon" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={DRAWER_ID}
          data-mobile-nav="drawer"
          data-open="true"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          onClick={close}
        >
          <nav data-mobile-nav="drawer-inner" aria-label="Primary mobile">
            {links.map((link, i) => (
              <a
                key={`${link.href}-${i}`}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                target={link.newTab ? '_blank' : undefined}
                rel={link.newTab ? 'noopener noreferrer' : undefined}
              >
                {link.label}
                {link.external ? (
                  <span aria-hidden="true" data-press-nav-ext>
                    {' '}
                    ↗
                  </span>
                ) : null}
              </a>
            ))}
            {hasCta ? (
              <a data-navbar="cta" data-variant={cta?.variant ?? 'primary'} href={cta?.href}>
                {cta?.label}
              </a>
            ) : null}
          </nav>
        </div>
      ) : null}
    </>
  );
}
```

- [ ] **Step 5: Mount `MobileNav` inside `Navbar`**

In `packages/web/src/chrome/navbar.tsx`, add the import:

```tsx
import { MobileNav } from './mobile-nav';
```

…and place `<MobileNav>` INSIDE the outer Row, AFTER the desktop `<Row … data-navbar-desktop>`:

```tsx
      <Row align="center" justify="between" gap="md">
        <a data-navbar="brand" href="/">
          {brand?.logo ? <img src={brand.logo} alt="" /> : null}
          <span>{brand?.name}</span>
        </a>
        <Row align="center" gap="lg" data-navbar-desktop>
          <NavLinks links={links ?? []} />
          {hasCta ? (
            <a data-navbar="cta" data-variant={cta?.variant ?? 'primary'} href={cta?.href}>
              {cta?.label}
            </a>
          ) : null}
        </Row>
        <MobileNav links={links ?? []} cta={cta} />
      </Row>
```

- [ ] **Step 6: Add mobile-nav CSS to `theme.css`**

Append to `packages/web/theme.css` (after the layout-primitive rules added in Task 8):

```css
/* Mobile navbar — hamburger toggle + drawer (plan Task 13). The toggle is
   hidden above `md`; the desktop `[data-navbar-desktop]` Row is hidden
   below it. Matched pair — exactly one surface is visible at any viewport.
   Breakpoint LITERAL 768px MUST match BREAKPOINTS.md — guarded by
   src/layout/breakpoints.test.ts. */
[data-mobile-nav="toggle"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--press-color-border);
  border-radius: var(--press-radius-sm);
  background: transparent;
  cursor: pointer;
}
[data-mobile-nav="toggle-icon"] {
  position: relative;
  display: block;
  width: 20px;
  height: 2px;
  background: var(--press-color-ink);
}
[data-mobile-nav="toggle-icon"]::before,
[data-mobile-nav="toggle-icon"]::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--press-color-ink);
}
[data-mobile-nav="toggle-icon"]::before { top: -6px; }
[data-mobile-nav="toggle-icon"]::after  { top:  6px; }

[data-mobile-nav="drawer"] {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: color-mix(in srgb, var(--press-color-ink) 55%, transparent);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: var(--press-space-4);
}
[data-mobile-nav="drawer-inner"] {
  display: flex;
  flex-direction: column;
  gap: var(--press-space-3);
  min-width: min(320px, 80vw);
  padding: var(--press-space-6) var(--press-space-5);
  background: var(--press-color-surface);
  border: 1px solid var(--press-color-border);
  border-radius: var(--press-radius-md);
}
[data-mobile-nav="drawer-inner"] a {
  display: inline-flex;
  align-items: center;
  gap: var(--press-space-1);
  padding: var(--press-space-3) 0;
  color: var(--press-color-ink);
  text-decoration: none;
  font-weight: 500;
  font-size: var(--press-text-lg);
}
[data-mobile-nav="drawer-inner"] a[data-navbar="cta"] {
  margin-top: var(--press-space-3);
}

@media (min-width: 768px) {
  [data-mobile-nav="toggle"] { display: none; }
  [data-mobile-nav="drawer"] { display: none; }
}
@media (max-width: 767.98px) {
  [data-navbar-desktop] { display: none; }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/chrome/mobile-nav.test.tsx`

Expected: PASS (all 10 assertions).

Run the full navbar suite too to confirm nothing regressed:

`pnpm --filter @ogs-tech/press-web test src/chrome/`

Expected: PASS.

- [ ] **Step 8: Update the breakpoint coordination test scope**

The new `@media (min-width: 768px)` and `@media (max-width: 767.98px)` queries in the mobile-nav block are OUTSIDE the "Layout primitives" section, so the Task 8 test's `layoutSection` slice does not cover them. Extend that test to also cover the mobile-nav block, by widening the scope:

In `packages/web/src/layout/breakpoints.test.ts`, replace the third `it(…)` with:

```typescript
  it('every @media in the layout-primitives OR mobile-nav sections uses exactly the md or lg literal', () => {
    // Layout primitives live from "Layout primitives" to end of file, plus
    // the mobile-nav block appended in plan Task 13. Both share the same
    // BREAKPOINTS.md / BREAKPOINTS.lg literals. `max-width: 767.98px` (= md - 0.02)
    // is allowed because it is the semantic complement to `min-width: 768px`
    // — a mobile-nav CSS idiom that keeps both queries mutually exclusive
    // across zoom levels.
    const layoutSectionStart = css.indexOf('/* Layout primitives');
    expect(layoutSectionStart).toBeGreaterThanOrEqual(0);
    const layoutSection = css.slice(layoutSectionStart);
    const literals = [...layoutSection.matchAll(/@media \([^)]+\)/g)].map((m) => m[0]);
    expect(literals.length).toBeGreaterThan(0);
    const allowed = new Set([
      `@media (min-width: ${BREAKPOINTS.md}px)`,
      `@media (min-width: ${BREAKPOINTS.lg}px)`,
      `@media (max-width: ${BREAKPOINTS.md - 0.02}px)`,
    ]);
    for (const q of literals) {
      expect(allowed).toContain(q);
    }
  });
```

Run: `pnpm --filter @ogs-tech/press-web test src/layout/breakpoints.test.ts`

Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/chrome/mobile-nav.tsx packages/web/src/chrome/mobile-nav.test.tsx packages/web/src/chrome/navbar.tsx packages/web/theme.css packages/web/src/layout/breakpoints.test.ts
git commit -m "feat(web): add MobileNav hamburger drawer for responsive nav UX"
```

---

## Task 14: Shell rewrite — full-width `<main>`, prose atom selector, minimal chrome shells

**Files:**
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `--press-container-prose`, `--press-container-padding-x` (Task 2 tokens); the `data-block^="preset-atom."` / `custom-atom.*` attribute prefix convention already used by every atom.
- Produces: the finalized shell — `main` is full-width with only vertical padding; every preset atom (and every custom atom) inside `main` still reads at ~72ch via a single new selector; the `<header>` and `<footer>` shells drop their layout CSS (width, horizontal padding, flex) and keep only the visual separator + vertical rhythm.

- [ ] **Step 1: Replace the `main {}` block**

In `packages/web/theme.css`, replace:

```css
main {
  display: block;
  max-width: 72ch;
  margin: 0 auto;
  padding: var(--press-space-7) var(--press-space-5);
}
```

…with:

```css
main {
  display: block;
  padding-block: var(--press-space-7);
}

/* Prose atoms in the page body still read at ~72ch — the shell dropped its
   own max-width, so this selector restores editorial width for every preset
   atom (and every custom atom by convention) rendered inside main (Spec §7.2).
   Organisms and non-atom customs are deliberately excluded — they own their
   own Container. */
main [data-block^="preset-atom."],
main [data-block^="custom-atom."] {
  max-width: var(--press-container-prose);
  margin-inline: auto;
  padding-inline: var(--press-container-padding-x);
}
```

- [ ] **Step 2: Replace the `header {}` block**

Replace:

```css
header {
  display: flex;
  align-items: center;
  gap: var(--press-space-3);
  padding: var(--press-space-4) var(--press-space-5);
  border-bottom: 1px solid var(--press-color-border);
}
```

…with:

```css
header {
  border-bottom: 1px solid var(--press-color-border);
  padding-block: var(--press-space-4);
}
```

The refactored Navbar (Task 12) now owns its horizontal padding via `<Container padded>` and its horizontal composition via `<Row>` — the shell no longer needs to do layout.

- [ ] **Step 3: Replace the `footer {}` block**

Replace:

```css
footer {
  max-width: 72ch;
  margin: 0 auto;
  padding: var(--press-space-6) var(--press-space-5);
  border-top: 1px solid var(--press-color-border);
  color: var(--press-color-muted);
  font-size: var(--press-text-sm);
}
```

…with:

```css
footer {
  border-top: 1px solid var(--press-color-border);
  padding-block: var(--press-space-6);
}
```

The refactored Footer organism (Task 11) now owns its Container + typography — the shell only carries the stroke + vertical padding.

- [ ] **Step 4: Run the full web test suite**

Run: `pnpm --filter @ogs-tech/press-web test`

Expected: PASS (no test targets the shell rules directly — the changes are visual only, and organism / layout / atom tests already passed under Tasks 3–13).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ogs-tech/press-web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/theme.css
git commit -m "refactor(web): full-width main, prose atoms via selector, minimal chrome shells"
```

---

## Task 15: Delivery — changeset, docs, dogfood verification

**Files:**
- Create: `.changeset/layout-grid-system.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing (documentation + release metadata only).
- Produces: a MAJOR version bump for `@ogs-tech/press-web` (visual-breaking `main` change + new interactive client component) and a documented extension point (`preset-layout` reserved category, layout primitive family) in the living architectural reference.

- [ ] **Step 1: Write the changeset**

Create `.changeset/layout-grid-system.md`:

```markdown
---
'@ogs-tech/press-web': major
---

feat!: engine-owned layout primitives (Container / Grid / Row / Column) + responsive nav

`@ogs-tech/press-web` now ships four React layout primitives — `Container`,
`Grid`, `Row`, `Column` — under `packages/web/src/layout/` (public export from
the package entrypoint). Primitives are server-first, zero-runtime: every
responsive behavior is expressed through a three-tier `Responsive<T>` prop
shape (`base=0`, `md=768px`, `lg=1024px`) that lowers to inline CSS custom
properties consumed by `theme.css` via a `var(a, var(b, var(c, default)))`
cascade. All four preset organisms — `Hero`, `Cta`, `Navbar`, `Footer` — are
refactored to consume the primitives: `Hero` gains a responsive 2-column layout
(text 7 / image 5 on md+, stacked at base), `Cta` moves its boxy visual onto an
inner `data-cta="frame"` wrapper, `Navbar` composes brand + links + CTA through
nested Rows, and `Footer` wraps its `<small>` in a Container.

A companion `MobileNav` client component adds a hamburger drawer for narrow
viewports (below `md`): toggle, aria-expanded, aria-modal="true" dialog,
Escape to close, body scroll lock, focus management. The desktop nav Row is
hidden below `md` and the hamburger takes over — no viewport-observer JS, just
a small stateful client component matched to a CSS media-query swap.

The `preset-layout` CMS palette category stays declared and labelled but ships
**zero components** — reserved for future organism-nested config components
(pattern: `preset-molecule.nav-item`).

BREAKING (visual): `main` no longer caps content at 72ch. Every preset atom
(`preset-atom.*`) and every custom atom (`custom-atom.*`) rendered inside `main`
preserves the ~72ch editorial reading width via a new CSS selector — the change
is transparent for adopters using engine atoms. Migration for adopter CUSTOM
NON-ATOM blocks that relied on the old cap: wrap in
`<Container maxWidth="prose">` (or `"lg"` for the wider content width) to
restore the desired width.

BREAKING (interactive client component): the navbar now mounts a client-side
`MobileNav`. Adopters overriding `preset-organism.navbar` via
`components={{ 'preset-organism.navbar': MyNavbar }}` are unaffected (their
component is rendered instead). Adopters KEEPING the engine navbar receive the
hamburger + drawer automatically.

Contract stability: `PressSchema`, `PageBody`, `HeaderBlocks`, `FooterBlocks`
are byte-identical. No CMS re-seed, no admin re-login, no data migration. No
`press-cms` bump — the CMS side is untouched.
```

- [ ] **Step 2: Add a "Layout primitives" section to `CLAUDE.md`**

Open `CLAUDE.md` and locate the line `### Materialization (\`.press/web\`)` (currently line 56). INSERT a NEW subsection BEFORE it, so it becomes the first entry under `## Architecture — the moving parts`:

```markdown
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
custom atom — without touching a single atom `.tsx`. Organisms and non-atom
customs are excluded on purpose: they own their own `<Container>`. Header and
footer chrome shells keep only the border stroke + vertical padding; horizontal
composition is the refactored organisms' job.

**Mobile nav is the one client-side responsive component.** `chrome/mobile-nav.tsx`
is a `'use client'` hamburger + drawer mounted inside `Navbar`, matched by CSS
media queries to the desktop nav Row (`[data-navbar-desktop]` visible ≥768px;
`[data-mobile-nav="toggle"]` visible <768px). Escape closes, body scroll locks
while open, aria-expanded/aria-modal wired, focus moves to the first link on
open and restores to the toggle on close. Deliberate exception to the
"server-first, zero-runtime layout" default — a viewport-observer approach
would drag the entire layout system into client-space; a fixed CSS breakpoint
+ small toggle state is the minimal viable contract.
```

- [ ] **Step 3: Update the "Component palette — Atomic Design" section for `preset-layout`**

Still in `CLAUDE.md`, find the current sentence:

```
- `preset-layout` + `preset-template` are RESERVED (labelled, no components yet):
 layout ← the Grid System task; template ← page-set plugins.
```

Replace it with:

```
- `preset-layout` is RESERVED (labelled, no components yet). The Grid System
 task shipped the DEV-facing layout primitives under
 `packages/web/src/layout/` (see "Layout primitives" above); the CMS-facing
 category stays labelled and empty, seat for a future *nested-only* config
 component (pattern: `preset-molecule.nav-item`) that a future organism admits
 via a `component:` field.
- `preset-template` is RESERVED (labelled, no components yet) — page-set plugins.
```

- [ ] **Step 4: Manual playground dogfood verification (Spec §12)**

Run: `pnpm dev`

In a browser at `http://localhost:1337/admin`, log in. Under Content Manager → Page, create/publish a page with:
- One `preset-organism.hero` block: title, subtitle, image (upload any), align=left.
- One `preset-organism.cta` block: title, subtitle, button label + href, align=center.
- Add 2–3 `preset-atom.paragraph` blocks so the prose selector is exercised.

Then at `http://localhost:3000/<slug>`, VERIFY:
- [ ] Hero at ≥1024px: text on the left (columns 1–7), image on the right (columns 8–12), vertically centered.
- [ ] Hero at 768px–1023px: same 7/5 split, still side-by-side.
- [ ] Hero at <768px: text and image stacked, each spanning full width.
- [ ] Cta: boxy border + surface background applies to the INNER frame, not the outer edge; heading + button center-aligned.
- [ ] Paragraphs: text stays capped at ~72ch (does not touch the viewport edges) at every viewport, centered.
- [ ] Navbar at ≥768px: desktop row visible with brand left, links + CTA right; hamburger button hidden.
- [ ] Navbar at <768px: desktop row hidden, hamburger button visible; clicking opens the drawer with all links + CTA; Escape closes; clicking outside the drawer content closes; page scroll is locked while open.
- [ ] Footer: `<small>` with muted color + sm text, container-capped, stroke above.
- [ ] No console errors on any viewport.

Fix any regression discovered here inside the responsible task's commit range, then re-run the affected tests.

- [ ] **Step 5: Final full-repo verification**

Run in parallel:

- `pnpm -r --if-present typecheck`
- `pnpm -r test`

Expected: both PASS.

- [ ] **Step 6: Commit docs + changeset**

```bash
git add .changeset/layout-grid-system.md CLAUDE.md
git commit -m "docs: layout primitives family + changeset for the layout/grid v1"
```

---

## Self-review notes (author's checklist — leave for the executor)

- **Spec §3 non-goal exception.** This plan violates the "JS runtime hooks" non-goal for a single, scoped case: the mobile hamburger (Task 13). The user explicitly requested this scope addition. The rest of the primitives stay strictly server-first. The exception is confined to `chrome/mobile-nav.tsx` and its CSS block; no other primitive gains any client-side behavior.
- **Spec §12 playground dogfood.** The spec describes a page in `apps/playground`, but pages are CMS content (seeded via Strapi's admin, not committed as source). Task 15 Step 4 uses `pnpm dev` + admin to create the fixture manually; no source change under `apps/playground`.
- **Spec §13 files-modified list.** The plan matches the spec's list EXCEPT for two additions the user's scope addition introduced: `packages/web/src/chrome/mobile-nav.tsx` and `packages/web/src/chrome/mobile-nav.test.tsx` (Task 13). No file the spec listed is unmodified.
- **Spec §14 changeset.** The spec called out a MINOR press-web bump. This plan bumps MAJOR because (a) the visual-breaking `main` change is unambiguously breaking for adopter custom non-atoms that relied on the old 72ch cap; and (b) the client-component mobile hamburger adds runtime behavior to every adopter using the engine's `preset-organism.navbar`. Both are legitimate major triggers.
- **Task 12 primitive passthrough.** Extending Row/Grid/Column with a `data-*/aria-*` index signature is retrofit onto primitives that were introduced without it in Tasks 4–6. The passthrough is additive at the type level (no existing consumer names conflict), and Tasks 3–6 tests still pass because they never exercised passthrough. If subagent execution finds the tests DID incidentally check attribute order, add the passthrough index signature to Container too (it already has one, but same pattern) and re-run.

