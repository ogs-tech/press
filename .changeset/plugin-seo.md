---
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': minor
---

feat: Plugin/SEO — head metadata (ranking + social share), enabled by default

The engine's second real plugin, built on the Base/Plugin framework: rich
`<head>` metadata as an opt-in `PressPlugin`, unlike `example`/cookie-consent
wired through a pure metadata builder (`buildSeoMetadata`) feeding
`generateMetadata()`, not a mounted component.

Site Settings gains a `seo` component (title template, default description,
default share image, and a nested social-profiles group feeding Twitter's
`twitter:site` and the site's Organization JSON-LD `sameAs`); the `page`
content-type gains its own `seo` component (per-page title/description/
share-image overrides + a `noindex` toggle) — the first schema change to
`page` since it shipped.

`buildSeoMetadata` produces title (a Next `title.template`/`title.default`
pair site-wide, a plain override string per page), description, a
self-referencing canonical + single-locale hreflang stub, per-page
`noindex`, and Open Graph + Twitter card metadata — all fail-open: a
disabled plugin, an empty Site URL, or even a malformed one never crashes a
render, and reproduces the pre-plugin title+favicon-only shape exactly.
JSON-LD (`Organization` + `WebPage`) can't travel through Next's `Metadata`
object, so it ships as a small mounted `<SeoJsonLd>` (the `ExamplePlugin`
mount precedent), with `</script>`-injection escaping since the underlying
text is free-form CMS content. Two new host routes, `sitemap.xml` and
`robots.txt`, round out ranking support — the sitemap excludes `noindex`
pages, and `robots.txt` never blocks the site outright (only adds the
sitemap pointer when enabled), by design.

**Ships enabled by default** — diverging from the `example`/cookie-consent
"ships disabled" precedent: SEO is core product surface a fresh adopter
site should have on day one, not a demo requiring an opt-in step to
discover.

BREAKING (press-web): `ResolvedPressConfig.plugins` gains the required `seo`
key; `Page` gains `seo`; `buildMetadata` is renamed to `buildSeoMetadata`
with an extended signature (`(resolved, page, path?)`).

press-cms is additive only: three new components, one Site Settings
attribute, one page attribute, two controller populate changes, one
`PLUGIN_DEFINITIONS` entry.
