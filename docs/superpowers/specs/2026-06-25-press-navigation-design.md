# Press — Editable Navigation (v1)

**Status:** Approved design · **Date:** 2026-06-25 · **Approach:** B (Robust core)

## 1. Context

The press host currently ships a hardcoded `<header>` in the materialized host
template (`packages/web/templates/host/app/layout.tsx`): a single link to `/` with
the site logo and name, plus a `<footer>` with name + year. There is **no editable
navigation** — no menu, no links, nothing the content editor can change in the CMS.

This spec adds an editable **header navigation menu** managed in the CMS and rendered
by the host, with internal links that survive slug renames and external links that
behave like external links.

### Where this lives in the architecture

Press has two independent configuration planes:

- **Plane A — page content** (`page.body` Dynamic Zone) → flows through the type-sync
  loop (`GET /api/press/schema` → generator → `generated.ts` → `BlockRenderer`).
- **Plane B — site chrome / config** (`site-setting` single type) → fetched at runtime
  by `getSiteConfig` (ISR ~60s), mapped by hand in `mapSiteSettings`, consumed by
  `layout.tsx`. **No type-sync, no `PressSchema` involvement.**

Navigation is site chrome, so it lives entirely in **Plane B**. This is the cheapest
and safest plane to extend: it never touches the generated contract, never touches the
adopter zone, and degrades to "empty" on any failure (the existing Site Settings
failure discipline applies for free).

## 2. Goals

- A content editor can define an ordered list of header navigation items in the CMS
  "Site Settings" single type.
- Each item links to **either** an internal page (relation — slug-safe) **or** an
  external URL.
- The host renders the menu in the header, highlighting the link for the current page.
- Empty menu / CMS unreachable / malformed payload → the header renders just the logo
  (today's behavior). Never crashes.
- The change is **additive**: no `PressSchema` / generator / `generated.ts` change, no
  adopter-zone change. The data model leaves room for footer menus and dropdowns to be
  added later without a breaking change.

## 3. Non-goals (explicitly additive later)

- **Footer navigation** — v1 ships the header menu only. The `press.nav-item` component
  is reusable, so a `footerNav` field is a one-line additive follow-up.
- **Dropdowns / nested menus** — flat list only in v1.
- **Multiple named menus** (sidebar, utility, …) and a dedicated `navigation`
  content-type — out of scope; this is the "Approach C" path, deliberately deferred.
- **Per-locale menus.**
- **Full hamburger menu with JS toggle** — v1 ships a minimal CSS-only responsive
  treatment; a full disclosure menu is additive.

## 4. Data model (engine-owned, in `packages/cms`)

### 4.1 New component `press.nav-item`

New file `packages/cms/server/src/components/nav-item.json`:

```jsonc
{
  "collectionName": "components_press_nav_items",
  "info": {
    "displayName": "Nav Item",
    "description": "A single navigation entry: an internal page link or an external URL"
  },
  "options": {},
  "attributes": {
    "label":  { "type": "string", "required": true },
    "page":   { "type": "relation", "relation": "oneWay", "target": "plugin::press-cms.page" },
    "url":    { "type": "string" },
    "newTab": { "type": "boolean", "default": false }
  }
}
```

- `label` — required, the visible text.
- `page` — one-way relation to the engine `page` content-type. Internal link;
  resolves to the page's slug at runtime, so it survives slug renames and cannot 404
  from a typo.
- `url` — explicit URL (external sites, anchors, `mailto:`, etc.).
- `newTab` — opt-in `target="_blank"`.

The editor fills `page` **or** `url` per item. Strapi natively renders both fields
(no custom admin / radio toggle in v1); the runtime resolver disambiguates by
precedence (§5.2).

### 4.2 Registration in `inject-components.ts`

`press.nav-item` is a Site-Settings-only configuration component, exactly like the
existing `press.seo`, `press.theme-colors`, and `press.theme-radius`. It is registered
by adding one import and one entry to the `ENGINE_COMPONENTS` array in
`packages/cms/server/src/lib/inject-components.ts`, in the "Configuration components"
group:

```ts
import navItemSchema from '../components/nav-item.json';
// …
{ category: 'press', name: 'nav-item', schema: navItemSchema as Record<string, unknown> },
```

Because the page `body` Dynamic Zone only admits the components explicitly listed in
its schema (plus `custom.*`), injecting `press.nav-item` does **not** make it appear in
the page block palette. It is referenced only by Site Settings (§4.3).

### 4.3 Site Settings schema

Add one attribute to
`packages/cms/server/src/content-types/site-setting/schema.json`:

```jsonc
"headerNav": { "type": "component", "repeatable": true, "component": "press.nav-item" }
```

…and a matching `config.metadatas` entry:

```jsonc
"headerNav": { "edit": { "label": "Header Navigation" } }
```

## 5. Runtime flow (engine-owned, in `packages/web`)

### 5.1 Fetch — `get-site-config.ts`

The current call uses `populate=*`, which only populates one level — it would bring
`headerNav` items' scalar fields (`label`, `url`, `newTab`) but **not** the `page`
relation nested inside each item. v1 replaces `populate=*` with an **explicit populate
object** (hand-encoded query string, no new dependency) that covers the existing fields
plus `headerNav.page` (selecting the `slug` field only):

- `logo`, `favicon` (media)
- `seo` (+ `seo.image` media)
- `themeColors`, `themeRadius` (components)
- `headerNav` (+ `headerNav.page` relation, `fields: ['slug']`)

The query is built with a small local helper or hand-written `populate[...]=...` pairs.
The failure contract is unchanged: any non-OK / network error / malformed body →
`mapSiteSettings(buildTime, null)`.

### 5.2 Map + resolve — `map-site-settings.ts`

`mapSiteSettings` (pure, unit-testable) resolves each `headerNav` item into a final
link. **Precedence: `page` wins over `url`.**

- `page` present and has a slug →
  `href = slug === buildTime.routes.home ? '/' : '/' + slug`, `external = false`.
  (Reuses the same `routes.home` anchor that governs the existing `/home → /` redirect —
  consistent and CMS-independent.)
- else `url` present → `href = url`, `external = url` starts with `http`.
- neither present → item is **dropped** (not rendered). A dev-only warning may be
  emitted.

CMS `null` / absent / empty `headerNav` → `nav.header = []`.

### 5.3 Types — `config/types.ts`

- `SiteSettingsData` gains:
  ```ts
  headerNav?: Array<{
    label?: string;
    page?: { slug?: string } | null;
    url?: string;
    newTab?: boolean;
  }> | null;
  ```
- `ResolvedPressConfig` gains:
  ```ts
  nav: { header: Array<{ label: string; href: string; external: boolean; newTab: boolean }> };
  ```

These are hand-maintained, exactly like the rest of the Site Settings mapping. **No
`PressSchema` / generator / `generated.ts` change.**

## 6. Rendering (engine-owned)

### 6.1 New `SiteNav` component — `packages/web/src/nav.tsx`

A client component (`'use client'`) that takes `links: ResolvedPressConfig['nav']['header']`
and renders a `<nav>`:

- Uses `usePathname()` to mark the active link (`aria-current="page"` + an active
  class). Home (`'/'`) matches exactly.
- `target="_blank"` is driven by `newTab` (editor opt-in). Whenever the target is
  `_blank`, the link also gets `rel="noopener noreferrer"`. The `external` flag drives
  the optional `↗` affordance (visual cue for off-site links), independent of `newTab`.
- Links render as plain `<a href={href}>` (matching the existing brand link in the
  header).
- Empty `links` → renders nothing.

Exported from `packages/web/src/index.ts`:
```ts
export { SiteNav } from './nav';
```

### 6.2 Host template — `layout.tsx`

The materialized host header (`packages/web/templates/host/app/layout.tsx`) imports
`SiteNav` from `@ogs-tech/press-web` and renders it next to the brand link:

```tsx
<header>
  <a href="/">{/* logo + name, unchanged */}</a>
  <SiteNav links={site.nav.header} />
</header>
```

The rendering logic lives in the versioned engine package; the host template stays
thin. This file is engine-owned and regenerated on every `press dev`/`build`, so
editing it here is correct (it is **not** an adopter hand-edit).

### 6.3 Styles — `packages/web/theme.css`

Minimal nav styles + active-link styling + a minimal responsive treatment (the menu
wraps / collapses gracefully on narrow viewports). A full JS hamburger is out of scope.

## 7. File-by-file change list

| Package | File | Change |
| --- | --- | --- |
| cms | `server/src/components/nav-item.json` | **new** component schema |
| cms | `server/src/lib/inject-components.ts` | +1 import, +1 `ENGINE_COMPONENTS` entry |
| cms | `server/src/content-types/site-setting/schema.json` | +`headerNav` attribute + metadata |
| web | `src/config/types.ts` | extend `SiteSettingsData` + `ResolvedPressConfig` |
| web | `src/map-site-settings.ts` | resolve `headerNav` → `nav.header` |
| web | `src/get-site-config.ts` | explicit populate incl. `headerNav.page` |
| web | `src/nav.tsx` | **new** `SiteNav` client component |
| web | `src/index.ts` | export `SiteNav` |
| web | `theme.css` | nav + active-link + responsive styles |
| host template | `templates/host/app/layout.tsx` | render `<SiteNav/>` |
| **adopter zone / shared / generator** | — | **no change** |

## 8. Primary risk + de-risking spike (do this FIRST)

The one genuinely novel thing in this design: a **relation (`page`) inside an
injected component** (the engine injects `press.nav-item`; it is not scanned from the
host `src/components`), targeting a **plugin content-type** (`plugin::press-cms.page`),
deep-populated through a **single type** (`site-setting`). Three things stacked that no
existing `press.*` component exercises today.

**Spike (in the playground), before committing the full implementation:**

1. Add `press.nav-item` (with the `page` relation) + the `headerNav` Site Settings
   attribute.
2. Boot the CMS (`pnpm play`). Confirm it starts cleanly and the relation's DB join
   table is created.
3. In the admin, add a header item linked to an existing page.
4. `GET /api/site-setting` with the explicit populate; confirm `headerNav[].page.slug`
   comes through.

**Fallback if relation-in-injected-component misbehaves:** drop the `page` relation for
v1 and ship the `url`-only link model (the "Approach A" link shape). Only
`nav-item.json` and the §5.2 resolver change; everything else (Site Settings field,
`SiteNav`, layout, styles, tests) stays. Revisit relations in a later cycle.

## 9. Testing

Follows the existing per-file `*.test.ts` convention.

- `map-site-settings.test.ts` (extend):
  - internal page → `/slug`
  - internal page whose slug === `routes.home` → `/`
  - external `url` → `href` + `external: true`
  - item with neither `page` nor `url` → dropped
  - absent / empty `headerNav` and CMS `null` → `nav.header === []`
- `get-site-config.test.ts` (extend): the populate query includes `headerNav.page`;
  a mocked fetch with nav data maps end-to-end.
- `nav.test.tsx` (**new**): renders links; the active link gets `aria-current`;
  external/`newTab` links get `target="_blank"` + `rel="noopener noreferrer"`;
  empty `links` renders nothing.
- cms `inject-components.test.ts` (extend): `press.nav-item` is injected and is **not**
  admitted into the page `body` Dynamic Zone.

Quality gate (per CLAUDE.md): `pnpm -r --if-present typecheck` + `pnpm -r test`. There
is no eslint.

## 10. Acceptance criteria

1. An editor can add/reorder/remove header nav items in Site Settings, each linking to
   a page or an external URL.
2. The host header renders the menu in order; the current page's link is marked active.
3. Internal links resolve from the related page's slug and survive a slug rename; the
   home page's item resolves to `/`.
4. External links open per `newTab` and carry `rel="noopener noreferrer"`.
5. Empty menu / CMS down / malformed payload → header shows only the logo; no crash.
6. No change to `PressSchema`, the generator, `generated.ts`, or the adopter zone.
7. `pnpm -r test` and `pnpm -r --if-present typecheck` pass.
