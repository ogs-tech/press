---
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': minor
---

feat: editable header navigation

CMS gains the `press.nav-item` component (injected, Site-Settings-only) and a
repeatable `headerNav` field on the Site Settings single type. Web deep-populates
`headerNav.page` (slug only), resolves each item into a final link (page wins over
url; the home slug collapses to `/`; items with neither are dropped), and ships a
`SiteNav` client component rendered in the host header with active-link
highlighting. Additive only — no PressSchema/generator/generated.ts/adopter-zone
change. Empty/unreachable/malformed CMS → header renders the logo only.

Side effect: replacing the Site Settings `populate=*` with an explicit deep
populate (required to reach `headerNav.page`) also deep-populates `seo.image`,
which the one-level `populate=*` did not reach — so the SEO OG image
(`defaultOgImage`) now resolves from the CMS instead of always being undefined.
