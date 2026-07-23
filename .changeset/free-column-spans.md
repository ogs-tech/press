---
'@ogs-tech/press-shared': major
'@ogs-tech/press-web': major
'@ogs-tech/press-cms': major
'@ogs-tech/create-press': patch
---

feat!: free 1–12 column spans per breakpoint, replacing the row ratio enum

BREAKING (wire): `PRESS_TREE_VERSION` bumps 1 → 2. `RowNode.ratio` (and the
`Ratio` type) is removed; each `ColumnNode` now carries `span: { base; md?; lg? }`
(1–12 tracks, mobile-first, `base` required) — the one responsive value stored in
the composition tree. Readers fail-to-empty on any other version; writers reject
malformed spans. **No data migration** (pre-release, authorized): stored v1 trees
are dropped on read.

- shared: `Span`/`ColumnSpan` types, span validation (default `{ base: 12 }` +
  warn on malformed tiers), version-2 gate, no wire column cap.
- web: `spanFor(column)` passthrough; `RATIO_SPANS` removed; `<Column>`, the four
  primitives, and `theme.css` are untouched.
- cms: builder replaces the row-ratio select with per-column base/md/lg span
  selects, a read-only 12-track preview bar, a breakpoint toggle, and a per-tier
  total badge; `MAX_COLUMNS` 4 → 12; `preset-layout.row` descriptor drops `ratio`.

Adopters must reseed: a playground/dev DB seeded at v1 (pageDefaults/home) reads
back empty until reseeded — reset the DB and let `pnpm dev` reseed at v2.
