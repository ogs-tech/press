# Press — Composite Section Blocks (`section.*`, v1)

**Status:** Approved design · **Date:** 2026-07-01 · **Scope:** flat sections only (`section.hero`, `section.cta`)

## 1. Context

Press ships a Gutenberg-style **atomic** reference palette under `press.*`
(paragraph, heading, list, quote, image, button, separator, spacer) plus an
adopter extension point under `custom.*`. There is no engine-owned concept of a
higher-level **composite section** (Hero, CTA, FeatureGrid).

An adopter *can* already build a section today as a `custom.*` block — a Strapi
component with fixed fields + a React renderer (see `apps/playground/.../custom/callout.json`
+ `Callout.tsx`). What is missing is a **curated, ready-made section library the
adopter gets for free** from the engine, branded automatically by the adopter's
theme.

Note the deliberate history: commit `2fa33de` **removed `press.hero`** (BREAKING)
to keep the `press.*` palette atomic/editorial. This spec does **not** reverse that
decision — it introduces sections under a **separate category** so the atomic
boundary in `press.*` stays intact.

### Where this lives in the architecture

Sections are **page content**, so they live in **Plane A** — the type-sync loop:

```
inject section.* → page.body DZ → GET /api/press/schema → generator
  → generated.ts (SectionHero/SectionCta + PageBody union) → BlockRenderer
```

This is the same plane and the same mechanism the `press.*` atoms already use.
The v1 sections are **flat** (only scalar/media/enum fields), which is what keeps
the type-sync pipeline unchanged (see §7).

## 2. Goals

- Ship an engine-owned palette of composite sections under a new Strapi category
  `section.*`, admitted into the page `body` Dynamic Zone automatically.
- v1 delivers two **flat** sections: `section.hero` and `section.cta`.
- Each section renders as **semantic HTML + `data-block`**, styled by `theme.css`
  as a pure consumer of `var(--press-*)` tokens — so a section is **born branded**
  with the adopter's Site Settings theme, with no override required.
- The adopter can override any section by passing its own renderer to
  `BlockRenderer` (`components={{ 'section.hero': MyHero }}`) — reusing the existing
  last-wins merge, no new mechanism.
- Additive and non-breaking: `press.*` and `custom.*` are untouched; adopters gain
  `section.*` on `press upgrade`.

## 3. Non-goals (explicitly deferred)

- **Sections with lists / nested repeatable components** (FeatureGrid, Testimonials).
  These require extending `serialize-schema` (transitive component-ref walk), the
  generator (`type: 'component'` single + repeatable), and the `Attr` shared type.
  Deferred to a **second spec** ("nested component pipeline"). v1 stays flat on
  purpose so it ships without touching the type contract.
- **Editor-arranged inner content** (a DZ inside a section) — blocked by Strapi 5
  (no Dynamic Zone nesting inside a component). Out of scope entirely.
- **Reintroducing `press.hero`** — sections live under `section.*`, never `press.*`.

## 4. The two sections (v1)

All fields are scalar / media / enum → they pass through the current generator with
zero changes.

### `section.hero`
| field | type | required | notes |
|---|---|---|---|
| `eyebrow` | string | no | small kicker above the title |
| `title` | string | **yes** | primary heading |
| `subtitle` | text | no | supporting copy |
| `image` | media (single) | no | hero visual |
| `ctaLabel` | string | no | call-to-action label |
| `ctaHref` | string | no | call-to-action target |
| `align` | enumeration `left \| center` | no (default `left`) | layout alignment |

### `section.cta`
| field | type | required | notes |
|---|---|---|---|
| `title` | string | **yes** | banner heading |
| `subtitle` | text | no | supporting copy |
| `buttonLabel` | string | **yes** | button label |
| `buttonHref` | string | **yes** | button target |
| `align` | enumeration `left \| center` | no (default `left`) | layout alignment |

## 5. Architecture — symmetry with `press.*`

The mechanism already exists; this spec **mirrors** it into a new category. No new
contract is invented.

### 5.1 CMS (`packages/cms`)
- Add two component schema JSONs under `server/src/components/section/` (`hero.json`,
  `cta.json`). Physical folder is organizational only — category is set explicitly in
  code (below), because Strapi does not scan `node_modules`.
- Add two entries to `ENGINE_COMPONENTS` in `lib/inject-components.ts` with
  `category: 'section'`, `name: 'hero' | 'cta'`. `injectComponents` registers them
  with a deterministic `globalId` (`toGlobalId('component_section.hero')`), exactly
  like the `press.*` atoms.
- List `"section.hero"` and `"section.cta"` **statically** in
  `content-types/page/schema.json` `body.components`, alongside the `press.*` atoms.
  They are engine-owned and deterministic, so static admission (not the dynamic
  `custom.*` push in `admitCustomBlocks`) is the correct, symmetric choice.
- `serialize-schema` needs **no change**: the sections are in the page DZ, so they are
  serialized into `schema.components` automatically, and their flat attributes already
  serialize.

### 5.2 Web (`packages/web`)
- Add two renderers: `src/sections/hero.tsx`, `src/sections/cta.tsx`. Each emits
  semantic HTML with a `data-block="section.hero"` / `data-block="section.cta"` anchor
  and reads its generated typed props (`SectionHero` / `SectionCta`).
- Introduce a **separate registry map** `sectionBlocks` (`src/section-blocks.ts`):
  ```ts
  export const sectionBlocks = {
    'section.hero': Hero,
    'section.cta': Cta,
  };
  ```
  This preserves the documented invariant that `referenceBlocks` is `press.*`-only,
  and mirrors the three-palette split (`press.*` / `section.*` / `custom.*`) in code.
- `BlockRenderer` merges the new map between reference and adopter blocks:
  ```ts
  const registry = { ...referenceBlocks, ...sectionBlocks, ...components };
  ```
  Adopter `components` still wins last → per-section override for free.
- `theme.css` gains `[data-block="section.hero"]` and `[data-block="section.cta"]`
  rules that consume `var(--press-*)` tokens (colors, space, text, radius, fonts).
  `theme.css` stays a pure token consumer — no hardcoded brand values.
- `src/index.ts` exports `Hero`, `Cta`, `sectionBlocks`, and the `SectionHero` /
  `SectionCta` types.

## 6. Data flow (pipeline unchanged, content new)

```
CMS register: inject section.hero/section.cta (category 'section')
  → page.body DZ lists section.* statically
  → GET /api/press/schema serializes them (flat fields)
  → generator emits `SectionHero` / `SectionCta` interfaces
     and adds both uids to the `PageBody` union
  → adopter getPage() returns a typed body
  → BlockRenderer picks 'section.hero' from sectionBlocks
  → renders <section data-block="section.hero"> … </section>
  → theme.css applies the adopter's theme tokens
```

## 7. Type-sync impact — none

`generate.ts` `tsTypeForAttribute` already handles scalar, `enumeration`, and `media`.
Every v1 field is one of those, so both sections generate correct interfaces with
**zero generator change**. The generator's existing "DZ-inside-component out of scope"
guard (`generate.ts:49-50`) is not triggered — v1 sections have no nested DZ and no
nested component. (Nested components are the deferred §3 work.)

## 8. Error handling (reuses existing tolerant contracts)

- **Missing renderer** → `BlockRenderer` already skips the block with a dev-only
  warning; never crashes.
- **Incomplete draft** → each section renderer is tolerant, mirroring `press.image`
  (which renders nothing when `image.url` is absent):
  - `section.hero` with no `title` → render nothing.
  - `section.hero` with `ctaLabel` but no `ctaHref` (or vice-versa) → render the CTA
    only when both are present.
  - `section.cta` with a missing `buttonHref` → render the heading/subtitle without
    the button rather than a dead link.
- **Injection collision** (uid already registered) → `injectComponents` already
  warns + skips.

## 9. Override

The adopter escapes the engine visual by passing a renderer for the section key:

```tsx
<BlockRenderer blocks={page.body} components={{ 'section.hero': MyHero }} />
```

`{ ...referenceBlocks, ...sectionBlocks, ...components }` makes the adopter's map win.
This is the same override contract already documented for reference blocks — no new
surface.

## 10. Testing (repo gate: vitest + tsc, no eslint)

- **CMS**
  - `inject-components.test.ts`: `section.hero` / `section.cta` are injected with
    category `section` and the derived `globalId`; both appear in the page `body` DZ
    `components`.
  - `serialize-schema.test.ts`: both sections appear in the serialized
    `schema.components` with their flat attributes.
- **Web**
  - `sections/hero.test.ts` / `sections/cta.test.ts`: render with full props (semantic
    structure + `data-block` present); tolerant empty-state cases from §8.
  - `block-renderer.test.tsx`: a `section.*` block resolves from `sectionBlocks`; an
    adopter-provided `components['section.hero']` overrides it.
- **Generator**
  - `generate.test.ts`: a schema containing `section.hero` produces a `SectionHero`
    interface and includes it in the `PageBody` union.
- **Playground (dogfood)**
  - Add `section.hero` + `section.cta` to a demo page so `pnpm play` renders both.

## 11. Delivery

- **Changeset**: minor feature for `@ogs-tech/press-cms` and `@ogs-tech/press-web`
  (new `section.*` palette).
- **Adoption note**: adopters gain `section.*` on `press upgrade`; every section is
  overridable via `BlockRenderer` `components`.
- **Docs**: update the architecture reference in `CLAUDE.md` to describe the third
  palette (`press.*` atoms / `section.*` engine sections / `custom.*` adopter) and the
  `sectionBlocks` merge in `BlockRenderer`.

## 12. Open items (confirmed during design)

- Field sets in §4 are approved.
- Separate `sectionBlocks` map (not folding into `referenceBlocks`) is approved.
