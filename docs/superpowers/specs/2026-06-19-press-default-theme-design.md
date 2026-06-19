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
> framework — so the original concern is honoured, not reopened. It also lands the
> **named-theme selection** the whitelabel spec sketched and rejected (`theme:
> 'ogs'`), now as `theme: 'default'`, with the CMS as its editorial surface.

**TL;DR** — Today the materialized host renders `<html><body>{children}</body></html>`
with **zero CSS**, so reference blocks render as bare HTML (the "Hello from
press" Times-New-Roman page). This spec adds a **theming mechanism**: the engine
ships a static stylesheet (`theme.css`) that styles reference blocks, global
typography, and a minimal page shell entirely through `var(--press-*)` custom
properties; a pure helper (`buildThemeStyle`, mirroring `buildMetadata`) emits a
`:root{ --press-* }` block from the `theme` key resolved out of `press.config.ts`.
The engine ships **one embedded theme — named `'default'`** — whose token values
are derived from the OGS brand guidelines but whose identity is "the engine's
neutral default", not a branded preset. The theme is **selected by name** (`theme:
'default'` in config) and surfaced in the CMS as a **"Themes" menu with a single
"Default" entry, selected** — structure + selection, not value storage. Adopters
re-theme by overriding tokens in `press.config.ts`; **custom blocks both consume
and may override** the tokens through the cascade; nobody touches engine-owned
files.

## 0. Foundation — theming completes the whitelabel surface

The whitelabel spec (Spec 2, §2) landed **Identity + SEO** as *data the adopter
owns* (`brand`/`site`/`seo` in `press.config.ts`) and **deliberately deferred
theme tokens**. This spec closes that surface: appearance (colors, fonts, radii)
becomes the **third class of whitelabel data** — same Project-zone file,
surviving `upgrade` exactly like identity and SEO. press's whitelabel promise is
now visual, not just nominal: **re-theming is re-branding**.

**The contract stays small (PRD §8).** The public theming surface is exactly two
things:

1. The **token namespace** — `var(--press-*)` (the §4 table): the versioned,
   adopter-/block-facing API.
2. The **single injection point** — the `:root{ --press-* }` block
   `buildThemeStyle` emits into `<head>`: the only place token *values* enter the
   page.

`theme.css`, `layout.tsx`, the derivation logic, and the CMS `theme` content-type
are Engine-owned and free to change. The non-breakage obligation is the namespace
+ the injection point, deliberately nothing more.

**Two consumers, one contract.** The foundation is designed so the same token
contract serves both:

- **Custom blocks — first-class, today.** A block in `blocks/custom/` reads
  `var(--press-color-accent)` and inherits the theme through the cascade — and may
  **override** any token in its own scope (`[data-block="custom.callout"]{
  --press-color-primary: … }`). This is *contract consumption + extension*, not a
  CSS accident: the token namespace **is** the block-facing theming API. (Realized
  in §5, §8, AC4.)
- **The CMS theme menu — selection, today.** `@ogs-tech/press-cms` ships a
  `theme` content-type that appears as a **"Themes" menu** in the Strapi admin,
  seeded with one **"Default"** entry marked active. It owns *which named theme is
  active* — the editorial half of the surface — while token **values** stay in
  `press.config.ts` + `theme.css` (§7). Feeding values from the CMS is the
  reserved seam (§12).

**Why the zone holds.** The adopter supplies **values** (tokens in config) and
**selection** (the active theme in the CMS) — both **data**, never **code**. The
Engine owns the *how* (namespace, injection, stylesheet, content-type schema); the
*what* and the *which* flow in as data. An `upgrade` rewrites the Engine's *how*
and never the adopter's data — the same boundary Spec 2 proved for Identity + SEO
(its AC5), now extended to appearance and theme selection.

## 1. The question (single anchor)

> Can the engine make a press site look finished out of the box — styled
> reference blocks, real typography, a page shell — through a theme that is
> **data the adopter owns** (`theme` tokens in `press.config.ts`, the active theme
> in the CMS) rather than **code the adopter edits**, so the zone boundary holds:
> the engine owns the *how* (stylesheet + token derivation + content-type), the
> adopter owns the *what* (token values) and the *which* (active theme), and an
> engine `upgrade` never rewrites either?

## 2. Scope decisions (2026-06-19)

Taken during brainstorming, before design:

1. **One embedded theme, named `'default'`, selected by name.** The engine ships a
   single theme. Its values come from the OGS brand guidelines, but it is
   positioned and named as the engine's **neutral default** — not "the OGS theme",
   not a branded preset. A **named-theme selection mechanism** exists: `theme:
   'default'` in config and a "Themes" menu in the CMS. `'default'` is the only
   choice for now; the mechanism exists so a second
   embedded theme is **additive, not breaking**. (The whitelabel spec's rejected
   `theme: 'ogs'` framing is replaced by `theme: 'default'`.)
2. **In scope:** (a) global typography + light reset, (b) styled reference
   blocks (the `press.hero`), (c) a minimal page shell (content container +
   header/footer driven by existing `brand` config), (d) a **CMS "Themes" menu**
   (`theme` content-type: structure + selection, seeded with an active "Default"),
   (e) **custom-block token override** via the cascade.
3. **Out of scope (deferred):** dark mode (tokens are structured so it can be
   added later without a breaking change), **CMS-sourced token *values*** (the CMS
   selects *which* theme; it does not yet *feed token values* — that's the §7
   seam), `config × CMS` precedence for multiple themes, CMS-driven navigation,
   custom header/footer "slots", and arbitrary runtime font swapping (§6 caveat).
4. **Mechanism:** engine-shipped CSS + CSS custom properties (web) + a Strapi
   content-type (cms). **No Tailwind, no CSS-in-JS, no CSS Modules** — zero new
   build dependency, RSC/SSR-safe, and it reuses the `data-block` attribute the
   blocks already emit.

## 3. Architecture & data flow

Four pieces, each following an existing engine pattern.

```
press.config.ts (Project zone)              @ogs-tech/press-web (engine)
  theme?: 'default' | {              ──►  resolveConfig()   → normalizes name + fills Default defaults
    name?, colors, fonts, radius }        buildThemeStyle()  → ":root{ --press-* }" string (pure)
                                                   │
host materialized (.press/web)  ◄─── engine owns the template
  layout.tsx:
    import '@ogs-tech/press-web/theme.css'        // static engine stylesheet
    next/font/google  → --press-font-*-default    // 3 Default-theme fonts
    <style>{buildThemeStyle(config)}</style>      // tokens injected in <head>
    <html data-theme={theme.name} className={fonts}> shell + {children}
                                                   │
theme.css matches  [data-block="press.hero"], body, main, header, footer  via var(--press-*)
custom blocks (blocks/custom/) CONSUME and may OVERRIDE var(--press-*) via the cascade

@ogs-tech/press-cms (engine, Strapi plugin)
  content-types/theme  ──►  "Themes" admin menu; bootstrap seeds one active "Default"
    owns the SELECTION (which named theme is active) — structure + selection now;
    feeding token VALUES into the render is the reserved seam (§7, §12)
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
   *what* the adopter controls. The config also carries the active theme **name**
   (the *which*), defaulting to `'default'`.
4. **`theme` content-type in `@ogs-tech/press-cms`** — the editorial **selection**
   surface (the "Themes" menu). The *which*, in the CMS. Structure + selection
   only this phase (§7).

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

The active theme **name** is *selection*, not a token — it is **not** emitted as a
`var(--press-*)`; it is reflected on `<html data-theme="…">` so dark mode and a
future second theme have a stable hook with no namespace change.

### Config type (engine-owned)

```ts
export type ThemeName = 'default' // the only embedded theme (for now)

export interface PressConfig {
  // …existing brand / site / seo / routes…
  theme?:
    | ThemeName // sugar: `theme: 'default'` selects the theme with no overrides
    | {
        name?: ThemeName // selects the active embedded theme; defaults to 'default'
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

`resolveConfig` normalizes both forms — a bare `'default'` string, or the object —
into the **fully-resolved** `ResolvedPressConfig.theme` shape (`{ name; colors;
fonts; radius }`, every token present), so `buildThemeStyle` reads a total value,
never an optional. It fills the Default-theme values over any partial the adopter
supplies (shallow per group) and defaults `name` to `'default'`.

The string form honours the `theme: 'default'` selection ergonomics directly; the
object form adds overrides. The union is the only added contract surface — a
deliberate, small cost (PRD §8) for the selection ergonomics.

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
   entirely by **existing** config — no navigation, no new CMS content type for
   the shell.

**Custom-block override (in scope).** Because everything cascades from `:root`, a
custom block redefines any token in its own scope — `[data-block="custom.callout"]{
--press-color-primary: #ff5500 }` or an inline `style={{ '--press-radius-md':
'2px' }}` — and the override wins locally with no engine change and no specificity
fight (the block's selector is more specific than `:root`). Consuming and
overriding are the same mechanism: the token namespace.

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

## 7. Theme selection — `press.config.ts` × the CMS theme menu

Two surfaces carry the *which*, with distinct roles — the same split the
whitelabel spec drew for `env × config` (PRD §5), now `config × CMS`:

- **`press.config.ts` (`theme` / `theme.name`)** — the adopter's **build-time
  selection + token overrides**. It is the **source of truth for the render**:
  `resolveConfig` runs at module-eval time and `buildThemeStyle` emits the
  `:root` block deterministically, exactly as today. No CMS fetch enters the
  render path.
- **The CMS "Themes" menu (`theme` content-type)** — the **editorial
  representation + selection**. `@ogs-tech/press-cms` registers a `theme`
  collection-type (appears as "Themes" in the admin); `bootstrap` seeds exactly
  one entry, **"Default", marked active**, if none exists. It owns *which named
  theme is active* from a content-editor's point of view. This phase is
  **structure + selection** — a real content-type with a real active flag,
  queryable via Strapi's API — **not** a placeholder and **not** value storage.

**Precedence (stated, trivial now).** When `press.config.ts` names a theme, it
wins (deterministic build). When it omits `name`, the active CMS theme applies.
With a single embedded theme both always agree, so there is no observable
conflict yet. **Reserved seam (§12):** wiring the CMS selection *into* the render,
sourcing token *values* from the CMS, and `config × CMS` precedence across
multiple themes. Deliberately not built now — it keeps the contract small and
avoids a runtime theme fetch in the render path.

## 8. Zone discipline

- The adopter edits **only** the `theme` key in `press.config.ts` and selects the
  active theme in the CMS admin — both **Project-zone data** (config + content),
  never engine code.
- `theme.css`, `layout.tsx`, and the `theme` content-type schema are
  **engine-owned and versioned** — regenerated by `upgrade`, never authored by the
  adopter. This matches the whitelabel spec's AC5 ("an engine update leaves
  `press.config.ts` untouched").
- A destructive change to the engine's `theme` type or `ThemeName` breaks **loud**
  at the adopter's `press.config.ts` (compile time) — same contract guarantee the
  whitelabel surface already has.
- Custom blocks (e.g. the playground `Callout`) **inherit and may override** the
  tokens through the cascade and may adopt `var(--press-*)` without the engine
  knowing them.

## 9. Testing

- **`resolve-config.test.ts`** (extend): Default-theme defaults are filled when
  `theme` is absent; the **string form** (`theme: 'default'`) and the **object
  form** (`theme: { name: 'default' }`) resolve identically; `name` defaults to
  `'default'`; a partial override (e.g. only `colors.primary`) merges over
  defaults per group and leaves the rest at default.
- **`build-theme-style.test.ts`** (new, mirrors `build-metadata.test.ts`):
  emits the expected `:root{ --press-* }` block from a resolved config; applies
  color/radius overrides; **omits** a font variable when not overridden and
  **emits** it when overridden; does **not** emit the theme `name` as a token.
- **CMS (`@ogs-tech/press-cms`)**: the `theme` content-type is registered
  (`content-types/index.ts`); `bootstrap` seeds **exactly one** active "Default"
  on a fresh DB and is **idempotent** (re-run leaves one active theme, not two).
  Asserted by a plugin unit/integration test or the contract snapshot.
- Existing materialize/contract tests stay green (markup is unchanged for the
  contract-relevant `data-block` attributes; `data-theme` is additive).
- Visual confirmation is manual via `pnpm play`; the Playwright e2e track is
  separate (per project notes) and not blocked by this spec.

## 10. Files touched

| File | Change |
|---|---|
| `packages/web/src/config/types.ts` | add `ThemeName` + `theme?` (string \| object) to `PressConfig`; resolved `theme` (`{ name; colors; fonts; radius }`) to `ResolvedPressConfig` |
| `packages/web/src/config/resolve-config.ts` | normalize string/object form; default `name` → `'default'`; fill Default-theme token defaults (shallow-merge per group) |
| `packages/web/src/config/build-theme-style.ts` *(new)* + `.test.ts` | pure `:root{--press-*}` generator (name is not a token) |
| `packages/web/theme.css` *(new)* | engine stylesheet; add to `package.json` `exports` + `files`, and `.npmignore` |
| `packages/web/templates/host/app/layout.tsx` | `next/font` setup, `theme.css` import, `<style>` injection, `data-theme` on `<html>`, page shell |
| `packages/web/src/blocks/hero.tsx` | minimal content wrapper for the container (markup stays semantic, no `className`) |
| `packages/web/src/index.ts` | export `buildThemeStyle` + `ThemeName` |
| `packages/cms/server/src/content-types/theme/schema.json` *(new)* | Strapi `theme` collection-type (`name`, `active`) → "Themes" admin menu |
| `packages/cms/server/src/content-types/index.ts` | register `theme` alongside `page` |
| `packages/cms/server/src/bootstrap.ts` | idempotent seed of one active "Default" theme |
| `.changeset/*` *(new)* | minor bump for `@ogs-tech/press-web` **and** `@ogs-tech/press-cms` |

The playground host (`apps/playground/.press/web/...`) is re-materialized from
the updated template by the normal dev flow — not hand-edited.

## 11. Acceptance criteria

1. `pnpm play` renders the home page with the Default theme: Archivo body text on
   the cream surface, a Bricolage display Hero heading, the CTA as a green pill
   button, and a header/footer shell with the brand logo + name.
2. Setting `theme.colors.primary` in `press.config.ts` re-colours links and the
   Hero CTA **without** any other file change.
3. `theme.css` and the materialized `layout.tsx` are byte-identical after an
   `upgrade` (engine-owned), and `press.config.ts` is untouched.
4. Custom blocks (the `Callout`) can **reference** `var(--press-color-accent)` and
   **override** a token in their own scope, both with no engine change.
5. `buildThemeStyle` is pure and unit-tested; `resolveConfig` fills theme
   defaults and normalizes `theme: 'default'` (string) and `theme: { name:
   'default' }` to the same resolved value; all existing tests stay green.
6. The CMS admin shows a **"Themes" menu** with a single **"Default"** entry
   marked active, seeded by the plugin; a fresh install has **exactly one** active
   theme, and the seed is idempotent.
7. A destructive change to `ThemeName` or the `theme` type makes `tsc --noEmit`
   **fail at `press.config.ts`** (loud-fail), the same guard the whitelabel
   surface has.
8. No new runtime dependency is added to the engine or the materialized host
   beyond `next/font` (already part of Next.js).

## 12. Out of scope

Dark mode, **CMS-sourced theme *values*** (the CMS selects *which* theme; feeding
token values from the CMS — and the `config × CMS` precedence that implies across
multiple themes — is the §7 seam), CMS-driven navigation, custom header/footer
slots, **additional embedded themes** (the selection mechanism is ready; only
`'default'` ships), and `next/font`-optimized arbitrary adopter fonts. Each is a
clean follow-up: the token structure, the `:root` injection point, and the
`data-theme` hook leave room for a second theme and dark mode without a breaking
change to the `theme` contract; the `theme` content-type leaves room for
CMS-sourced values without a new menu.
