---
'@ogs-tech/press-web': minor
'@ogs-tech/press-cms': minor
---

feat: BASE/PAGES foundation — ISR intact, generic page seed, metadata reduced to <title>

**press-web — ISR restored, pages prerendered.** `getPage` now fetches ISR-cached
(`next: { revalidate: 60 }`, mirroring `getSiteConfig`) instead of
`cache: 'no-store'` — a single no-store fetch had opted the whole catch-all route
into per-request dynamic rendering. The route also declares
`export const revalidate = 60` and a `generateStaticParams` that lists published
slugs from the CMS (new `getPageSlugs`/`getStaticPageParams`), so published pages
are prerendered as static ISR at build (the route reports `● (SSG)` with a 60s
revalidate window instead of `ƒ (Dynamic)`). `dynamicParams` stays true, so a slug
added after the build renders on-demand and caches; and `getPageSlugs` fails to
empty, so an unreachable CMS at build yields zero prerendered pages (every page
renders on-demand) rather than failing the build — the CMS is a build-time
optimization, not a hard build dependency. `/home → /` and `notFound()` are
unchanged.

**press-web — metadata reduced (behavior change).** `buildMetadata` now emits
only `<title>` (+ favicon). `description`, `openGraph`, and `alternates`
(canonical) are removed — the old canonical was always the site root, i.e. wrong
for every non-home page, so dropping it is a net improvement. All SEO/social
metadata is deferred to a future Plugin/SEO.

**press-cms — generic seed, privacy removed.** New generic idempotent
`seedPage({ slug, title, body, flagKey })` (flag-first, slug-collision → adopter
wins, created as DRAFT) replaces the bespoke `seedPrivacyPolicyPage`. Base does
not seed a privacy-policy page anymore — that belongs to a future Plugin/Legal.
`seedPage` is exported-but-unused public API until the first consumer lands.
