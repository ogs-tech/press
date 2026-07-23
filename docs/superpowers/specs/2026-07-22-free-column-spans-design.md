# Free Column Spans — design spec

Date: 2026-07-22
Status: approved direction, pre-implementation
Breaking: YES — wire change (`PRESS_TREE_VERSION` 1 → 2, `RowNode.ratio` removed, `ColumnNode.span` added); pre-release, no data migration

## 1. Problem

A row's column split is expressed today by a closed `RowNode.ratio` enum
(`50-50 | 33-67 | 67-33 | 33-33-33 | 25-25-25-25`), which the engine maps to
12-track spans (`RATIO_SPANS` in `packages/web/src/tree/container-attrs.ts`).
Two limits:

1. **Not a true 12-column grid.** Editors can only pick 5 presets; they cannot
   express an arbitrary N-of-12 width per column.
2. **Ratio and column count can silently diverge.** `insertNode`/`addColumn`
   enforce only `MAX_COLUMNS = 4`, not the ratio's own slot count
   (`RATIO_SLOTS`). Picking `50-50` (2 slots) and adding columns to 4 makes
   `spanFor` reuse the last span → `50-50` renders `6-6-6-6` (a 2×2 wrap),
   `33-67` renders `4-8-8-8` (= 28 track-units, with sparse-placement gaps
   because no `grid-auto-flow: dense`). The rendered result stops matching the
   ratio label — reads as "not following the 12-column canon."

The product wants a real 12-column grid: a **free span (1–12) per column**,
controllable **per breakpoint**, edited in the admin composition builder.

## 2. Decisions (brainstorm outcomes)

| Decision | Choice |
| --- | --- |
| Where the gap is felt | Admin composition builder — but the change spans `shared → web → cms-server → cms-admin → cli/seeds` |
| Column width model | Free span **1–12 per column**, replacing the `ratio` enum |
| Responsive control | **Full per-breakpoint**, mobile-first: each column stores span for `base`/`md`/`lg` (`base` required; `md`/`lg` optional, cascade up) |
| Ratio | **Removed entirely** from the wire; no presets kept |
| Sum-to-12 | **Free** (Bootstrap-style): sum < 12 leaves trailing space, sum > 12 wraps (CSS grid auto-placement). Builder shows a per-tier total, never blocks |
| Span JSON shape | **Object-only** `{ base; md?; lg? }`, `base` required |
| Builder UX | Per-column `base`/`md`/`lg` selects + **read-only 12-track preview bar** + breakpoint toggle (Base/md/lg) + per-tier total badge |
| `MAX_COLUMNS` | 4 → **12** |
| New-node defaults | New column `{ base: 12 }`; new row = 2 columns each `{ base: 12, md: 6 }` (stacked on mobile, 50/50 on desktop) |
| Wire version | `PRESS_TREE_VERSION` 1 → 2; readers fail-to-empty on v1; **no data migration** (pre-release, authorized) |
| Architecture note | Consciously **reverses** "responsiveness never in the JSON" — column span is now the one responsive value stored in the tree. CLAUDE.md updated. |

Explicitly rejected: interactive drag/resize preview (selects + read-only bar
instead); keeping `ratio` as a stored default or as builder presets (removed
outright, per the brainstorm); a scalar-or-object span shape (object-only chosen
for validation clarity and a 1:1 match with the 3-field builder control).

## 3. Data model — `@ogs-tech/press-shared` (`src/tree.ts`)

```ts
/** Readers reject any other version (fail-to-empty); gates future migrations. */
export const PRESS_TREE_VERSION = 2;   // was 1

/** 1..12 track span. Kept `number` (not a 12-arm literal union) on the wire;
 *  the range is enforced by the validator, not the type. */
export type Span = number;

/** Mobile-first responsive span: `base` is the required mobile default; `md`/`lg`
 *  are optional overrides that cascade up (md inherits base, lg inherits md).
 *  This is the ONE responsive value the composition JSON carries. */
export interface ColumnSpan {
  base: Span;
  md?: Span;
  lg?: Span;
}

export interface ColumnNode {
  id: string;
  type: 'column';
  span: ColumnSpan;            // NEW
  container?: ContainerAttrs;
  children: Node[];
}

export interface RowNode {
  id: string;
  type: 'row';
  // ratio: Ratio;             // REMOVED
  container?: ContainerAttrs;
  children: ColumnNode[];      // 1..MAX_COLUMNS; each column owns its span
}
```

- **Remove** `export type Ratio = …` (line 14).
- Rewrite the file header comment: responsiveness NO LONGER "never appears in
  this JSON" — `ColumnSpan` (base/md/lg) is the deliberate exception; `container`
  attrs remain editorial intents mapped code-side.
- `Span` is `number` in `shared`; the `web` primitive's `Span` is the literal
  union `1|…|12`. The web mapping (`spanFor`) casts the validated value to the
  web `Span` — safe because the validator has already constrained it to 1..12.

## 4. Validator — `@ogs-tech/press-shared` (`src/validate-tree.ts`)

Keep the existing **strict-write / tolerant-read** split (structural failure →
`value: null` + `errors`; attr-level failure → sanitize + `warnings`; writers
reject on errors OR warnings; readers render whenever `value` is non-null).

- **Version gate** (line ~173): expect `2`. A v1 tree fails → `value: null`
  (fail-to-empty). No migration.
- **Remove** ratio validation (`RATIOS`, lines ~127–128) and the `ratio` field
  when building `RowNode` (line ~141).
- **Column count**: no longer tied to a ratio's slot count. Accept `children`
  as a non-empty `ColumnNode[]` (structural). The 12-column cap is a builder
  concern (`MAX_COLUMNS`), not a wire invariant.
- **New: span validation** (attr-level, sanitize + warn — never nulls the tree):
  - `span` absent or not an object → default `{ base: 12 }`, warning.
  - `base` not an integer in `[1,12]` → default `12`, warning.
  - `md` / `lg` present but not an integer in `[1,12]` → **drop that tier**
    (inherit via cascade), warning. Absent `md`/`lg` is valid and silent.
  - No silent rounding — a non-integer is invalid, handled as above.
  - The output `ColumnNode` always has a well-formed `span` (base guaranteed).
- Net effect: a builder-produced tree (always valid) writes clean; a malformed
  direct-API write is rejected (warnings block); a legacy/hand-written read
  renders best-effort with defaults.

## 5. Web renderer — `packages/web/src/tree/`

CSS, `theme.css`, and the four layout primitives (`Grid`, `Column`, `Row`,
`Container`) are **untouched** — the new `ColumnSpan` shape matches the
`Responsive<Span>` the `<Column>` primitive already consumes.

- **`container-attrs.ts`**
  - **Delete** `RATIO_SPANS`.
  - Replace `spanFor(ratio, index)` with `spanFor(column: ColumnNode):
    Responsive<Span>` → returns `column.span` (base defaulted to 12), cast to
    web `Span`.
  - Keep `GAP_TIERS`, `rowGap`, `rowAlign`, `rowWidth`, `STACK_GAPS`,
    `stackGap`, `cellAlign` unchanged.
- **`tree-renderer.tsx`**
  - `ColumnView` drops the `ratio`/`index` props; reads `column.span` via the
    new `spanFor(column)`.
  - `RowView` maps `row.children` to `ColumnView` without threading
    `ratio`/`index`.
  - Element output unchanged: `<Container as="section"><Grid>` (top row),
    bare `<Grid>` (nested); `<Grid>`/`<Column>` remain `<div>`.

## 6. Builder — `packages/cms/admin/src/`

### `lib/tree-ops.ts`
- **Remove** `RATIO_SLOTS`, `setRowRatio`, and the `ratio` argument of
  `newRowNode`.
- `newColumnNode(span = { base: 12 })` → sets `span`.
- `newRowNode()` → `children: [newColumnNode({ base: 12, md: 6 }),
  newColumnNode({ base: 12, md: 6 })]` (2 columns, 50/50 on desktop, stacked on
  mobile).
- `MAX_COLUMNS = 12`.
- **New op** `setColumnSpan(forest, path, tier: 'base' | 'md' | 'lg', value:
  number | undefined): Forest` — immutable, matching existing op style. `base`
  takes a required 1..12; `md`/`lg` take a value or `undefined` (clear → inherit).

### `components/tree-editor.tsx`
- **Remove** `RATIOS`, the row-ratio `SingleSelect`, and the `setRowRatio` import.
- **`ColumnCard`** gains a "Span" control group: three `SingleSelect`s —
  `base` (1..12, required), `md` and `lg` (1..12 + an "inherit / —" option =
  `undefined`). Each wired to `setColumnSpan`.
- **`RowCard`** gains:
  - a **breakpoint toggle** (Base | md | lg) held in local component state,
    selecting which tier the preview renders.
  - a **read-only preview bar**: a 12-track CSS grid (admin-side inline style)
    rendering each column's *effective* span at the active tier (mobile-first
    cascade lg→md→base) as a labelled filled segment, with trailing empty tracks
    when the tier total < 12 and visual wrap when > 12.
  - a **per-tier total badge** (e.g. `md 10/12`) computed from effective spans.
- **New presentational component** `GridPreview({ columns, tier })` (admin-only,
  in `tree-editor.tsx` or a sibling file) for the bar.

### Descriptors / `lib/form-model.ts`
- **`server/src/components/layout/row.json`**: remove the `ratio` enumeration
  field; update the description.
- **`server/src/components/layout/column.json`**: **no** span field added —
  span is builder-owned structural data (like `id`/`children`), not a
  descriptor-generated form field. This matches how `ratio`'s control was
  bespoke in `tree-editor` rather than generated from the descriptor.
- `form-model.ts`: unaffected by span (the `container` attr generation is
  unchanged); adjust only if it references `ratio`.

## 7. Seeds, generated types, schema

- **`seed-content.mjs`** (CLI template `packages/cli/templates/cms/scripts/` +
  its playground copy `apps/playground/packages/cms/scripts/`): rewrite the
  `row(...)` helper — drop the `ratio` param; columns carry `span`. Update the
  demo-home rows to the new shape. Preserve idempotency/flags.
- **`seed-content.test.ts`** (`packages/cli/src/create/`): update the shape
  assertions.
- **`generated.ts`** (CLI template `packages/cli/templates/project/packages/
  shared/types/` + playground copy): regenerate — the `preset-layout.row`
  interface drops `ratio?`; column span is structural (not in the generated
  component interface). `pnpm dev` regenerates the playground copy; the committed
  template is synced by the generator.
- **`serialize-schema.ts`**: no code change — it reads the live registry;
  removing `ratio` from `row.json` and the already-imported `PRESS_TREE_VERSION`
  (now 2) auto-reflect on `/api/press/schema`.

## 8. Testing

- **shared** `validate-tree.test.ts`: valid span object; missing base → `12` +
  warning; out-of-range `md`/`lg` stripped + warning; a write rejects on those
  warnings; v1 tree → fail-to-empty under the version-2 gate.
- **web** `container-attrs.test.ts`: `spanFor(column)` returns `column.span`
  with base default 12.
- **web** `tree-renderer.test.tsx`: a row with per-column spans emits the right
  `--press-col-span[-md|-lg]` on each `data-press-layout="column"`; nested row
  still emits no `Container`.
- **cms-admin** `tree-ops.test.ts`: `setColumnSpan` (set/clear base·md·lg),
  `newRowNode`/`newColumnNode` defaults, `MAX_COLUMNS = 12` cap.
- **cms-admin** `tree-editor` test: renders base/md/lg selects; the total badge
  computes the effective per-tier sum (uses the design-system vitest config).
- **cms** `serialize-schema.test.ts` + the layout-descriptor tests: `row` no
  longer exposes `ratio`; `column` still enumerated.
- **web** `breakpoints.test.ts`: unchanged — a passing run confirms the CSS
  contract did not drift.

## 9. Migration & compatibility

- `PRESS_TREE_VERSION` 1 → 2. **No data migration** (pre-release, authorized).
  Stored v1 trees (ratio-based) fail validation → fail-to-empty on read; writers
  reject them. The **playground DB must be reseeded** — `pnpm dev` reseeds via
  idempotent flags, but a slot already seeded at v1 (pageDefaults/home) may need
  a manual reseed / DB reset; call this out in the changeset.
- **Changeset**: mark `@ogs-tech/press-shared`, `@ogs-tech/press-web`, and
  `@ogs-tech/press-cms` as **major**; `pnpm version-packages` regenerates the
  CLI's pinned versions.

## 10. Docs

- **CLAUDE.md**: update "Composition trees" and "Layout primitives" — `ratio` is
  gone; `ColumnNode.span` (per-breakpoint, mobile-first) now carries
  responsiveness in the JSON. Revise the "Responsiveness NEVER appears in this
  JSON" statement to: column span is the one responsive value stored in the tree;
  all other layout responsiveness stays code-side (`container` → `Responsive<T>`).
  Note the retired `RATIO_SPANS` / `setRowRatio` / `RATIO_SLOTS`.
- **`tree.ts` header comment**: revised to match.

## 11. Out of scope

- Interactive drag/resize preview (rejected; selects + read-only bar).
- Per-column `start` offset (the `<Column start>` prop exists but stays
  engine-internal; not exposed to editors).
- The `<section>`-per-row semantic-element question (pre-existing behavior;
  separate concern).
- Any change to `theme.css` or the four layout primitives.
