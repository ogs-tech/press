# @ogs-tech/create-press

## 0.1.1

### Patch Changes

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
