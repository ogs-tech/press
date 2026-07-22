---
'@ogs-tech/press-shared': major
'@ogs-tech/press-cms': major
'@ogs-tech/press-web': major
'@ogs-tech/create-press': major
---

feat!: composition builder — a JSON PressTree replaces the dynamic-zone mechanism engine-wide

BREAKING (wire + palette + API), no data migration (pre-release):

- `page.body` and the new `site-setting.pageDefaults` store a `PressTree` /
  `Node[]` slots via the `plugin::press-cms.builder` JSON custom field; the
  page-body and chrome Dynamic Zones (and `dz-populate`) are gone.
- Per-page layout root: header/footer slots (`inherit | none | custom`), rows
  with 1–4 ratio-bound columns, full recursion, adopter `custom-*` blocks
  anywhere. Curated `container` attrs (`width`/`gap`/`verticalAlign`).
- `@ogs-tech/press-shared` is now a PUBLISHED runtime dependency of press-web:
  it ships the tree types + the sanitizing `validatePressTree` validator used
  by the cms write path and the web render path.
- Palette: new `preset-molecule.link` (label/page/url/newTab) referenced by
  button/hero/cta/navbar; `preset-molecule.nav-item`, `preset-molecule.column`,
  `preset-organism.columns` removed. Text atoms store curated PLAIN TEXT
  (`content: text`) — the Strapi blocks AST leaves the wire (`renderBlocks`
  removed). `preset-layout.{container,row,column}` descriptors drive the
  builder's layout forms.
- Serve-time hydration: media `{ assetId }` and page `{ documentId }` refs are
  resolved server-side (fresh URLs/slugs; rename-safe internal links).
- Web: `TreeRenderer` (header/main/footer shell) replaces `BlockRenderer`;
  `PressLink`/`resolveLink` are the one link resolver; prose rail rescoped to
  direct `<main>` children; `PageBody` generates as `PressTree`; the
  `HeaderBlocks`/`FooterBlocks` unions are gone.
