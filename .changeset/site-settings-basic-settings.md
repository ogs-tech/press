---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': major
---

feat!: retire Cookie Consent + SEO from Site Settings, add "Ajustes básicos", fix the Content Manager title

**Retired (press-cms + press-web).** Cookie Consent (`preset-config.cookie-consent`
/ `preset-config.cookie-category`, the banner, the client-only consent store,
the pre-paint bootstrap script) and SEO (`preset-config.seo`) are fully removed
from Site Settings and the engine — dedicated Plugin/Legal and Plugin/SEO are
expected to install their own entities later. `PressPlugin<Id>` and the
`'plugin'` canonical Entity stay as RESERVED, currently-unimplemented
scaffolding. `ResolvedPressConfig` no longer carries a `plugins` key until the
next plugin lands.

BREAKING (press-web): `buildMetadata`'s `<title>` is now `page.title ?? brand.name`
— no CMS-editable template. `ResolvedPressConfig.seo` and `.plugins` are gone;
`SiteSettingsData.seo`/`.cookieConsent` are gone.

**"Ajustes básicos" (press-cms + press-web).** Site Settings' flat
`name`/`url`/`locale`/`logo`/`favicon`/`themeColors`/`themeRadius` attributes
are replaced by one `basicSettings` attribute (`preset-config.basic-settings`):
identity plus the five theme tokens most sites reach for first
(`primary`/`accent`/`ink`/`surface` colors + one `radius`), each with a
system-impact tooltip. The remaining color/radius tokens nest one level deeper
as `themeAdvanced` (`preset-config.theme-advanced`), rendering as its own
collapsible sub-section — the same component-nesting pattern
`preset-config.layout` already uses for Page/Row/Column. `map-site-settings.ts`
re-assembles both groups back into the one full `ThemeColors`/`ThemeRadius`
shape the rest of the engine already expects — only the CMS-facing input
grouping changed.

BREAKING (press-cms): the Site Settings schema no longer has top-level
`name`/`url`/`locale`/`logo`/`favicon`/`themeColors`/`themeRadius`/`seo`/
`cookieConsent` attributes — everything moved under `basicSettings` (or was
removed). BREAKING (press-web): `SiteSettingsData` gains `basicSettings`
(`RawBasicSettings`) and drops the flat identity/theme fields.

**Content Manager title fix (press-cms).** The Site Settings single type's
admin header always read the record's own `name` field (Strapi's default
`mainField` heuristic picks the first `string` attribute) — a demo site named
"Press" leaked into the CMS chrome as the page title. `site-setting/schema.json`
now pins `config.settings.mainField: "id"`, so Strapi's own displayName
fallback ("Site Settings") always wins.

**Adopters must reseed.** An existing Site Settings record's flat
`name`/`url`/`locale`/`logo`/`favicon`/`themeColors`/`themeRadius`/`seo`/
`cookieConsent` values are orphaned by the schema change (Strapi keeps the old
DB columns until the next migration; the new `basicSettings`/`themeAdvanced`
component starts empty). Re-enter identity/theme values in the admin, or reset
the DB and let `pnpm dev` reseed fresh (the `free-column-spans` precedent).
