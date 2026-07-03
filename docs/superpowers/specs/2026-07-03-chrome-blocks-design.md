# Chrome blocks — block-composable header & footer

- **Date:** 2026-07-03
- **Status:** Approved design, pending implementation plan
- **Breaking change:** yes (removes `site-setting.headerNav`; major bump for `press-cms` and `press-web`)

## Problem

The page body is visually composable in the admin (Dynamic Zone of `press.*` /
`section.*` / `custom.*` blocks), but the site chrome is not: the header is a
hardcoded shell in the host template (`layout.tsx`) whose only editable part is the
`headerNav` repeatable in Site Settings, and the footer is entirely hardcoded
(`brand.name · year`). Editors want to compose header and footer the same way they
compose a page body.

## Decisions (validated with the adopter)

1. **Scope:** header **and** footer become block-composed, with the same editing
   experience as the page body.
2. **Palette:** the chrome DZs admit *everything* — `press.*` + `section.*` +
   `custom.*` — plus a new chrome-only category (see below).
3. **Location:** the `site-setting` single type gains two Dynamic Zones (`header`,
   `footer`). No new content-type.
4. **Empty/fresh state:** the plugin **seeds** a default composition on first run.
5. **`headerNav` is removed** — replaced by the navbar block. Shipped as a
   **breaking change** with no automated data migration (see §Migration).
6. **Block shape:** composite chrome blocks (`chrome.navbar`, `chrome.footer`), not
   granular atoms — the bar's internal layout is owned by the renderer so editors
   cannot break the chrome.

## Design

### 1. CMS data model

`site-setting` (`packages/cms/server/src/content-types/site-setting/schema.json`):

```
site-setting
├─ name, url, locale, logo, favicon, seo, themeColors, themeRadius   (unchanged)
├─ header : dynamiczone   ← NEW
├─ footer : dynamiczone   ← NEW
└─ headerNav              ← REMOVED (breaking)
```

**New engine-owned category `chrome.*`** — injected by the plugin during
`register()` exactly like `press.*` (`inject-components.ts`), but admitted **only**
into the `header`/`footer` DZs, never into the page `body`:

- `chrome.navbar`
  - `items`: repeatable `press.nav-item` (existing component, unchanged: label,
    page relation, url, newTab)
  - `cta`: optional single `press.button`
  - Brand (logo + site name) is **not** stored on the block — the renderer reads it
    from Site Settings identity fields, avoiding duplicated data.
- `chrome.footer`
  - `text`: optional string (copyright line). Empty → renderer falls back to
    `brand.name · currentYear` (today's behavior).

**DZ admissions for `header`/`footer`:** `chrome.*` + `press.*` + `section.*` are
listed statically in the schema (same pattern as `section.*` in the page `body`);
`custom.*` keeps flowing through `admitCustomBlocks`, which is extended to push
into all three DZs (body, header, footer). The adopter contract is unchanged: only
the `custom` category is stable, never individually named blocks.

### 2. Wire contract + type-sync

Two extensions to the existing pipeline; the `PressSchema` promise ("the schema can
never disagree with what Strapi serves") is preserved:

1. **Serializer** (`cms/.../lib/serialize-schema.ts`)
   - Serializes the admissions of `site-setting.header` and `site-setting.footer`
     in addition to `page.body`.
   - **Follows nested component references**: `chrome.navbar` references
     `press.nav-item` and `press.button`, so those enter the `components` map even
     though they are not direct DZ members.
   - The existing fail-fast (admitted uid missing from the registry) covers all
     three DZs.
2. **Generator** (`web/src/generator/generate.ts`)
   - Learns `type: 'component'` → a reference to the component's interface
     (`PressNavItem[]` when `repeatable`, `PressButton` when single).
   - Components that appear **only nested** are emitted **without** `__component`
     (Strapi does not send the discriminator for nested components — only for DZ
     members).
   - `relation` attributes are explicitly out of generator scope (the nav-item
     `page` relation is resolved at runtime by the web side, never consumed raw).
   - Emits `HeaderBlocks` and `FooterBlocks` unions alongside `PageBody`.

`PressSchema` in `press-shared` gains the `site-setting` content-type entry (with
its two DZ attributes) — an additive change to the shared shape.

### 3. Web rendering

Host template `layout.tsx` swaps the hardcoded chrome for the block pipeline:

```tsx
<header>
  <BlockRenderer blocks={site.chrome.header} components={customBlocks} />
</header>
<main>{children}</main>
<footer>
  <BlockRenderer blocks={site.chrome.footer} components={customBlocks} />
</footer>
```

- New engine map `chromeBlocks` (`web/src/chrome-blocks.ts`). Merge order becomes
  `{ ...referenceBlocks, ...sectionBlocks, ...chromeBlocks, ...components }` — the
  adopter can override `chrome.navbar` just like `section.hero`.
- **Hydration lives in `mapSiteSettings`** (`web/src/map-site-settings.ts`), where
  nav resolution already lives today. It walks both DZ arrays and, for
  `chrome.navbar` blocks: resolves each nav item (page relation → slug → href,
  precedence page > url, `external` flag), and injects the resolved `brand`
  (logo, name). All other blocks pass through untouched. `BlockRenderer` stays
  intentionally dumb.
- The current `SiteNav` becomes the internal nav of the navbar renderer, keeping
  the client-component boundary only for the active-link `aria-current` logic.
- Unknown component in a chrome DZ → same dev-only warning + skip as the body,
  never a crash.

### 4. Seed, migration, degradation

- **Seed:** in the plugin's `bootstrap()`, if a DZ is `null` (never touched), write
  the default composition: `header: [chrome.navbar]` (empty items),
  `footer: [chrome.footer]` (empty text). Runs once; **never** overwrites an
  existing value — a DZ the editor emptied (`[]`) is respected.
- **Migration (breaking):** removing the `headerNav` attribute makes Strapi drop
  its data on schema sync, before `bootstrap()` runs — automated migration in the
  same release is not possible without a two-step scheme. Decision: ship as a
  breaking change; existing nav links are re-entered manually once inside the
  navbar block. The two-step alternative (deprecate for one release, migrate in
  bootstrap, remove in the next) was **rejected** as disproportionate cost at the
  current dogfood stage (the playground is the only adopter).
- **CMS unreachable / malformed response:** maps as an empty record →
  `header`/`footer` render nothing. Consistent with the existing principle of no
  `press.config` identity fallback: unbranded over synthetic.

### 5. Testing

- **Generator:** nested component (repeatable and single), nested emission without
  `__component`, `HeaderBlocks`/`FooterBlocks` unions, `relation` skipped.
- **Serializer:** three DZs walked, nested refs included, fail-fast on a missing
  component.
- **`mapSiteSettings`:** navbar hydration (brand injection, page > url precedence,
  `external`/`newTab`), non-chrome blocks untouched, fetch failure → empty chrome.
- **Seed:** writes when `null`, never overwrites a value or `[]`.
- **Renderer:** merge order with `chromeBlocks`, adopter override of a chrome
  block, `SiteNav` tests migrate to the navbar renderer.
- Quality gate: `pnpm -r --if-present typecheck` + `pnpm -r test`.

### 6. Versioning

- `press-cms`: **major** (removes `headerNav`, adds DZs + `chrome.*`).
- `press-web`: **major** (removes `SiteNav` from the public surface / changes
  `ResolvedPressConfig.nav` shape to `chrome.header`/`chrome.footer`).
- `press-shared`: **minor** (additive `PressSchema` extension).
- One changeset documenting the breaking change and the manual nav re-entry step.

## Rejected alternatives

- **Richer nav items only** (DZ of item types inside a fixed header): solves menu
  variety, not chrome composition — superseded by the chosen scope.
- **New "Layout" single type:** separates structural chrome from identity, but adds
  a content-type, a route, and a second runtime fetch for no adopter-visible gain.
- **Header/footer as reserved pages:** reuses the body pipeline wholesale but mixes
  chrome with content and requires magic slugs.
- **Granular chrome atoms** (`chrome.brand`, `chrome.nav`, …): maximum freedom,
  fragile layout, complex seed.
- **Reusing `section.*` for navbar/footer:** would pollute the page-body palette
  (sections are admitted statically into `body`) and break the "sections are flat"
  rule, since the navbar needs a nested repeatable.
- **Two-step `headerNav` migration:** rejected — see §Migration.

## Out of scope

- Navbar layout variants (centered, split, mega-menu), sticky/transparent modes —
  future fields/variants on `chrome.navbar`.
- Multi-level menus (dropdowns): `press.nav-item` stays flat.
- Seeding any content beyond the two default chrome blocks.
