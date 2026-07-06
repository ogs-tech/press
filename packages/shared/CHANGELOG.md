# @ogs-tech/press-shared

## 0.2.0

### Minor Changes

- [#8](https://github.com/ogs-tech/press/pull/8) [`a6bdc84`](https://github.com/ogs-tech/press/commit/a6bdc84ca26eebe65a78ecfbdd7407e096ee839f) Thanks [@odenirdev](https://github.com/odenirdev)! - feat!: block-composable site chrome (chrome.\*)

  The site header and footer become block-composed: the `site-setting` single type
  gains two Dynamic Zones (`header`, `footer`) admitting a new engine-owned
  `chrome.*` category (`chrome.navbar`, `chrome.footer`) plus `press.*`,
  `section.*`, and adopter `custom.*` blocks. The serializer walks all three engine
  DZs and follows nested component references; the generator types nested
  components (without `__component`), skips relations, and emits
  `HeaderBlocks`/`FooterBlocks` unions. `mapSiteSettings` hydrates the zones (brand
  injection + nav resolution); `BlockRenderer` merges a new `chromeBlocks` registry
  (adopter-overridable); the host layout renders both zones through the block
  pipeline. `bootstrap()` seeds a default composition (navbar + footer) exactly
  once. `press-shared`: `Attr` gains typed `component`/`repeatable` keys (additive).

  BREAKING (press-cms): `site-setting.headerNav` is removed. Strapi drops its data
  on schema sync — there is no automated migration. After upgrading, re-enter the
  nav links once inside the seeded Navbar block (Site Settings → Header).

  BREAKING (press-web): `SiteNav` is no longer exported (the navbar renders links
  internally) and `ResolvedPressConfig.nav` is replaced by
  `ResolvedPressConfig.chrome` (`{ header, footer }` hydrated block arrays).
  Override the chrome like any block: `components={{ 'chrome.navbar': MyNavbar }}`.
