---
"@ogs-tech/press-web": minor
"@ogs-tech/press-cms": minor
---

Correct the Site Settings field nomenclature. The `press.seo` component keys drop their redundant prefixes — `defaultTitle` → `title`, `defaultDescription` → `description`, `defaultOgImage` → `image` (`titleTemplate` is unchanged). Editor-facing labels for every Site Settings field (identity, SEO, theme tokens) are now shipped declaratively via `config.metadatas` in the engine's schemas, so the admin form shows "Site Name", "Title Template", "Social Image", etc. instead of raw camelCase keys.

`@ogs-tech/press-web` follows the rename at the CMS seam only: `SiteSettingsData.seo` mirrors the new keys and `mapSiteSettings` reads them, translating to the engine's internal `default*` SEO names (unchanged) — `buildMetadata` and `ResolvedPressConfig` are untouched.

BREAKING: the `press.seo` attribute keys changed. Adopters with existing Site Settings data must re-enter the SEO Title / Description / Social Image (the old columns are orphaned, not migrated).
