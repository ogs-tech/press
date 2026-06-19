---
title: "Spec — Theming mechanism + Default theme"
internal_name: press-default-theme
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-19
updated_at: 2026-06-19
---

# Spec — Theming mechanism + Default theme

> [!NOTE]
> Picks up the theming surface that the whitelabel spec
> ([2026-06-11-press-config-whitelabel-design.md](2026-06-11-press-config-whitelabel-design.md)
> §2) **deliberately deferred**: "Theme tokens (colors/fonts wired to Tailwind)
> are out — they couple the contract to Tailwind and inflate the non-breakage
> obligation." This spec lands theming **without** that coupling — tokens are
> plain CSS custom properties emitted by an engine helper, no build-time CSS
> framework — so the original concern is honoured, not reopened.

**TL;DR** — Today the materialized host renders `<html><body>{children}</body></html>`
with **zero CSS**, so reference blocks render as bare HTML (the "Hello from
press" Times-New-Roman page). This spec adds a **theming mechanism**: the engine
ships a static stylesheet (`theme.css`) that styles reference blocks, global
typography, and a minimal page shell entirely through `var(--press-*)` custom
properties; a pure helper (`buildThemeStyle`, mirroring `buildMetadata`) emits a
`:root{ --press-* }` block from the `theme` key resolved out of `press.config.ts`.
The engine ships **one embedded theme — the Default theme** — whose token values
are derived from the OGS brand guidelines but whose identity is "the engine's
neutral default", not a branded preset. Adopters re-theme by overriding tokens in
`press.config.ts`; they never touch engine-owned files.

## 1. The question (single anchor)

> Can the engine make a press site look finished out of the box — styled
> reference blocks, real typography, a page shell — through a theme that is
> **data the adopter owns** (`theme` tokens in `press.config.ts`) rather than
> **code the adopter edits**, so the zone boundary holds: the engine owns the
> *how* (stylesheet + token derivation), the adopter owns the *what* (token
> values), and an engine `upgrade` never rewrites the adopter's config?

## 2. Scope decisions (2026-06-19)

Taken during brainstorming, before design:

1. **One embedded theme, named "Default".** The engine ships a single theme. Its
   values come from the OGS brand guidelines, but it is positioned and named as
   the engine's **neutral default** — not "the OGS theme", and not a branded
   named preset. There is no preset-selection mechanism (`theme: 'ogs'`); the
   default is the baseline and adopters override token values on top of it.
2. **In scope:** (a) global typography + light reset, (b) styled reference
   blocks (the `press.hero`), (c) a minimal page shell (content container +
   header/footer driven by existing `brand` config).
3. **Out of scope (deferred):** dark mode (tokens are structured so it can be
   added later without a breaking change), CMS-driven navigation, custom
   header/footer "slots", and arbitrary runtime font swapping (see §6 caveat).
4. **Mechanism:** engine-shipped CSS + CSS custom properties. **No Tailwind, no
   CSS-in-JS, no CSS Modules** — zero new build dependency, RSC/SSR-safe, and it
   reuses the `data-block` attribute the blocks already emit.

## 3. Architecture & data flow

Three new pieces, each following an existing engine pattern.

```
press.config.ts (Project zone)              @ogs-tech/press-web (engine)
  theme?: { colors, fonts, radius }  ──►  resolveConfig()   → fills Default-theme defaults
                                          buildThemeStyle()  → ":root{ --press-* }" string (pure)
                                                   │
host materialized (.press/web)  ◄─── engine owns the template
  layout.tsx:
    import '@ogs-tech/press-web/theme.css'        // static engine stylesheet
    next/font/google  → --press-font-*-default    // 3 Default-theme fonts
    <style>{buildThemeStyle(config)}</style>      // tokens injected in <head>
    <html className={fonts}> shell + {children}
                                                   │
theme.css matches  [data-block="press.hero"], body, main, header, footer  via var(--press-*)
```

1. **`theme.css`** — a static stylesheet published in `@ogs-tech/press-web`,
   imported once by the materialized `layout.tsx` (global CSS, only legal in a
   layout under the App Router). Styles everything through `var(--press-*)`. The
   *how*.
2. **`buildThemeStyle(config)`** — a pure helper that returns the `:root{ --press-* }`
   CSS string from the resolved `theme`. **Mirrors `buildMetadata` exactly**:
   same input → same output, no I/O, no mutation, safe as a module constant
   under RSC/SSR. The bridge from config → CSS.
3. **`theme` in `PressConfig`** + Default-theme defaults in `resolveConfig`. The
   *what* the adopter controls.

## 4. Token model

The override surface is **semantic-lean (80/20)**: the adopter overrides colors,
fonts, and radii; the engine derives the spacing and type scales (rarely
customized). Defaults are the Default-theme values.

| Token | Default value | Adopter override |
|---|---|---|
| `--press-color-primary` | `#119350` | ✅ `theme.colors.primary` |
| `--press-color-accent` | `#D9A12C` | ✅ `theme.colors.accent` |
| `--press-color-secondary` | `#3D5CC2` | ✅ `theme.colors.secondary` |
| `--press-color-ink` | `#142036` (text) | ✅ `theme.colors.ink` |
| `--press-color-surface` | `#FAF8F3` (page bg) | ✅ `theme.colors.surface` |
| `--press-color-muted` | `#7A7E89` (secondary text) | ✅ `theme.colors.muted` |
| `--press-color-danger` | `#C0392B` | ✅ `theme.colors.danger` |
| `--press-color-on-primary` | `#FFFFFF` | ✅ `theme.colors.onPrimary` |
| `--press-color-border` | `rgba(20,32,54,0.12)` (1px strokes) | ✅ `theme.colors.border` |
| `--press-font-display` | Bricolage Grotesque | ⚠️ string only (§6) |
| `--press-font-body` | Archivo | ⚠️ string only (§6) |
| `--press-font-mono` | IBM Plex Mono | ⚠️ string only (§6) |
| `--press-space-1..9` | `4 8 12 16 24 32 48 64 96`px | derived (fixed) |
| `--press-text-{kicker,sm,body,lg,h3}` | `12 14 16 18 20`px (brand scale) | derived (fixed) |
| `--press-text-{h2,h1}` | derived above `lg` (e.g. `28`, `40`) | derived (fixed) |
| `--press-radius-xs,sm,md,lg,pill` | `6 10 14 20 999`px | ✅ `theme.radius` |

The brand-guideline principle "1px strokes over heavy shadows" is honoured: a
`--press-color-border` token exists, and `theme.css` uses 1px borders rather than
box-shadows for elevation.

### Config type (engine-owned)

```ts
export interface PressConfig {
  // …existing brand / site / seo / routes…
  theme?: {
    colors?: Partial<{
      primary: string; accent: string; secondary: string;
      ink: string; surface: string; muted: string;
      danger: string; onPrimary: string; border: string;
    }>;
    fonts?: Partial<{ display: string; body: string; mono: string }>;
    radius?: Partial<{ xs: string; sm: string; md: string; lg: string }>;
  };
}
```

`ResolvedPressConfig.theme` is the **fully-resolved** shape (every token present),
so `buildThemeStyle` reads a total value, never an optional. `resolveConfig` fills
the Default-theme values over any partial the adopter supplies (shallow per
group).

## 5. What `theme.css` styles

1. **Global typography + light reset** — `body` gets `font-family: var(--press-font-body)`,
   `color: var(--press-color-ink)`, `background: var(--press-color-surface)`, base
   size/line-height; headings use `var(--press-font-display)` and the type scale;
   links use `var(--press-color-primary)`. Reset is minimal (`box-sizing`,
   margin normalization) — not a heavy reset.
2. **`press.hero`** (`[data-block="press.hero"]`) — **left-aligned editorial**
   layout: large display heading, subheading in `muted`, **CTA as a pill button**
   (`radius-pill`, `primary` background, `on-primary` text), responsive image
   (`max-width:100%`, `radius-md`), base-4 spacing rhythm. The Hero markup stays
   **semantic and class-free** — CSS matches by `[data-block]`/element — so custom
   blocks inherit the same tokens for free via the cascade. (Left-aligned is the
   default; centering would be a token flip, not a redesign.)
3. **Page shell** (in the `layout.tsx` template, engine-owned) — `<header>` with
   the logo (`brand.logo`) + `brand.name` linking to `/` and a 1px bottom stroke;
   `<main>` as a centered content container (`max-width` + base-4 side padding);
   `<footer>` with `brand.name` + year in `muted` and a 1px top stroke. Driven
   entirely by **existing** config — no navigation, no new CMS content type.

## 6. Fonts (and the override caveat)

`next/font/google` loads fonts at **build time** from static imports — an
arbitrary family name cannot be loaded from a runtime config string. The design
is honest about this:

- The `layout.tsx` template loads the three Default-theme fonts via `next/font`,
  each exposing a *default* CSS variable: `--press-font-display-default`,
  `--press-font-body-default`, `--press-font-mono-default`, set on `<html>` via
  the generated `className`.
- `theme.css` consumes them with a fallback:
  `font-family: var(--press-font-display, var(--press-font-display-default))`.
- `buildThemeStyle` emits `--press-font-display` **only when the adopter
  overrides it**. So the override wins with no specificity ambiguity, and the
  default stays `next/font`-optimized.
- **Caveat documented for adopters:** overriding `theme.fonts.*` sets the
  family string only; loading that font (self-host / `@font-face`) is the
  adopter's responsibility. The `⚠️` in §4 marks this asymmetry deliberately —
  colors are fully runtime-overridable, fonts are not.

## 7. Zone discipline

- The adopter edits **only** the `theme` key in `press.config.ts`.
- `theme.css` and `layout.tsx` are **engine-owned and versioned** — regenerated
  by `upgrade`, never authored by the adopter. This matches the whitelabel spec's
  AC5 ("an engine update leaves `press.config.ts` untouched").
- A destructive change to the engine's `theme` type breaks **loud** at the
  adopter's `press.config.ts` (compile time) — same contract guarantee the
  whitelabel surface already has.
- Custom blocks (e.g. the playground `Callout`) inherit the tokens through the
  cascade and may adopt `var(--press-*)` without the engine knowing them.

## 8. Testing

- **`resolve-config.test.ts`** (extend): Default-theme defaults are filled when
  `theme` is absent; a partial override (e.g. only `colors.primary`) merges over
  defaults per group and leaves the rest at default.
- **`build-theme-style.test.ts`** (new, mirrors `build-metadata.test.ts`):
  emits the expected `:root{ --press-* }` block from a resolved config; applies
  color/radius overrides; **omits** a font variable when not overridden and
  **emits** it when overridden.
- Existing materialize/contract tests stay green (markup is unchanged for the
  contract-relevant `data-block` attributes).
- Visual confirmation is manual via `pnpm play`; the Playwright e2e track is
  separate (per project notes) and not blocked by this spec.

## 9. Files touched

| File | Change |
|---|---|
| `packages/web/src/config/types.ts` | add `theme?` to `PressConfig`; resolved `theme` to `ResolvedPressConfig` |
| `packages/web/src/config/resolve-config.ts` | fill Default-theme token defaults (shallow-merge per group) |
| `packages/web/src/config/build-theme-style.ts` *(new)* + `.test.ts` | pure `:root{--press-*}` generator |
| `packages/web/theme.css` *(new)* | engine stylesheet; add to `package.json` `exports` + `files`, and `.npmignore` |
| `packages/web/templates/host/app/layout.tsx` | `next/font` setup, `theme.css` import, `<style>` injection, page shell |
| `packages/web/src/blocks/hero.tsx` | minimal content wrapper for the container (markup stays semantic, no `className`) |
| `packages/web/src/index.ts` | export `buildThemeStyle` |
| `.changeset/*` *(new)* | minor bump for `@ogs-tech/press-web` |

The playground host (`apps/playground/.press/web/...`) is re-materialized from
the updated template by the normal dev flow — not hand-edited.

## 10. Acceptance criteria

1. `pnpm play` renders the home page with the Default theme: Archivo body text on
   the cream surface, a Bricolage display Hero heading, the CTA as a green pill
   button, and a header/footer shell with the brand logo + name.
2. Setting `theme.colors.primary` in `press.config.ts` re-colours links and the
   Hero CTA **without** any other file change.
3. `theme.css` and the materialized `layout.tsx` are byte-identical after an
   `upgrade` (engine-owned), and `press.config.ts` is untouched.
4. Custom blocks (the `Callout`) can reference `var(--press-color-accent)` and
   pick up the theme with no engine change.
5. `buildThemeStyle` is pure and unit-tested; `resolveConfig` fills theme
   defaults; all existing tests stay green.
6. No new runtime dependency is added to the engine or the materialized host
   beyond `next/font` (already part of Next.js).

## 11. Out of scope

Dark mode, CMS-driven navigation, custom header/footer slots, multiple named
themes/presets, and `next/font`-optimized arbitrary adopter fonts. Each is a
clean follow-up: the token structure and the `:root` injection point leave room
for a `[data-theme]` attribute (dark mode) and additional token groups without a
breaking change to the `theme` contract.
