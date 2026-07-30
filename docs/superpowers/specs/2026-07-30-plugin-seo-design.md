# Plugin/SEO — Design Decisions

> Cited from code as `plugin-seo Spec §N`. Per repo convention, this doc may
> be removed after merge — CLAUDE.md ("Engine plugins") is the living
> architectural reference for these decisions.

**Goal:** ship `<head>` metadata (ranking + social share) as the engine's
second real plugin, following the canonical plugin structure the Base/Plugin
framework proved with `example` — one CMS component + one pure mapper + one
key on `ResolvedPressConfig.plugins` + explicit wiring at the render seam.
Unlike `example`/the retired cookie-consent, the integration seam is **not**
a mounted component — it is a pure metadata builder feeding the host's
`generateMetadata()` exports, plus one small mounted component for the one
piece Next's Metadata API cannot express (JSON-LD).

**Depends on:** Base/Plugin (`PressPlugin<Id>`, the `plugins/<id>/` structure,
the `plugin::press-cms.plugin` visibility index — all merged), Base/Pages
(the `page` content-type + ISR render pipeline), Base/Canonical.

**Corrects a stale premise:** the originating brief assumed a
`preset-config.seo` component already existed to extend. It does not —
identity/SEO/cookie-consent were fully retired from Site Settings in
`c709131` (2026-07-25), and `buildMetadata` today produces only `title` +
`favicon`, with a code comment explicitly deferring everything else to this
plugin. Every SEO/social component in this spec is new.

## §1 — CMS schema

**Site Settings defaults** — `preset-config.seo`, same category as
`basic-settings`/`layout`/`example-plugin`, attached to `site-setting` as a
new `seo` attribute:

| field | type | notes |
| --- | --- | --- |
| `enabled` | boolean | the plugin's gate; Strapi default `true` |
| `titleTemplate` | string | default `"%s · {site}"` — `%s` is Next's own title-template placeholder (substituted by Next itself), `{site}` is replaced with `brand.name` by `buildSeoMetadata` before the string reaches Next |
| `metaDescription` | string | site-wide default description |
| `ogImage` | media | site-wide default share image |
| `social` | component (`preset-config.seo-social`, nested) | mirrors the `basicSettings`/`themeAdvanced` nesting precedent — one component = one section, nested child = sub-section |

`preset-config.seo-social` (nested): `twitterHandle` (e.g. `@acme`, feeds
`twitter:site`), `twitterUrl`, `linkedinUrl`, `instagramUrl`, `facebookUrl`
(feed `Organization.sameAs`) — fixed named fields, not a repeatable list
(curated-primitives precedent, not a freeform editor).

**Page overrides** — `preset-config.seo-page`, attached to `page` as a new
`seo` attribute (the first schema change to `page` since it shipped):

| field | type | fallback when absent |
| --- | --- | --- |
| `metaTitle` | string | `page.title` |
| `metaDescription` | string | `site.seo.metaDescription` |
| `ogImage` | media | `site.seo.ogImage` |
| `noindex` | boolean | `false` |

**No canonical-override field.** Canonical is always self-referential
(`{site.url}{path}`, computed from the route the request actually hit — see
§3). Syndicated/duplicate-content edge cases are a deliberate YAGNI cut; add
a field later if real demand appears.

**Controller populate:**
- `site-setting.ts`'s `settingsPopulate()` gains `seo: { populate: { ogImage: true, social: true } }`.
- `page.ts`'s `find` **and** `findOne` gain `populate: { seo: { populate: { ogImage: true } } }` — today neither populates anything (`body` is a JSON custom field, never needed one). `find` (the list endpoint) needs it too: `getSitemapEntries` (§4) reads `seo.noindex` off the same list.

## §2 — Types and mapper (web side)

Mirrors the `example` plugin's six wiring points:

- `plugins/seo/types.ts` — `RawSeoPlugin`/`ResolvedSeoPlugin` (site defaults)
  + `RawSeoSocial`/`ResolvedSeoSocial` (`{ twitterHandle?: string; sameAs:
  string[] }` — `sameAs` is the non-empty social URLs, already filtered).
- `plugins/seo/default-seo-plugin.ts` — `DEFAULT_SEO_PLUGIN`: `enabled:
  true` (per-plugin decision, see §6 below — SEO is core product surface,
  not a demo), `titleTemplate: '%s · {site}'`, `metaDescription: ''`,
  `social: { sameAs: [] }`.
- `plugins/seo/map-seo-plugin.ts` — `mapSeoPlugin(raw): ResolvedSeoPlugin`,
  fail-open like `mapExamplePlugin`. `titleTemplate`'s `{site}` placeholder
  is **not** substituted here — that happens in `buildSeoMetadata` (§3),
  which is where `brand.name` is actually in scope alongside the template.
- `ResolvedPressConfig.plugins` gains `seo: ResolvedSeoPlugin` — another
  required key, the same press-web MAJOR discipline `pageDefaults`/`layout`/
  `plugins.example` already follow.
- `SiteSettingsData.seo?: RawSeoPlugin | null`; `mapSiteSettings` calls
  `mapSeoPlugin(c.seo)`.
- **Small, directly-motivated refactor:** `mediaUrl()` is currently a
  private helper inside `map-site-settings.ts`. It moves to `media.ts`
  (where `CMS_URL` already lives) because it now has two real consumers —
  `map-site-settings.ts` and the new `map-page.ts` below — not a speculative
  extraction.
- **`Page` gains `seo?: PageSeo`** (`types/base.ts`): `{ metaTitle?: string;
  metaDescription?: string; ogImage?: string; noindex?: boolean }`. `mapPage`
  resolves `raw.seo.ogImage` (raw CMS media) to an absolute URL via
  `mediaUrl()`, the same treatment `basicSettings.logo` already gets. Stays
  raw-ish — no default-filling here, matching `title`/`slug`/`body`, which
  `mapPage` also passes through unresolved. Fallback-to-site-default is
  `buildSeoMetadata`'s job, not the mapper's.
- **Plugin visibility index** (`plugin::press-cms.plugin`): `PLUGIN_DEFINITIONS`
  (cms) gains `{ id: 'seo', label: 'SEO & Social', configHost:
  'site-setting.seo', defaultEnabled: true, readEnabled: (site) =>
  site?.seo?.enabled }`; `syncPluginEntries`'s own populate call gains `seo:
  true`; `SiteSettingSnapshot` gains `seo?: { enabled?: boolean } | null`.

## §3 — `buildSeoMetadata` + JSON-LD + mount

**`buildSeoMetadata(resolved: ResolvedPressConfig, page: { title?: string;
seo?: PageSeo } | null, path?: string): Metadata`** replaces `buildMetadata`
(a rename — the retired function's own comment already announced this: *"…
deferred to a future Plugin/SEO"*). `path` is the browser-visible URL path
the caller already knows (`'/' + (slug ?? []).join('/')` in the catch-all
route) — the builder stays route-agnostic; it never re-derives routing.

- **Plugin disabled** (`resolved.plugins.seo.enabled === false`): returns
  **exactly** today's shape (`title` + `favicon`, nothing else) — zero
  behavior change for a site that hasn't opted in.
- **Plugin enabled:**
  - `metadataBase` — only when `resolved.site.url` is truthy (guards against
    `new URL('')` throwing on an empty/unreachable-CMS fail-to-empty state).
  - `title` — a plain string when `page` is present (`page.seo.metaTitle ??
    page.title ?? brand.name`; Next merges it into the ancestor template
    automatically); `{ template, default: brand.name }` when `page` is
    `null` (the root layout's fallback), where `template` is
    `resolved.plugins.seo.titleTemplate` with `{site}` substituted for
    `brand.name`.
  - `description` — `page.seo.metaDescription ?? site default`, omitted
    entirely when both are empty.
  - `alternates.canonical` — `${site.url}${path}`, only when both `path` and
    `site.url` are present.
  - `alternates.languages` — one entry keyed by `resolved.site.locale`
    pointing at the same canonical URL, only when `site.locale` is
    non-empty (an unfilled Site Settings record must never produce an
    empty-string hreflang key): the single-locale stub. Becomes a real
    multi-entry map with zero interface change once i18n ships.
  - `robots` — set to `{ index: false }` **only** when `page.seo.noindex` is
    true; otherwise omitted entirely (absent tag = indexable, the same
    "absent field = engine default" convention `container-attrs` already
    uses).
  - `openGraph` — `title`/`description`/`url`/`siteName` (`brand.name`) +
    `images: [{ url: ogImage }]` when an OG image resolves. `type` is always
    `'website'` — no `'article'` distinction; the `page` content-type has no
    publish-date fields to back one, and the brief's JSON-LD scope
    (WebPage/Organization) doesn't need it either.
  - `twitter` — `card: 'summary_large_image'`, `site: twitterHandle` when
    set, same title/description/image as Open Graph.
  - OG-image fallback chain: `page.seo.ogImage → site.seo.ogImage → (no
    image tag)`. Never falls back to `brand.logo` — a logo's aspect ratio is
    wrong for a 1200×630 share card.

**`buildJsonLd(resolved, page, path?): object[]`** — pure, `[]` when the
plugin is disabled. Otherwise returns two nodes:
- `Organization` — `name`/`logo`/`url` from existing identity fields,
  `sameAs` only when `social.sameAs` is non-empty.
- `WebPage` — `name`/`url`/`description` for the current page, `isPartOf: {
  '@type': 'WebSite', name, url }`.

**`<SeoJsonLd data={...} />`** — a plain server component (no client
interactivity, same precedent `ExamplePlugin` set over cookie-consent's
client-heavy shell), one `<script type="application/ld+json">` per entry.
Serializes with `JSON.stringify(entry).replace(/</g, '\\u003c')` —
**deliberate escaping of `<`** to close the `</script>` injection vector:
title/description text is free-form CMS content and must never be trusted to
not contain a closing tag. Mounted in `page.tsx`'s `CatchAllPage`, next to
`TreeRenderer`, gated the same way `ExamplePlugin` is:
`{site.plugins.seo.enabled && <SeoJsonLd data={buildJsonLd(site, page,
path)} />}`.

**ISR stays intact.** Nothing here touches `cookies()`/`headers()`/any
dynamic API — every value is derived from data already fetched under
`revalidate: 60`. The route keeps its static/ISR eligibility exactly as
today.

**Call sites:**
- `templates/host/app/layout.tsx`: `generateMetadata()` calls
  `buildSeoMetadata(await getSiteConfig(buildTime), null)` — no `path`, so no
  canonical/OG url (this fallback only fires for routes outside the
  catch-all, e.g. error boundaries).
- `templates/host/app/[[...slug]]/page.tsx`: `generateMetadata()` computes
  `path` **only when `page` resolved** — `page ? '/' + (slug ?? []).join('/')
  : undefined` — and calls `buildSeoMetadata(site, page ? { title:
  page.title, seo: page.seo } : null, path)`. This is the fix a self-review
  pass caught: `path` must never survive into the not-found branch, or a
  404 response would carry a self-referencing `alternates.canonical` —
  telling crawlers a non-existent page is the canonical URL for itself. Tying
  `path`'s presence to `page`'s presence keeps `buildSeoMetadata`'s existing
  `path`-gated canonical logic (§3 above) correct for free, with no special
  404 case inside the builder itself. The default export additionally mounts
  `<SeoJsonLd>` as above — safe because `notFound()` already runs first in
  `CatchAllPage`, so `page` is guaranteed non-null by the time that JSX
  renders.

## §4 — `sitemap.xml` and `robots.txt`

Explicitly in scope (expanded from the originating brief after review — the
brief only asked for per-page `noindex`, but a sitemap is table-stakes for a
plugin whose whole job is ranking, and the marginal cost is low once the
`page.seo` populate exists).

**`getSitemapEntries()`** (`packages/web/src/get-page-slugs.ts`, alongside
`getPageSlugs`/`getStaticPageParams`) — fetches `GET /api/pages` (now
populated with `seo`), returns `{ slug: string; noindex: boolean }[]`,
fail-to-empty like its neighbors.

**`app/sitemap.ts`** (`MetadataRoute.Sitemap`) — `[]` when
`plugins.seo.enabled` is false or `site.url` is empty. Otherwise one entry
per page from `getSitemapEntries()` **excluding `noindex: true` pages**
(standard practice — a page telling crawlers not to index it shouldn't be
advertised in the sitemap either), URL built with the same home-slug → `/`
mapping `getStaticPageParams` already uses. No `lastModified` — the `Page`
type doesn't currently expose `updatedAt`, and the brief doesn't need
sitemap freshness precision.

**`app/robots.ts`** (`MetadataRoute.Robots`) — **never blocks the site**:
always `{ rules: { userAgent: '*', allow: '/' } }`. Adds `sitemap:
'{site.url}/sitemap.xml'` only when the plugin is enabled and `site.url` is
present. The engine must never let a fail-to-empty state (CMS down,
misconfigured) silently turn into "block search engines" — that failure
mode is categorically worse than "no rich metadata," so it's excluded by
construction, not by a flag. Per-page blocking stays exactly the `noindex`
meta tag from §3.

## §5 — Testing

- `map-seo-plugin.test.ts` — fail-open (`null`/absent component →
  `DEFAULT_SEO_PLUGIN`); `social.sameAs` filters empty URLs.
- `map-page.test.ts` — `seo.ogImage` resolves to an absolute URL; `seo`
  absent stays `undefined`.
- `build-seo-metadata.test.ts` — the core matrix: disabled → today's minimal
  shape; enabled + `page: null` → `title.template`; enabled + page → title/
  description/ogImage/noindex overrides win over site defaults; empty
  `site.url` → no `metadataBase`/canonical, never throws.
- `build-json-ld.test.ts` — `Organization`/`WebPage` shape; a title/
  description containing `"</script><script>alert(1)"` never produces an
  unescaped `<` in the serialized output.
- `get-sitemap-entries.test.ts` — fail-to-empty; `noindex` pages excluded.
- `sync-plugin-entries.test.ts` (cms) — the new `seo` entry, same
  create-then-update coverage as `example`.
- `packages/cms` backend `tsc` typecheck covers the new schemas
  structurally (as it already does for every `preset-config.*` addition).

## Out of scope (deliberate)

A page-level canonical override field (§1). A site-wide "block everything"
robots toggle (§4 — categorically excluded, not deferred). `Article`-type
Open Graph / JSON-LD (no publish-date fields on `page` to back it). Real
multi-locale hreflang (waits on i18n; the `alternates.languages` shape
already accommodates it without a rewrite). `sitemap.xml`
`lastModified`/`changeFrequency`/`priority` (no `updatedAt` on `Page` yet).
A shared plugin-authoring helper (`definePlugin()`, still deferred per
base-plugin Spec §2 — SEO is only the second real plugin, one data point
short of a generalizable shape).

## §6 — Versioning

`@ogs-tech/press-web` **major**: `ResolvedPressConfig.plugins` gains the
required `seo` key (hand-constructed literals fail `tsc`); `Page` gains
`seo`; `buildMetadata` is renamed to `buildSeoMetadata` with an extended
signature (breaking export rename — acceptable pre-release per this repo's
established precedent). `@ogs-tech/press-cms` **minor**: additive only (3
new components, 1 site-setting attribute, 1 page attribute, 2 controller
populate changes, 1 `PLUGIN_DEFINITIONS` entry).

**Ships enabled by default** (`DEFAULT_SEO_PLUGIN.enabled = true`) —
deliberately diverging from the `example`/cookie-consent "ships disabled"
precedent: SEO is core product surface a fresh adopter site should have on
day one, not a demo requiring an opt-in step to discover.
