---
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': minor
---

feat: `preset-organism.columns` — the first editor-composed layout block

`@ogs-tech/press-cms`:

- **New page-body organism `preset-organism.columns`** (admitted statically in
  `page/schema.json`, body only — the hero/cta placement rule). Layout controls
  are flat CLOSED enums on the organism (the `hero.align` precedent):
  `ratio` (`50-50 | 33-67 | 67-33 | 33-33-33 | 25-25-25-25`), `gap`
  (`compact | normal | spacious`), `verticalAlign` (`top | center | bottom`).
  The raw `GridGap`/`Span` scales are never exposed to the CMS.
- **New nested-only molecule `preset-molecule.column`** (rich text + optional
  image + optional `preset-atom.button` — the `navbar.cta` nesting pattern);
  repeatable 2–4 per block, never a DZ member. `preset-layout` stays reserved
  and empty: the top-level block is a content ORGANISM that consumes the grid
  internally, so "layout is never an editor-placed top-level block" holds.
- **`buildBodyPopulate` deep-populates the columns chain.** `populate: '*'` is
  shallow; a column's `image`/`button` sit TWO levels below the DZ member and
  silently came back empty — the exact shape that already forced the navbar's
  deep populate in the chrome zones.
- Serializer and generator needed **zero code change** — the BFS follows the
  two-level chain (`columns → column → button`) generically; new tests pin that.

`@ogs-tech/press-web`:

- **New `Columns` renderer** (`preset-organism.columns` in `organismBlocks`,
  overridable like every organism) built on Container/Grid/Column, mirroring
  the Hero: stacks at base, `25-25-25-25` goes 2×2 on md before 4-up on lg,
  `spacious` gap is tier-scaled (never a flat `lg` — the 11-gap 528px floor).
  Tolerant: no columns renders nothing; an empty column keeps its cell; a
  column beyond the ratio's slots reuses the last span instead of dropping.
- Cells render rich text via `renderBlocks` + raw `<img>`/`<a>` — NOT the atom
  components, whose `data-block="preset-atom.*"` would match the prose-width
  rule at any depth and fight the cell's own width.
- theme.css: columns section styles + the per-column button joins the shared
  button family (all variants and states).
- New exported types `PresetOrganismColumns` / `PresetMoleculeColumn`; the CLI
  seed demonstrates a `33-33-33` block with a nested secondary button.
