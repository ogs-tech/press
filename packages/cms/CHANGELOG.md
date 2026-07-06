# @ogs-tech/press-cms

## 1.0.0

### Major Changes

- [`936ece7`](https://github.com/ogs-tech/press/commit/936ece7cdf9fadf17f5174512855a10506d3c6ad) Thanks [@odenirdev](https://github.com/odenirdev)! - feat!: Atomic Design component palette — unified `{owner}-{layer}.{name}` scheme

  BREAKING (wire + API): the ad-hoc `press.*` / `section.*` / `chrome.*` prefixes
  are replaced by ONE Atomic Design scheme where the Strapi category encodes
  `{owner}-{layer}` (owner ∈ preset|custom, layer ∈ atom|molecule|organism|config|
  layout|template) and stored `__component` values change accordingly:

  - `press.{paragraph,heading,list,quote,image,button,separator,spacer}` →
    `preset-atom.*`; `press.nav-item` → `preset-molecule.nav-item`;
    `press.{seo,theme-colors,theme-radius,cookie-consent,cookie-category}` →
    `preset-config.*`.
  - `section.{hero,cta}` and `chrome.{navbar,footer}` unify under
    `preset-organism.*` (one layer; placement — body vs header/footer — is declared
    per content-type `schema.json`, not by the category). `hero`/`cta` are now
    **body-only**.
  - Adopter blocks move from placement folders (`custom` / `custom-section` /
    `custom-chrome`) to atomic-LAYER folders (`custom-<layer>/`, e.g.
    `custom-organism/`); `admitCustomBlocks` now admits every `custom-*` block into
    ALL engine Dynamic Zones (universal placement — the editor decides where),
    dropping the per-category placement map. Legacy bare `custom.*` is still
    admitted for a forgiving migration.

  **press-web**: exported registries renamed (`referenceBlocks` → `atomBlocks`;
  `sectionBlocks` + `chromeBlocks` → `organismBlocks`) and the base block types
  renamed (`PressParagraph` → `PresetAtomParagraph`, `SectionHero` →
  `PresetOrganismHero`, `ChromeNavbar` → `PresetOrganismNavbar`, …). The generator,
  `PressSchema` contract, `urn`/`blockKey` primitives, and the `plugin::press-cms.*`
  plugin id are unchanged (the product name "press" is not a component category).
  The scaffolder ships the migrated `custom-organism.callout` example.

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

### Minor Changes

- [#9](https://github.com/ogs-tech/press/pull/9) [`21c793b`](https://github.com/ogs-tech/press/commit/21c793b456331a7f6a1e3246ebc2d967416b5f3c) Thanks [@odenirdev](https://github.com/odenirdev)! - feat(cms): component-picker UX — per-block icons + human category labels

  Every engine component JSON now sets `info.icon` (Strapi's fixed icon enum), so
  the admin "Pick one component" dialog stops rendering the generic grid fallback
  for all blocks: `press.paragraph` → `write`, `press.image` → `picture`,
  `section.hero` → `landscape`, `chrome.navbar` → `layout`, and so on.

  The plugin also ships its first admin bundle (`./strapi-admin` export, built by
  the same `strapi-plugin build`). Its single job is `registerTrads`: the picker
  resolves each category accordion title through react-intl using the RAW
  category string as the message id, so the bundle registers unprefixed keys —
  `press` → "Blocks", `section` → "Sections", `chrome` → "Site chrome",
  `custom` → "Custom blocks" (en + pt/pt-BR) — labelling the picker without
  touching component uids (a uid is wire/DB contract; labels are presentation).
  Adopters keep the final word: `src/admin/app.tsx` `config.translations` takes
  precedence over these engine defaults.

- [#9](https://github.com/ogs-tech/press/pull/9) [`21c793b`](https://github.com/ogs-tech/press/commit/21c793b456331a7f6a1e3246ebc2d967416b5f3c) Thanks [@odenirdev](https://github.com/odenirdev)! - feat!: cookie-consent — the first engine plugin, introducing the `'plugin'` canonical

  **Engine plugins (press-web).** `Entity` gains `'plugin'` (additive) and the
  new `PressPlugin<Id>` contract (`extends Canonical<'plugin'>`, `id`, `enabled`)
  formalizes the plugin family: an optional engine capability configured through
  Site Settings, resolved by a pure mapper into the new
  `ResolvedPressConfig.plugins` named map, and mounted explicitly by the host
  layout — no runtime registry. Plugin identity is synthetic
  (`urn:plugin:cookie-consent`), never CMS-sourced.

  **Cookie consent (press-web).** New `CookieConsentBanner` (the engine's first
  stateful client component), the `useConsent()` hook, and the consent store:
  `hasConsent('analytics')` (fail-closed), `acceptAll`/`rejectAll`/`setConsent`/
  `resetConsent`, `parseConsentCookie` (server-side seam), and
  `buildConsentBootstrapScript()` — a pre-paint inline script the host layout
  injects so a decided visitor never sees the banner flash. The decision lives
  in a versioned first-party cookie (`press_consent`, SameSite=Lax, 180d), never
  read via `cookies()` in the RSC tree (static/ISR stays intact). The resolved
  plugin FAILS OPEN: an unreachable CMS still yields an enabled banner with the
  engine's default copy — a consent gate must not vanish on a CMS hiccup.
  Consent categories are a closed code union (`necessary | analytics |
marketing`); editors toggle and re-word them, never rename keys.

  **Cookie consent (press-cms).** New `press.cookie-consent` +
  `press.cookie-category` config components (injected, never DZ-admitted), a
  `cookieConsent` attribute on Site Settings with deep populate (nested
  categories + privacy page slug), and a run-once seed (`cookieConsentSeeded`
  plugin-store flag) that writes only the `enabled` booleans — default copy
  lives web-side; an editor-disabled banner is respected forever.

  BREAKING (press-web): `ResolvedPressConfig` gains a REQUIRED `plugins` field.
  Runtime is additive — every object produced by `getSiteConfig` carries it —
  but adopter code that hand-constructs a literal (test fixtures, mocks) fails
  `tsc` until it adds `plugins: { cookieConsent: ... }` (or builds the value
  through `mapSiteSettings`). The host template's `layout.tsx` also changed
  (bootstrap script + banner mount) and is re-materialized on the next
  `press dev`/`build`.

- [#9](https://github.com/ogs-tech/press/pull/9) [`21c793b`](https://github.com/ogs-tech/press/commit/21c793b456331a7f6a1e3246ebc2d967416b5f3c) Thanks [@odenirdev](https://github.com/odenirdev)! - feat(cms): custom block kinds — placement-scoped adopter categories

  The adopter extension point now carries placement semantics per category
  folder (`admitCustomBlocks`):

  - `src/components/custom/` → every engine Dynamic Zone (page `body` +
    site-setting `header`/`footer`) — the existing contract, unchanged;
  - `src/components/custom-section/` → the page `body` only;
  - `src/components/custom-chrome/` → the site-setting `header`/`footer` only,
    never the page body.

  Purely additive: existing `custom.*` blocks keep their behavior and uids. The
  engine still never names individual adopter blocks — only the `custom*`
  categories are the stable contract. Note: `custom-chrome.*` blocks do not
  receive the brand/links hydration that `chrome.navbar` gets from
  `mapSiteSettings`; they render from their stored attributes alone.

- [`b11ced9`](https://github.com/ogs-tech/press/commit/b11ced9730896101871952e4627fcc2b3cb19fb8) Thanks [@odenirdev](https://github.com/odenirdev)! - feat: editable header navigation

  CMS gains the `press.nav-item` component (injected, Site-Settings-only) and a
  repeatable `headerNav` field on the Site Settings single type. The Site Settings
  controller deep-populates `headerNav.page` (slug only), and Web resolves each item
  into a final link (page wins over url; the home slug collapses to `/`; items with
  neither are dropped) and ships a `SiteNav` client component rendered in the host
  header with active-link highlighting. Additive only — no
  PressSchema/generator/generated.ts/adopter-zone change. Empty/unreachable/malformed
  CMS → header renders the logo only.

  Side effect: replacing the Site Settings `populate=*` with an explicit deep
  populate (required to reach `headerNav.page`) also deep-populates `seo.image`,
  which the one-level `populate=*` did not reach — so the SEO OG image
  (`defaultOgImage`) now resolves from the CMS instead of always being undefined.

- [#9](https://github.com/ogs-tech/press/pull/9) [`21c793b`](https://github.com/ogs-tech/press/commit/21c793b456331a7f6a1e3246ebc2d967416b5f3c) Thanks [@odenirdev](https://github.com/odenirdev)! - feat(cms): seed a Privacy Policy page template once at bootstrap

  `bootstrap()` now seeds a "Privacy Policy" page (slug `privacy-policy`) exactly
  once, following the chrome-seed semantics: a `privacyPageSeeded` plugin-store
  flag makes the pass literal-once, an adopter page already occupying the slug
  wins (seed marks itself done without writing), and an editor-deleted page is
  respected forever. The page is created as a DRAFT — the engine never publishes
  content on its own.

  The template is structure + placeholder guidance composed from existing
  `press.*` atoms (intro, Data We Collect, Cookies, How We Use Your Data, Data
  Sharing, Your Rights, Contact) — no legal boilerplate is embedded; the editor
  writes and owns the actual policy text.

- [#6](https://github.com/ogs-tech/press/pull/6) [`490bdc7`](https://github.com/ogs-tech/press/commit/490bdc7f63c9fe893c249e32be8f60fd13891061) Thanks [@odenirdev](https://github.com/odenirdev)! - feat: composite section blocks (section.\*)

  Adds an engine-owned palette of composite sections under a new `section.*`
  category: `section.hero` and `section.cta`. CMS injects both components and lists
  them statically in the page `body` Dynamic Zone; they flow through the unchanged
  type-sync pipeline (all fields are flat scalar/media/enum), so `serialize-schema`
  and the generator are untouched. Web ships `Hero`/`Cta` renderers behind a separate
  `sectionBlocks` registry that `BlockRenderer` merges between `referenceBlocks` and
  the adopter's `components` — each section is born branded by the Site Settings theme
  (theme.css consumes `var(--press-*)` tokens) and overridable via
  `components={{ 'section.hero': MyHero }}`. Additive and non-breaking: `press.*` and
  `custom.*` are unchanged; adopters gain `section.*` on `press upgrade`.

### Patch Changes

- [#8](https://github.com/ogs-tech/press/pull/8) [`a6bdc84`](https://github.com/ogs-tech/press/commit/a6bdc84ca26eebe65a78ecfbdd7407e096ee839f) Thanks [@odenirdev](https://github.com/odenirdev)! - fix(cms): silence the schema-poll http log line in development

  `press dev` polls `GET /api/press/schema` every ~2s (the type-sync watcher),
  and Strapi's `strapi::logger` middleware logs every request unconditionally —
  flooding the dev log with one line per poll. The plugin now wraps
  `strapi.log.http` during `register()` and drops messages for that one
  engine-owned path, in development only: in production the watcher never runs,
  and a stray hit on the schema endpoint stays visible.
