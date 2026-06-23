---
title: "Spec — Site Settings from the CMS: the CMS owns whitelabel, no config fallback"
internal_name: press-site-settings-cms
relates_to: docs/beta/prd.md
roadmap: docs/beta/roadmap.md
status: Design approved
created_at: 2026-06-19
updated_at: 2026-06-19
breaking: true
---

# Spec — Site Settings from the CMS

> [!WARNING]
> **This is a BREAKING change** on two surfaces. (1) It **removes `brand`, `site`,
> and `seo` from the public `PressConfig`** (and the `colors`/`radius` inputs from
> `theme`) — the adopter's `press.config.ts` no longer carries identity/SEO/theme
> values. (2) It **removes the `theme` content-type and `seedDefaultTheme`** shipped
> in the theming feature. Both ride a breaking-flagged **minor** changeset for
> `@ogs-tech/press-web` and `@ogs-tech/press-cms` (pre-1.0: under `0.x`, `minor`
> carries breaking changes — recorded in the changeset body, not a `major`→`1.0.0`).

> [!NOTE]
> Builds on the theming spec
> ([2026-06-19-press-default-theme-design.md](2026-06-19-press-default-theme-design.md)),
> which stored theme **selection** in the CMS but kept token **values** in
> `press.config.ts` ("Spec §12 seam"). This spec **crosses that seam** and
> **resolves the split-brain**: the editable whitelabel values move into the CMS as
> the single source of truth, fetched at runtime so editors change them **without a
> deploy**.

**TL;DR** — Whitelabel **identity** (`name, logo, favicon, url, locale`), **SEO**
(`titleTemplate, defaultTitle, defaultDescription, defaultOgImage`), and the
editable **theme values** (`colors`, `radius`) move out of `press.config.ts` into a
Strapi **Single Type "Site Settings"** (`plugin::press-cms.site-setting`), fetched at
**runtime** so a non-technical editor changes them in the admin and sees the result
**without a code deploy**. The **CMS is the sole source of truth** for these fields —
there is **no `press.config.ts` fallback** for identity/SEO (an earlier layered
design was dropped: a config fallback duplicates data, drifts from the live values,
and rots untested). `press.config.ts` keeps **only build-time anchors**: `routes`,
`theme.name` (the `ThemeName` type-guard + `<html data-theme>`), and `theme.fonts`
(which `next/font` must know at build time). A new web resolver
`getSiteConfig(buildTime)` fetches the Single Type and produces the existing
`ResolvedPressConfig` shape, so `buildMetadata` and `buildThemeStyle` stay
**unchanged**. **Theme values are the one exception to "no fallback":** an unset
color/radius resolves to the engine's `DEFAULT_THEME` constant — the engine's own
shipped default (the same base the theming feature already uses), **not** an adopter
config value. The fetch uses **ISR time-based revalidation** (~60s). When the CMS is
unreachable, the resolver behaves exactly like an empty record: engine-default theme
+ empty identity — **no crash, no config fallback**. The `theme` content-type and
`seedDefaultTheme` are removed; a Site Settings record is seeded **empty** on
bootstrap and the editor fills it on first registration. The design is **additive
toward multi-tenant**: the resolver gains a tenant selector later
(`getSiteConfig(buildTime, tenantKey)`) with no consumer change.

## 0. Foundation — one source of truth, chosen deliberately

The theming spec deferred CMS-sourced values to preserve **determinism**: `config`
is an immutable constant resolved once at build time, and `buildMetadata` /
`buildThemeStyle` are pure over it. The two confirmed drivers force a runtime read:

1. **Edit without deploy** — an editor changes brand name, logo, SEO text, or a theme
   color in the admin and the live site reflects it with no rebuild.
2. **Multi-site (future)** — eventually one CMS serves many sites; deferred now, but
   the design must not block it.

**A layered "config-as-fallback" model was considered and rejected.** Keeping
identity in both `press.config.ts` (fallback) and the CMS (live) means: (a) the two
drift — after an editor changes the name, the config still claims the old one and a
developer reading it is misled; (b) the fallback path runs only when the CMS is down,
so it rots untested; (c) "empty CMS field" is ambiguous — it can mean "inherit the
config default" or "the editor cleared it on purpose", and you cannot satisfy both.
The decision is therefore **the CMS is the single source of truth**; the config
fallback is removed because it has no reason to exist.

**What moves to the CMS (sole source, editable, runtime):**

- Identity: `name`, `logo`, `favicon`, `url`, `locale`
- SEO: `titleTemplate`, `defaultTitle`, `defaultDescription`, `defaultOgImage`
- Theme **values**: `colors` (9 tokens), `radius` (`xs/sm/md/lg`)

**What stays in `press.config.ts` (build-time anchors only — no identity):**

- `routes` (`home`) — drives routing/redirect (`permanentRedirect('/')`); structural.
- `theme.name` — the `ThemeName` type-guard and the `<html data-theme>` value;
  selection, not a value.
- `theme.fonts` — `next/font/google` must know the family at **build time** to
  download/optimize it; a CMS-sourced family string cannot be optimized.

**The one engine default (not a config fallback):** theme `colors`/`radius` resolve
over the engine's `DEFAULT_THEME` constant (`packages/web/src/config/default-theme.ts`).
This is the engine's shipped base — CSS always needs a value, and "no color" is never
a valid state — so it is categorically different from an adopter-identity fallback.
Identity/SEO have **no** such default: unset means empty.

## 1. Architecture — the decoupling point is `ResolvedPressConfig`

```
press.config.ts ─resolveConfig()─► buildTime: { routes, theme:{name,fonts} }   (pure)
                                          │
DEFAULT_THEME (engine constant) ──────────┤  theme colors/radius base
                                          │
CMS /api/site-setting ─fetch(ISR 60s)─► cms data (identity, seo, theme overrides)
                                          │
                          getSiteConfig(buildTime) ──► config: ResolvedPressConfig
                                          │                (same shape as today)
              buildMetadata(config) / buildThemeStyle(config)  ◄── UNCHANGED, still pure
```

`getSiteConfig` is the only code that knows the CMS exists. Upstream (config +
DEFAULT_THEME + CMS, or a future tenant row) only has to produce a
`ResolvedPressConfig`; downstream neither knows nor cares about the source — mirroring
how `getPage` isolates the content fetch.

## 2. Data model — CMS Single Type `site-setting`

A Strapi 5 **single type** in the `press-cms` plugin, UID
`plugin::press-cms.site-setting`, `kind: "singleType"`, `draftAndPublish: false`
(one always-live record — no draft/published filter on the read).

The editor sees **grouped** fields via three engine-owned Strapi **components**:

- `press.seo` — `titleTemplate`, `defaultTitle`, `defaultDescription` (string),
  `defaultOgImage` (media, single, images)
- `press.theme-colors` — `primary, accent, secondary, ink, surface, muted, danger,
  onPrimary, border` (all string)
- `press.theme-radius` — `xs, sm, md, lg` (all string)

Single type attributes:

```
site-setting (singleType)
├─ name      string
├─ url       string
├─ locale    string
├─ logo      media (single, images)
├─ favicon   media (single, images)
├─ seo          component  press.seo (non-repeatable)
├─ themeColors  component  press.theme-colors (non-repeatable)
└─ themeRadius  component  press.theme-radius (non-repeatable)
```

Component JSON files mirror `components/hero.json`. They are **non-DZ** components
(referenced by a content-type, not admitted into the page `body` dynamic zone), so
the exact wiring to register them in the plugin reuses/extends the engine's component
path (`register.ts` / `lib/inject-components.ts`); the precise mechanism is resolved
in the implementation plan. **Risk flagged:** plugin component registration is the
biggest implementation unknown — if it proves painful, the fallback is flat
prefixed scalar fields on the single type (`seoTitleTemplate`, `colorPrimary`, …),
with the grouping reconstructed in `mapSiteSettings` (§3.2) instead of in the schema.

**Out of the page/block pipeline.** Site Settings is read by its own resolver (§3),
**not** through `serialize-schema.ts` / `generate.ts`; it does not appear in the
adopter's generated page/block types and does not affect that machinery.

## 3. Web — `getSiteConfig` resolver + pure `mapSiteSettings`

Two new engine source files in `packages/web/src/`. `getSiteConfig` is the only new
code aware of the CMS; `mapSiteSettings` is pure and holds all the shape logic.

### 3.1 `get-site-config.ts`

```ts
import type { BuildTimeConfig, ResolvedPressConfig } from './config/types';
import { mapSiteSettings } from './map-site-settings';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Fetches the Site Settings single type and maps it into the full
 * ResolvedPressConfig, combining it with the build-time anchors (routes,
 * theme.name, theme.fonts). ISR-cached (~60s) so editor changes appear without a
 * deploy. Any failure — non-OK, network error, malformed body — maps as if the
 * record were EMPTY: engine-default theme (DEFAULT_THEME) + empty identity. There
 * is NO press.config fallback for identity/SEO by design (§0). The site renders
 * (unbranded, default-themed) rather than crashing.
 *
 * Multi-tenant seam: a later `tenantKey` argument selects a row from a `Site`
 * collection with the SAME return shape — no consumer changes.
 */
export async function getSiteConfig(buildTime: BuildTimeConfig): Promise<ResolvedPressConfig> {
  try {
    const res = await fetch(`${CMS_URL}/api/site-setting?populate=*`, { next: { revalidate: 60 } });
    const data = res.ok ? ((await res.json()) as { data: unknown }).data : null;
    return mapSiteSettings(buildTime, data);
  } catch {
    return mapSiteSettings(buildTime, null);
  }
}
```

### 3.2 `map-site-settings.ts` (pure)

`mapSiteSettings(buildTime, cms)` returns a `ResolvedPressConfig`. Rules:

- **Identity / SEO come ONLY from the CMS.** A present value is used as-is; a
  missing/empty value yields empty (`''` / `undefined`) — there is **no inheritance**,
  so "empty CMS field" unambiguously means "empty". (This is exactly why the config
  fallback was removed — see §0.)
- **Theme values resolve over `DEFAULT_THEME` per key.** Each color/radius uses the
  CMS value if present, else the engine `DEFAULT_THEME` value. This is the engine's
  shipped base, not an adopter fallback; a theme token is never empty.
- **Media → absolute URL.** `logo`, `favicon`, `defaultOgImage` arrive as Strapi
  media objects; resolve each `url` absolute against `CMS_URL`. Missing media →
  `undefined` (no config string to fall back to).
- **Build-time anchors come from `buildTime`:** `routes`, `theme.name`, `theme.fonts`.
- **Pure:** same inputs → same output, no I/O, no mutation; unit-testable without a
  server, safe inside an RSC.

The output is the exact `ResolvedPressConfig` shape `buildMetadata` and
`buildThemeStyle` already accept. **Those two functions are unchanged.**

### 3.3 Public exports

`packages/web/src/index.ts` adds `export { getSiteConfig } from './get-site-config'`.
`mapSiteSettings` stays internal (its tests import it directly).

## 4. Materialized templates — `layout.tsx` and `[[...slug]]/page.tsx`

Engine-owned templates (regenerated by `upgrade`, never hand-edited).

### 4.1 `layout.tsx`

- Becomes an **async** server component.
- Imports the build-time constant from `../press-config` (now typed `BuildTimeConfig`)
  and calls `const site = await getSiteConfig(buildTime)`.
- Static `export const metadata` becomes
  `export async function generateMetadata()` → `buildMetadata(await getSiteConfig(buildTime), null)`.
- `next/font` setup is **unchanged** (build-time families + `--press-font-*-default`).
- `<style>{buildThemeStyle(site)}</style>` injects CMS-sourced (or DEFAULT_THEME) values.
- `data-theme={buildTime.theme.name}`, `lang={site.locale}`, and the header/footer
  brand read from `site` (empty until the editor fills the record).

### 4.2 `[[...slug]]/page.tsx`

- `generateMetadata` (already async) fetches both `getSiteConfig(buildTime)` and
  `getPage(slug)`, returning `buildMetadata(site, page ? { title: page.title } : null)`.
- `slugFor` / `routes.home` keep reading `buildTime` → **routing and the `/home → /`
  redirect stay deterministic** and independent of CMS availability.

**Request efficiency.** Next dedupes identical `fetch` calls within a request and the
ISR Data Cache serves them across requests, so `getSiteConfig` resolves to a single
cached round-trip even when called in both `generateMetadata` and the component body.

## 5. CMS — added and removed

**Added:**

- `content-types/site-setting/schema.json` (the single type, §2).
- `components/seo.json`, `components/theme-colors.json`, `components/theme-radius.json`.
- Registration of the single type in `content-types/index.ts` and of the three
  components via the engine's component path (§2).
- A content-api route `GET /api/site-setting` in `routes/content-api/index.ts`
  (`auth: false, prefix: ''`, mirroring `/pages`) → a `site-setting` controller that
  reads the single record with `populate: '*'` and returns `{ data }`.
- `lib/seed-site-setting.ts` — idempotent seed that **creates one empty record if none
  exists** (mirrors the removed `seedDefaultTheme` pattern + fake-strapi test). Empty
  is intentional: no defaults are duplicated in the CMS; the editor fills identity on
  first registration, and theme values resolve over `DEFAULT_THEME` at read time (§3.2).
  `bootstrap.ts` calls it.

**Removed (resolves the theme conflict):**

- `content-types/theme/schema.json` + its registration.
- `lib/seed-default-theme.ts` + `lib/seed-default-theme.test.ts`.
- The `seedDefaultTheme` call in `bootstrap.ts` (replaced by `seedSiteSetting`).

The "Themes" admin menu disappears; theme editing happens under "Site Settings".

## 6. `press.config.ts` — shrunk to build-time anchors (breaking)

`PressConfig` loses `brand`, `site`, `seo`, and the `colors`/`radius` inputs on
`theme`:

```ts
export interface PressConfig {
  routes?: { home?: string };
  theme?: ThemeName | { name?: ThemeName; fonts?: Partial<ThemeFonts> };
}
```

`resolveConfig(PressConfig)` now returns a smaller **`BuildTimeConfig`**
(`{ routes: { home }, theme: { name, fonts } }`) — the deterministic build-time slice.
`ResolvedPressConfig` (the full shape consumed by `buildMetadata`/`buildThemeStyle`)
is **unchanged**; it is now produced by `getSiteConfig`, not `resolveConfig`. The
`.press/web/press-config.ts` constant is now `BuildTimeConfig`. `ThemeColors` /
`ThemeRadius` types remain (used by `DEFAULT_THEME`, `mapSiteSettings`, and
`buildThemeStyle`). `defineConfig` stays (passthrough for the shrunk input). The file
header comment is rewritten to state the new role; `upgrade` still never rewrites it.

## 7. Resilience — graceful, no config fallback

The runtime read introduces one failure mode the build-time constant lacked: the CMS
being unreachable. By design there is **no adopter fallback**. `getSiteConfig` maps a
failed/empty fetch identically to an empty record: **theme = `DEFAULT_THEME`,
identity/SEO = empty**. The page renders (engine-default look, unbranded) instead of
crashing. This is the accepted cost of a single source of truth: when the CMS is down,
the brand is absent rather than served from a stale duplicate.

## 8. Caching / freshness

ISR time-based revalidation: `fetch(..., { next: { revalidate: 60 } })`. Editor
changes appear within ~60s, served from the Data Cache (no per-request CMS round-trip
in the hot path; note that `getPage`'s `no-store` already makes the route dynamic, so
the benefit is fetch-level deduplication/caching, not static page output).
**Out of scope (additive fast-follow):** tag-based `revalidateTag` + a Strapi publish
webhook for instant invalidation — the right answer if ~60s proves too slow for the
"I edited it, show me now" expectation.

## 9. Multi-tenant path (additive — not built now)

The seam is the **resolver signature**. Today `getSiteConfig(buildTime)` reads the
singleton `/api/site-setting`. The future jump adds a `Site` collection (one row per
site) + a tenant selector (env var / domain / site key);
`getSiteConfig(buildTime, tenantKey)` reads that row and returns the same
`ResolvedPressConfig`. Layout, page, and the pure functions are untouched.

## 10. Tests (Vitest, following existing patterns)

- **Web — `mapSiteSettings` (pure, the most test-worthy surface):**
  - `null`/empty CMS → engine-default theme (`DEFAULT_THEME`) + empty identity/SEO;
    build-time anchors from `buildTime`.
  - Full CMS payload → identity/SEO mapped verbatim; theme overrides win.
  - **Empty CMS field stays empty** (no inheritance) — the core anti-drift assertion.
  - Per-key theme merge over `DEFAULT_THEME` (overridden key wins; sibling keys keep
    the engine default).
  - Media object → absolute URL against `CMS_URL`; missing media → `undefined`.
  - `theme.name` / `theme.fonts` / `routes` always from `buildTime`, even if the CMS
    payload contains them.
- **Web — `getSiteConfig`:** `fetch` mocked to (a) 200 body → mapped result, (b)
  non-OK → empty-record mapping, (c) thrown/rejected → empty-record mapping, (d)
  malformed JSON → empty-record mapping. Asserts the `revalidate` option is passed.
- **CMS — `seedSiteSetting`:** fake-strapi (`serialize-schema.test.ts` style) — creates
  exactly one empty record on a fresh DB; idempotent across repeated runs; targets
  `SITE_SETTING_UID`.
- **Updated:** `resolve-config.test.ts` — `resolveConfig` now returns `BuildTimeConfig`
  (no brand/site/seo); drop the brand/site/seo cases, keep routes + theme name/fonts.
- **Unchanged:** `buildMetadata`, `buildThemeStyle` tests stay green (functions untouched).
- **Manual `pnpm play`:** fill Site Settings in the admin → reflected within the
  revalidate window; stop the CMS → site renders engine-default + unbranded (no crash);
  the "Themes" menu is gone; a "Site Settings" entry exists.

## 11. Delivery

- **Changeset — minor** for `@ogs-tech/press-web` **and** `@ogs-tech/press-cms`
  (pre-1.0 breaking on a `minor`).
- **Migration note (changeset body):** `press.config.ts` no longer accepts
  `brand`/`site`/`seo` or `theme.colors`/`theme.radius` — move those values into
  **Site Settings** in the admin (now the source of truth, fetched at runtime).
  `press.config.ts` keeps `routes`, `theme.name`, `theme.fonts`. The `theme`
  content-type / "Themes" menu is removed. Adopters who pass the removed fields get a
  type error at `defineConfig` (loud, intended).
- **Playground (dogfood):** strip `brand`/`site`/`seo` (and `theme` values) from
  `apps/playground/packages/web/config.ts`; seed a Site Settings record with demo
  identity + a couple of theme overrides so `pnpm play` exercises the runtime path and
  the CMS-down behavior. Reset the playground DB if the removed `theme` content-type
  leaves an orphaned entry (`rm -rf apps/playground/packages/cms/.tmp`).

## 12. Acceptance criteria

1. **AC1 — Editable at runtime.** Changing `name`, `logo`, SEO text, or a theme color
   in admin Site Settings is reflected on the live site within the revalidate window,
   with **no rebuild/redeploy**.
2. **AC2 — CMS is the sole source; no config fallback.** `press.config.ts` /
   `PressConfig` contain **no** `brand`/`site`/`seo` and **no** `theme.colors`/`radius`
   inputs; passing them is a type error at `defineConfig`. There is no config-derived
   value for identity/SEO anywhere in the render path.
3. **AC3 — Empty means empty (no drift, no ambiguity).** An empty/unset identity or SEO
   field in the CMS renders empty — it is never backfilled from any other source.
4. **AC4 — Theme base is the engine default.** An unset theme color/radius resolves to
   `DEFAULT_THEME`; an overridden one wins per key; a theme token is never empty.
5. **AC5 — Pure functions unchanged.** `buildMetadata` and `buildThemeStyle` are
   byte-unchanged; a diff shows a new input source and a shrunk `resolveConfig`, not new
   logic inside them.
6. **AC6 — Graceful CMS-down.** With the CMS stopped, the site renders (engine-default
   theme, empty identity) without errors — identically to an empty record.
7. **AC7 — Theme conflict resolved.** The `theme` content-type, `seedDefaultTheme`, and
   the "Themes" menu are gone; theme colors+radius live in Site Settings;
   `theme.name`/`theme.fonts` remain in `press.config.ts`; `<html data-theme>` and
   `next/font` still work.
8. **AC8 — Build-time anchors intact.** `routes.home` (and `/home → /`) and font
   optimization behave identically to today and do not depend on CMS availability.
9. **AC9 — Multi-tenant-additive.** A single resolver (`getSiteConfig`) is the source
   seam; reaching multi-tenant requires adding a selector argument + a `Site` collection,
   not editing layout/page/pure functions (verified by inspection).
10. **AC10 — Breaking shipped honestly.** A `minor` changeset for both packages with the
    §11 migration note in its body — not a `major`/`1.0.0` jump.
11. **AC11 — Caching.** The Site Settings fetch passes `revalidate`; config is served
    from the Data Cache, not refetched uncached on every request.
