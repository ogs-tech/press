# Free Column Spans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the closed `RowNode.ratio` enum with a free, per-breakpoint `ColumnNode.span` (1–12 tracks, mobile-first), edited in the admin composition builder.

**Architecture:** The composition wire (`@ogs-tech/press-shared`) bumps to `PRESS_TREE_VERSION = 2`: `RowNode.ratio` is removed and each `ColumnNode` gains `span: { base; md?; lg? }`. The web `<Column>` primitive and `theme.css` are untouched — the new shape already matches the `Responsive<Span>` they consume, so `spanFor` becomes a passthrough. The admin builder replaces the ratio `<SingleSelect>` with per-column base/md/lg span selects, a read-only 12-track preview bar, a breakpoint toggle, and a per-tier total badge. No data migration (pre-release, authorized): stored v1 trees fail-to-empty on read.

**Tech Stack:** TypeScript, React 19, Strapi 5 plugin (`@strapi/design-system`), Next.js host, Vitest, pnpm workspaces, changesets.

## Global Constraints

- **Node 20.x / pnpm 10.x**; the whole monorepo is pinned to **React 19** (root `pnpm.overrides`) — never add a second React.
- **`PRESS_TREE_VERSION = 2`** on the wire. Readers reject any other version (fail-to-empty). **No data migration.**
- **`Span` is `number` in `@ogs-tech/press-shared`** (range 1..12 enforced by the validator, not the type); the web primitive's `Span` stays the literal union `1|…|12`. The web mapping casts the validated value.
- **`ColumnSpan` object-only**: `{ base: Span; md?: Span; lg?: Span }`, `base` required. This is the ONE responsive value stored in the JSON — a conscious reversal of "responsiveness never in the JSON."
- **Strict-write / tolerant-read split is preserved**: structural failure → `value: null` + `errors`; attr-level failure (bad span/container) → sanitize + `warnings`; writers reject on errors OR warnings; readers render whenever `value` is non-null.
- **`MAX_COLUMNS` builder cap = 12** (was 4). The wire has **no** upper column cap — only a non-empty requirement.
- **New-node defaults:** new column `{ base: 12 }`; new row = 2 columns each `{ base: 12, md: 6 }` (stacked on mobile, 50/50 on desktop).
- **No eslint** in this repo — the quality gate is `tsc --noEmit` (per package) + Vitest. `web`/`shared` ship TS source; only `cms` compiles (`strapi-plugin build`).
- Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Work stays on the current branch `feat/columns-block`.

---

## File Structure

**`packages/shared/src/`** — the wire contract (source of truth for the change)
- `tree.ts` — MODIFY: version → 2, add `Span`/`ColumnSpan`, add `ColumnNode.span`, remove `Ratio`/`RowNode.ratio`, revise header comment.
- `validate-tree.ts` — MODIFY: version gate → 2, remove ratio validation, add span sanitization, drop the row upper-column cap.
- `validate-tree.test.ts` — MODIFY: fixtures to v2 + spans; new span-validation cases.

**`packages/web/src/`** — renderer (primitives + CSS untouched)
- `tree/container-attrs.ts` — MODIFY: delete `RATIO_SPANS`, rewrite `spanFor(column)`.
- `tree/tree-renderer.tsx` — MODIFY: drop `ratio`/`index` threading.
- `index.ts` — MODIFY: remove the `Ratio` re-export.
- `tree/container-attrs.test.ts`, `tree/tree-renderer.test.tsx`, `tree/resolve-slots.test.ts`, `map-page.test.ts` — MODIFY: fixtures to v2 + spans.

**`packages/cms/admin/src/`** — the builder UI
- `lib/tree-ops.ts` — MODIFY: `MAX_COLUMNS = 12`, remove `RATIO_SLOTS`/`setRowRatio`, add `setColumnSpan`/`effectiveSpan`, new span-aware factories.
- `lib/tree-ops.test.ts` — MODIFY: rewrite ratio-era tests as span/cap tests.
- `components/tree-editor.tsx` — MODIFY: remove ratio select; add `SpanControls`, `GridPreview`, breakpoint toggle, total badge.
- `components/tree-editor.test.tsx` — CREATE: design-system render test for the span controls + badge.
- `components/builder-input.tsx` — MODIFY: `emptyTree` version → `PRESS_TREE_VERSION`.
- `components/builder-input.test.tsx` — MODIFY: schema mock + assertion to version 2.

**`packages/cms/server/src/`** — descriptors + server-side guards
- `components/layout/row.json` — MODIFY: remove the `ratio` field + description.
- `lib/serialize-schema.test.ts`, `lib/inject-components.test.ts`, `lib/validate-write.test.ts`, `lib/hydrate-tree.test.ts`, `lib/serve-hydrated.test.ts` — MODIFY: fixtures/assertions to v2, drop ratio.

**`packages/cli/`** + **`apps/playground/`** — scaffold + dogfood
- `templates/cms/scripts/seed-content.mjs` + `apps/playground/packages/cms/scripts/seed-content.mjs` — MODIFY: `row`/`column` helpers + demo to spans, `version: 2`.
- `src/create/seed-content.test.ts` — MODIFY: shape assertions.
- `templates/project/packages/shared/types/generated.ts` + `apps/playground/packages/shared/types/generated.ts` — MODIFY: drop `ratio?` from `PresetLayoutRow`.

**Docs / release**
- `CLAUDE.md` — MODIFY: "Composition trees" + "Layout primitives" sections.
- `.changeset/free-column-spans.md` — CREATE: major for shared/web/cms.

---

## Task 1: Shared — wire model + validator at version 2

**Files:**
- Modify: `packages/shared/src/tree.ts`
- Modify: `packages/shared/src/validate-tree.ts`
- Test: `packages/shared/src/validate-tree.test.ts`

**Interfaces:**
- Produces: `PRESS_TREE_VERSION = 2`; `type Span = number`; `interface ColumnSpan { base: Span; md?: Span; lg?: Span }`; `ColumnNode` now has `span: ColumnSpan`; `RowNode` no longer has `ratio`; `type Ratio` is **removed**. `validatePressTree`/`validateNodeArray` signatures are unchanged (still `TreeResult<T>`), but a valid `ColumnNode` now always carries a well-formed `span`, and the exported constant `MAX_ROW_COLUMNS` is **removed**.
- Consumes: nothing new.

- [ ] **Step 1: Rewrite the shared test fixtures + add span cases (they must fail first)**

Replace the entire contents of `packages/shared/src/validate-tree.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { validateNodeArray, validatePressTree } from './validate-tree';
import type { PressTree } from './tree';

const block = (component: string, data: Record<string, unknown> = {}) => ({
  id: `id-${component}`,
  type: 'block' as const,
  component,
  data,
});

const validTree = (): PressTree => ({
  version: 2,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'none' },
    container: { gap: 'normal' },
    children: [
      block('preset-organism.hero', { title: 'Hi' }),
      {
        id: 'row-1',
        type: 'row',
        container: { width: 'lg', gap: 'compact', verticalAlign: 'center' },
        children: [
          { id: 'col-1', type: 'column', span: { base: 12, md: 6 }, children: [block('preset-atom.paragraph', { content: 'a' })] },
          {
            id: 'col-2',
            type: 'column',
            span: { base: 12, md: 6 },
            container: { gap: 'spacious', verticalAlign: 'bottom' },
            // the recursion point: a row INSIDE a column (must validate at depth)
            children: [
              {
                id: 'row-2',
                type: 'row',
                children: [
                  { id: 'col-3', type: 'column', span: { base: 12, md: 4 }, children: [block('custom-organism.callout')] },
                  { id: 'col-4', type: 'column', span: { base: 12, md: 8 }, children: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

describe('validatePressTree', () => {
  it('accepts a valid deeply recursive tree and returns a sanitized copy', () => {
    const input = validTree();
    const out = validatePressTree(input);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect(out.value).toEqual(input);
    expect(out.value).not.toBe(input); // deep copy, never the input reference
  });

  it('rejects non-objects and the retired v1 version (fail-to-empty gate)', () => {
    expect(validatePressTree(null).value).toBeNull();
    expect(validatePressTree('[]').value).toBeNull();
    const v1 = { ...validTree(), version: 1 };
    const out = validatePressTree(v1);
    expect(out.value).toBeNull();
    expect(out.errors[0].path).toBe('$.version');
  });

  it('rejects a root that is not a layout node', () => {
    const out = validatePressTree({ version: 2, root: block('preset-atom.paragraph') });
    expect(out.value).toBeNull();
    expect(out.errors[0].path).toBe('$.root');
  });

  it('strips invalid container attr values as warnings, never errors', () => {
    const input = validTree();
    (input.root.children[1] as any).container = { width: 'xl', gap: 'normal', verticalAlign: 'middle' };
    const out = validatePressTree(input);
    expect(out.errors).toEqual([]);
    expect(out.warnings.map((w) => w.path)).toEqual([
      '$.root.children[1].container.width',
      '$.root.children[1].container.verticalAlign',
    ]);
    expect((out.value!.root.children[1] as any).container).toEqual({ gap: 'normal' });
  });

  it('errors on a column outside a row and on unknown node types', () => {
    const stray = validatePressTree({
      version: 2,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'c', type: 'column', span: { base: 12 }, children: [] },
      ] },
    });
    expect(stray.value).toBeNull();
    expect(stray.errors[0].message).toMatch(/only legal directly under a row/);

    const unknown = validatePressTree({
      version: 2,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'x', type: 'mystery' },
      ] },
    });
    expect(unknown.value).toBeNull();
  });

  it('requires a non-empty column list and column-only row children, with NO upper cap on the wire', () => {
    const empty = validTree();
    (empty.root.children[1] as any).children = [];
    expect(validatePressTree(empty).value).toBeNull();

    const notColumn = validTree();
    (notColumn.root.children[1] as any).children = [block('preset-atom.paragraph')];
    expect(validatePressTree(notColumn).value).toBeNull();

    const many = validTree();
    (many.root.children[1] as any).children = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`, type: 'column', span: { base: 2 }, children: [],
    }));
    expect(validatePressTree(many).errors).toEqual([]); // 6 columns is valid — the cap is a builder concern
  });

  it('requires block ids and component uids', () => {
    const noId = validTree();
    delete (noId.root.children[0] as any).id;
    expect(validatePressTree(noId).value).toBeNull();

    const noComponent = validTree();
    delete (noComponent.root.children[0] as any).component;
    expect(validatePressTree(noComponent).value).toBeNull();
  });

  it('coerces an unknown slot mode to none with a warning (render: treat as none)', () => {
    const input = validTree();
    (input.root as any).header = { mode: 'mystery' };
    const out = validatePressTree(input);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w) => w.path === '$.root.header.mode')).toBe(true);
    expect(out.value!.root.header).toEqual({ mode: 'none' });
  });

  it('validates custom slot children recursively', () => {
    const input = validTree();
    (input.root as any).footer = { mode: 'custom', children: [block('preset-organism.footer')] };
    const out = validatePressTree(input);
    expect(out.errors).toEqual([]);
    expect(out.value!.root.footer).toEqual({ mode: 'custom', children: [block('preset-organism.footer')] });
  });
});

describe('span validation (attr-level: sanitize + warn, never nulls the tree)', () => {
  const rowWithSpan = (span: unknown) => ({
    version: 2,
    root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
      { id: 'r', type: 'row', children: [{ id: 'c', type: 'column', span, children: [] }] },
    ] },
  });
  const colSpan = (out: ReturnType<typeof validatePressTree>) =>
    (out.value!.root.children[0] as any).children[0].span;

  it('accepts a well-formed span object with declared tiers', () => {
    const out = validatePressTree(rowWithSpan({ base: 6, md: 4, lg: 3 }));
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect(colSpan(out)).toEqual({ base: 6, md: 4, lg: 3 });
  });

  it('defaults a missing/non-object span to { base: 12 } with a warning', () => {
    const out = validatePressTree(rowWithSpan(undefined));
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w) => w.path.endsWith('.span'))).toBe(true);
    expect(colSpan(out)).toEqual({ base: 12 });
  });

  it('defaults an out-of-range base to 12 and drops out-of-range md/lg (inherit via cascade)', () => {
    const out = validatePressTree(rowWithSpan({ base: 0, md: 99, lg: 3 }));
    expect(out.errors).toEqual([]);
    expect(colSpan(out)).toEqual({ base: 12, lg: 3 });
    expect(out.warnings.some((w) => w.path.endsWith('.span.base'))).toBe(true);
    expect(out.warnings.some((w) => w.path.endsWith('.span.md'))).toBe(true);
  });

  it('treats a non-integer span as invalid (no silent rounding)', () => {
    const out = validatePressTree(rowWithSpan({ base: 6.5 }));
    expect(colSpan(out)).toEqual({ base: 12 });
    expect(out.warnings.some((w) => w.path.endsWith('.span.base'))).toBe(true);
  });
});

describe('validateNodeArray', () => {
  it('accepts a bare Node[] (the pageDefaults slot shape)', () => {
    const nodes = [block('preset-organism.navbar')];
    const out = validateNodeArray(nodes);
    expect(out.errors).toEqual([]);
    expect(out.value).toEqual(nodes);
  });

  it('rejects non-arrays and invalid members', () => {
    expect(validateNodeArray({}).value).toBeNull();
    expect(validateNodeArray([{ id: 'x', type: 'column', span: { base: 12 }, children: [] }]).value).toBeNull();
  });
});
```

- [ ] **Step 2: Run the shared test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-shared test`
Expected: FAIL — the fixtures reference `span` and `version: 2` which the current `tree.ts` type/validator reject (compile errors on `ColumnNode.span` and assertion failures such as "expected null" on the v1-gate test).

- [ ] **Step 3: Update the data model in `tree.ts`**

In `packages/shared/src/tree.ts`, replace the header comment + version constant (lines 1–14) so it reads:

```ts
/**
 * The press composition tree — the JSON stored by the `plugin::press-cms.builder`
 * custom field (page `body`) and, as bare `Node[]` slots, by Site Settings
 * `pageDefaults`. Pure wire types: no Strapi, no React.
 *
 * Column `span` (base/md/lg) is the ONE responsive value this JSON carries — the
 * deliberate exception to "responsiveness lives in code". `container` attrs remain
 * editorial intents the web renderer maps to Responsive<T> values code-side.
 */

/** Readers reject any other version (fail-to-empty); gates future migrations. */
export const PRESS_TREE_VERSION = 2;

/** 1..12 track span. Kept `number` on the wire (not a 12-arm literal union);
 *  the range is enforced by the validator, not the type. */
export type Span = number;

/** Mobile-first responsive span: `base` is the required mobile default; `md`/`lg`
 *  are optional overrides that cascade up (md inherits base, lg inherits md). */
export interface ColumnSpan {
  base: Span;
  md?: Span;
  lg?: Span;
}

export type Gap = 'compact' | 'normal' | 'spacious';
```

(Note: the old `export type Ratio = …` line is deleted; the three following `export type` lines for `Gap`/`VerticalAlign`/`ContainerWidth` are unchanged — the block above only replaces the `Ratio` line with the new `Span`/`ColumnSpan` declarations and keeps `Gap`. Leave `VerticalAlign` and `ContainerWidth` exactly as they are below it.)

Then replace the `ColumnNode` and `RowNode` interfaces:

```ts
/** The recursion point: a column nests arbitrary nodes, including further rows. */
export interface ColumnNode {
  id: string;
  type: 'column';
  /** Per-breakpoint width in 12-track units — the one responsive value on the wire. */
  span: ColumnSpan;
  container?: ContainerAttrs;
  children: Node[];
}

export interface RowNode {
  id: string;
  type: 'row';
  container?: ContainerAttrs;
  /** 1..N columns; each column owns its own span (no shared row-level ratio). */
  children: ColumnNode[];
}
```

- [ ] **Step 4: Update the validator in `validate-tree.ts`**

In `packages/shared/src/validate-tree.ts`:

Change the type import (line 13) to add `ColumnSpan`:

```ts
import type { ColumnNode, ColumnSpan, ContainerAttrs, LayoutNode, Node, PressTree, RowNode, Slot } from './tree';
```

Delete the `MAX_ROW_COLUMNS` export (line 27) and the `RATIOS` constant (line 29). The remaining `WIDTHS`/`GAPS`/`VERTICAL_ALIGNS` lines stay.

Add a `sanitizeSpan` helper immediately after `sanitizeContainer` (after line 71):

```ts
const isSpanValue = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 12;

/** Attr-level: a malformed span never nulls the tree — it defaults + warns. */
function sanitizeSpan(input: unknown, path: string, ctx: Ctx): ColumnSpan {
  if (!isRecord(input)) {
    warn(ctx, path, 'span must be an object { base; md?; lg? } — defaulted to { base: 12 }');
    return { base: 12 };
  }
  let base: number;
  if (isSpanValue(input.base)) {
    base = input.base;
  } else {
    warn(ctx, `${path}.base`, `base span must be an integer 1..12 — defaulted to 12`);
    base = 12;
  }
  const out: ColumnSpan = { base };
  for (const tier of ['md', 'lg'] as const) {
    const v = input[tier];
    if (v === undefined) continue;
    if (isSpanValue(v)) out[tier] = v;
    else warn(ctx, `${path}.${tier}`, `${tier} span must be an integer 1..12 — tier dropped (inherits)`);
  }
  return out;
}
```

Update `validateColumn` (lines 80–92) to build the span:

```ts
function validateColumn(input: unknown, path: string, ctx: Ctx): ColumnNode | null {
  if (!isRecord(input) || input.type !== 'column') {
    return fail(ctx, path, `row children must be column nodes, got ${JSON.stringify(isRecord(input) ? input.type : input)}`);
  }
  const id = requireId(input, path, ctx);
  if (id === null) return null;
  const children = validateChildren(input.children, `${path}.children`, ctx);
  if (children === null) return null;
  const node: ColumnNode = { id, type: 'column', span: sanitizeSpan(input.span, `${path}.span`, ctx), children };
  const container = sanitizeContainer(input.container, `${path}.container`, ctx);
  if (container) node.container = container;
  return node;
}
```

Replace the `case 'row':` block (lines 124–145) with the ratio-free, cap-free version:

```ts
    case 'row': {
      const id = requireId(input, path, ctx);
      if (id === null) return null;
      if (!Array.isArray(input.children)) {
        return fail(ctx, `${path}.children`, 'row children must be an array of columns');
      }
      if (input.children.length < 1) {
        return fail(ctx, `${path}.children`, 'a row carries at least one column');
      }
      const columns: ColumnNode[] = [];
      input.children.forEach((c, i) => {
        const col = validateColumn(c, `${path}.children[${i}]`, ctx);
        if (col) columns.push(col);
      });
      const node: RowNode = { id, type: 'row', children: columns };
      const container = sanitizeContainer(input.container, `${path}.container`, ctx);
      if (container) node.container = container;
      return node;
    }
```

(The version-gate in `validatePressTree` needs no edit — it compares against the imported `PRESS_TREE_VERSION`, now `2`.)

- [ ] **Step 5: Run the shared test + typecheck to verify they pass**

Run: `pnpm --filter @ogs-tech/press-shared test && pnpm --filter @ogs-tech/press-shared typecheck`
Expected: PASS — all `validatePressTree`/`validateNodeArray`/span-validation cases green; `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/tree.ts packages/shared/src/validate-tree.ts packages/shared/src/validate-tree.test.ts
git commit -m "feat(shared)!: column spans replace row ratio; PRESS_TREE_VERSION 2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Web — renderer passthrough + downstream fixtures

**Files:**
- Modify: `packages/web/src/tree/container-attrs.ts`
- Modify: `packages/web/src/tree/tree-renderer.tsx`
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/tree/container-attrs.test.ts`
- Test: `packages/web/src/tree/tree-renderer.test.tsx`
- Test: `packages/web/src/tree/resolve-slots.test.ts`
- Test: `packages/web/src/map-page.test.ts`

**Interfaces:**
- Consumes (from Task 1): `ColumnNode.span: ColumnSpan`, no `RowNode.ratio`, no `Ratio` type, `PRESS_TREE_VERSION = 2`.
- Produces: `spanFor(column: ColumnNode): Responsive<Span>` (was `spanFor(ratio, index)`); `RATIO_SPANS` is **removed**; `web/src/index.ts` no longer re-exports `Ratio`.

- [ ] **Step 1: Rewrite `container-attrs.test.ts` (fails first)**

Replace `packages/web/src/tree/container-attrs.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import type { ColumnNode } from '@ogs-tech/press-shared';
import { cellAlign, rowAlign, rowGap, rowWidth, spanFor, stackGap } from './container-attrs';

const col = (span: ColumnNode['span']): ColumnNode => ({ id: 'c', type: 'column', span, children: [] });

describe('spanFor', () => {
  it('returns the column span unchanged (base plus any declared tiers)', () => {
    expect(spanFor(col({ base: 12 }))).toEqual({ base: 12 });
    expect(spanFor(col({ base: 12, md: 6 }))).toEqual({ base: 12, md: 6 });
    expect(spanFor(col({ base: 12, md: 6, lg: 3 }))).toEqual({ base: 12, md: 6, lg: 3 });
  });
});

describe('container pickers (absent attr → engine default)', () => {
  it('maps gap tiers with the 11-gap-floor rule (spacious is tier-scaled)', () => {
    expect(rowGap()).toBe('md');
    expect(rowGap({ gap: 'compact' })).toBe('sm');
    expect(rowGap({ gap: 'spacious' })).toEqual({ base: 'md', lg: 'lg' });
  });

  it('maps alignment and width', () => {
    expect(rowAlign()).toBe('start');
    expect(rowAlign({ verticalAlign: 'bottom' })).toBe('end');
    expect(rowWidth()).toBe('lg');
    expect(rowWidth({ width: 'full' })).toBe('full');
  });

  it('stack gap is a CSS var only when declared; cell align skips top', () => {
    expect(stackGap()).toBeUndefined();
    expect(stackGap({ gap: 'spacious' })).toBe('var(--press-space-7)');
    expect(cellAlign()).toBeUndefined();
    expect(cellAlign({ verticalAlign: 'top' })).toBeUndefined();
    expect(cellAlign({ verticalAlign: 'center' })).toBe('center');
    expect(cellAlign({ verticalAlign: 'bottom' })).toBe('end');
  });
});
```

- [ ] **Step 2: Run the web test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-web test src/tree/container-attrs.test.ts`
Expected: FAIL — `spanFor(col(...))` is called with a `ColumnNode` but the current `spanFor(ratio, index)` and `RATIO_SPANS` reject it (compile error on the removed `RATIO_SPANS` import is gone from the test, but `spanFor`'s signature mismatch fails).

- [ ] **Step 3: Rewrite `spanFor` in `container-attrs.ts`**

In `packages/web/src/tree/container-attrs.ts`, replace the header comment + imports (lines 1–13) and the `RATIO_SPANS`/`spanFor` block (lines 15–32) with:

```ts
/**
 * Curated container attrs → layout-primitive props. Editorial intent meets the
 * responsive system here: `container` attrs map to Responsive<T> props, and a
 * column's stored `span` (the ONE responsive value on the wire) passes straight
 * through to the <Column> primitive. Every picker treats an ABSENT attr as the
 * engine default.
 */
import type { ColumnNode, ContainerAttrs, Gap } from '@ogs-tech/press-shared';
import type { Responsive } from '../layout/breakpoints';
import type { Span } from '../layout/column';
import type { ContainerMaxWidth } from '../layout/container';
import type { GridAlignItems, GridGap } from '../layout/grid';

/** A column's stored span → the Responsive<Span> the <Column> primitive consumes.
 *  `base` is guaranteed by the validator; md/lg cascade up via the CSS var() chain.
 *  Cast is safe: the validator has already constrained every tier to 1..12. */
export function spanFor(column: ColumnNode): Responsive<Span> {
  return column.span as Responsive<Span>;
}
```

Leave everything from `const GAP_TIERS` onward (line 34) unchanged.

- [ ] **Step 4: Update `tree-renderer.tsx`**

In `packages/web/src/tree/tree-renderer.tsx`:

Change the shared import (line 10) to drop `Ratio`:

```ts
import type { ColumnNode, Node, RowNode } from '@ogs-tech/press-shared';
```

Replace `ColumnView` (lines 43–54) with:

```tsx
function ColumnView({ column, registry }: { column: ColumnNode; registry: Registry }) {
  const gap = stackGap(column.container);
  const align = cellAlign(column.container);
  const style = gap ? ({ ['--press-cell-gap' as string]: gap } as CSSProperties) : undefined;
  return (
    <Column span={spanFor(column)}>
      <div data-press-cell="" data-cell-align={align} style={style}>
        <NodeList nodes={column.children} registry={registry} top={false} />
      </div>
    </Column>
  );
}
```

In `RowView` (lines 56–71), replace the `.map` call so it no longer threads `ratio`/`index`:

```tsx
      {row.children.map((column) => (
        <ColumnView key={column.id} column={column} registry={registry} />
      ))}
```

- [ ] **Step 5: Remove the `Ratio` re-export from `index.ts`**

In `packages/web/src/index.ts`, delete the `Ratio,` line from the `export type { … } from '@ogs-tech/press-shared';` block (it sits between `ContainerAttrs,` and `Gap,`).

- [ ] **Step 6: Update the remaining web fixtures**

In `packages/web/src/tree/tree-renderer.test.tsx`:

Change the `tree` helper (line 15) `version: 1` → `version: 2`.

Replace the row fixture in the "renders a top-level row as Container>Grid>Column …" test (the object passed to `tree([...])`, lines 34–45) with the ratio-free, spanned version, and extend the assertions:

```tsx
    const body = tree([{
      id: 'r1', type: 'row', container: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      children: [
        { id: 'c1', type: 'column', span: { base: 12, md: 4 }, children: [paragraph('p2', 'left')] },
        { id: 'c2', type: 'column', span: { base: 12, md: 8 }, container: { verticalAlign: 'bottom', gap: 'spacious' }, children: [{
          id: 'r2', type: 'row', children: [
            { id: 'c3', type: 'column', span: { base: 12, md: 6 }, children: [paragraph('p3', 'deep')] },
            { id: 'c4', type: 'column', span: { base: 12, md: 6 }, children: [] },
          ],
        }] },
      ],
    }]);
    const html = renderToStaticMarkup(createElement(TreeRenderer, { body, site: site() }));
    expect(html).toContain('data-max-width="full"');                       // width applied top-level
    expect((html.match(/data-press-layout="grid"/g) ?? []).length).toBe(2); // outer + nested grid
    expect((html.match(/data-press-layout="container"/g) ?? []).length).toBe(1); // nested row gets NO Container
    expect(html).toContain('data-align-items="center"');
    expect(html).toContain('data-cell-align="end"');
    expect(html).toContain('--press-cell-gap:var(--press-space-7)');
    expect(html).toContain('--press-col-span-md:4');   // first column's md span
    expect(html).toContain('--press-col-span-md:8');   // second column's md span
    expect(html).toContain('deep');
```

In `packages/web/src/tree/resolve-slots.test.ts`:
- Change the `tree` helper (line 27) `version: 1` → `version: 2`.
- In the `nested` fixture (the row inside "hydrates navbar brand/links/cta … at any depth"), remove `ratio: '50-50'` and add `span: { base: 12 }` to each of the two columns, e.g. `{ id: 'c', type: 'column', span: { base: 12 }, children: [navbarNode()] }` and `{ id: 'c2', type: 'column', span: { base: 12 }, children: [] }`.
- Search the rest of the file for any other `ratio:` on a row or column literal typed as `Node`/`PressTree` and apply the same edit (drop `ratio`, add `span: { base: 12 }` to columns).

In `packages/web/src/map-page.test.ts`:
- Change the `body` fixture (line 10) `version: 1` → `version: 2`.

- [ ] **Step 7: Run the full web suite + typecheck**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — renderer emits `--press-col-span-md:4`/`:8`; nested row still emits exactly one Container; `tsc --noEmit` clean (no `Ratio`, no `version: 1` literal errors).

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/tree/container-attrs.ts packages/web/src/tree/tree-renderer.tsx packages/web/src/index.ts \
  packages/web/src/tree/container-attrs.test.ts packages/web/src/tree/tree-renderer.test.tsx \
  packages/web/src/tree/resolve-slots.test.ts packages/web/src/map-page.test.ts
git commit -m "feat(web)!: render column.span; drop RATIO_SPANS and the Ratio re-export

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: CMS admin — tree-ops (span factories + ops)

**Files:**
- Modify: `packages/cms/admin/src/lib/tree-ops.ts`
- Test: `packages/cms/admin/src/lib/tree-ops.test.ts`

**Interfaces:**
- Consumes (from Task 1): `ColumnNode.span`, `ColumnSpan`, no `Ratio`.
- Produces:
  - `MAX_COLUMNS = 12`
  - `newColumnNode(span?: ColumnSpan): ColumnNode` (default `{ base: 12 }`)
  - `newRowNode(): RowNode` — 2 columns each `{ base: 12, md: 6 }` (no ratio argument)
  - `setColumnSpan(forest, path, tier: 'base' | 'md' | 'lg', value: number | undefined): Forest`
  - `effectiveSpan(span: ColumnSpan, tier: 'base' | 'md' | 'lg'): number` — resolves the lg→md→base cascade
  - `RATIO_SLOTS` and `setRowRatio` are **removed**

- [ ] **Step 1: Rewrite `tree-ops.test.ts` (fails first)**

Replace `packages/cms/admin/src/lib/tree-ops.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  addColumn, effectiveSpan, getNode, insertNode, MAX_COLUMNS, moveNode, newBlockNode, newColumnNode,
  newRowNode, removeNode, setBlockData, setColumnSpan, setContainerAttr, type Forest,
} from './tree-ops';

const forest = (): Forest => {
  const row = newRowNode();
  return [newBlockNode('preset-organism.hero'), row];
};

describe('node factories', () => {
  it('mints unique string ids and 2-column rows with the mobile-first defaults', () => {
    const a = newBlockNode('preset-atom.paragraph');
    const b = newBlockNode('preset-atom.paragraph');
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ type: 'block', component: 'preset-atom.paragraph', data: {} });
    expect(newColumnNode().span).toEqual({ base: 12 });
    expect(newColumnNode({ base: 12, md: 6 }).span).toEqual({ base: 12, md: 6 });
    const row = newRowNode();
    expect(row.children).toHaveLength(2);
    expect(row.children.every((c) => c.type === 'column')).toBe(true);
    expect(row.children.every((c) => c.span.base === 12 && c.span.md === 6)).toBe(true);
  });
});

describe('insertNode invariants (by construction)', () => {
  it('inserts blocks and rows at the root and inside columns', () => {
    const f = forest();
    const out = insertNode(f, null, 0, newBlockNode('preset-atom.spacer'));
    expect(out).toHaveLength(3);
    expect((out[0] as any).component).toBe('preset-atom.spacer');
    expect(f).toHaveLength(2); // immutable

    const intoColumn = insertNode(out, [2, 0], 0, newRowNode()); // row INSIDE a column: the recursion point
    expect((getNode(intoColumn, [2, 0, 0]) as any).type).toBe('row');
  });

  it('refuses a column outside a row and a non-column inside a row', () => {
    const f = forest();
    expect(() => insertNode(f, null, 0, newColumnNode())).toThrow(/column/i);
    expect(() => insertNode(f, [1], 0, newBlockNode('preset-atom.spacer'))).toThrow(/row/i);
  });

  it('caps a row at 12 columns (MAX_COLUMNS)', () => {
    let f: Forest = [newRowNode()]; // starts with 2 columns
    while ((f[0] as any).children.length < MAX_COLUMNS) f = addColumn(f, [0]);
    expect((f[0] as any).children).toHaveLength(12);
    expect(() => addColumn(f, [0])).toThrow(/12/);
  });
});

describe('remove / move / update', () => {
  it('removes at depth and moves within siblings (clamped)', () => {
    const f = forest();
    expect(removeNode(f, [0])).toHaveLength(1);
    const moved = moveNode(f, [1], -1);
    expect((moved[0] as any).type).toBe('row');
    expect(moveNode(moved, [0], -1)).toEqual(moved); // clamped at the edge
  });

  it('sets block data and container attrs immutably', () => {
    const f = forest();
    const withData = setBlockData(f, [0], { title: 'Hi' });
    expect((withData[0] as any).data).toEqual({ title: 'Hi' });
    expect((f[0] as any).data).toEqual({});

    const withAttr = setContainerAttr(f, [1], 'gap', 'compact');
    expect((withAttr[1] as any).container).toEqual({ gap: 'compact' });
    const cleared = setContainerAttr(withAttr, [1], 'gap', undefined);
    expect((cleared[1] as any).container).toBeUndefined();
  });
});

describe('span ops', () => {
  it('setColumnSpan sets base and sets/clears md·lg (clear = inherit)', () => {
    let f: Forest = [newRowNode()]; // row with 2 columns
    f = setColumnSpan(f, [0, 0], 'base', 6);
    expect((f[0] as any).children[0].span.base).toBe(6);
    f = setColumnSpan(f, [0, 0], 'lg', 3);
    expect((f[0] as any).children[0].span.lg).toBe(3);
    f = setColumnSpan(f, [0, 0], 'md', undefined); // clear md → inherit
    expect((f[0] as any).children[0].span).toEqual({ base: 6, lg: 3 });
  });

  it('setColumnSpan targets only column nodes', () => {
    const f = forest();
    expect(() => setColumnSpan(f, [0], 'base', 6)).toThrow(/column/i); // [0] is a block
  });

  it('effectiveSpan resolves the lg→md→base cascade', () => {
    expect(effectiveSpan({ base: 12 }, 'md')).toBe(12);
    expect(effectiveSpan({ base: 12, md: 6 }, 'lg')).toBe(6);
    expect(effectiveSpan({ base: 12, md: 6, lg: 3 }, 'lg')).toBe(3);
    expect(effectiveSpan({ base: 8 }, 'base')).toBe(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/tree-ops.test.ts`
Expected: FAIL — `setColumnSpan`/`effectiveSpan` don't exist; `newRowNode()` still requires a `ratio` argument; `MAX_COLUMNS` is 4.

- [ ] **Step 3: Update `tree-ops.ts`**

In `packages/cms/admin/src/lib/tree-ops.ts`:

Change the shared import (line 8) to drop `Ratio` and add `ColumnSpan`:

```ts
import type { BlockNode, ColumnNode, ColumnSpan, Node, RowNode } from '@ogs-tech/press-shared';
```

Replace the `RATIO_SLOTS`/`MAX_COLUMNS`/factory block (lines 13–34) with:

```ts
export const MAX_COLUMNS = 12;

const uuid = (): string => globalThis.crypto.randomUUID();

export const newBlockNode = (component: string): BlockNode => ({ id: uuid(), type: 'block', component, data: {} });

export const newColumnNode = (span: ColumnSpan = { base: 12 }): ColumnNode => ({
  id: uuid(), type: 'column', span, children: [],
});

/** A fresh row: 2 columns, stacked on mobile (base 12) and 50/50 on desktop (md 6). */
export const newRowNode = (): RowNode => ({
  id: uuid(),
  type: 'row',
  children: [newColumnNode({ base: 12, md: 6 }), newColumnNode({ base: 12, md: 6 })],
});

/** The span actually applied at a tier, resolving the mobile-first cascade (lg→md→base). */
export function effectiveSpan(span: ColumnSpan, tier: 'base' | 'md' | 'lg'): number {
  if (tier === 'lg') return span.lg ?? span.md ?? span.base;
  if (tier === 'md') return span.md ?? span.base;
  return span.base;
}
```

Replace the `setRowRatio` function (lines 151–158) with `setColumnSpan`:

```ts
export function setColumnSpan(
  forest: Forest,
  path: NodePath,
  tier: 'base' | 'md' | 'lg',
  value: number | undefined,
): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type !== 'column') throw new Error('[press-cms] setColumnSpan targets column nodes');
    const span: ColumnSpan = { ...node.span };
    if (tier === 'base') {
      span.base = value ?? 12; // base can never be cleared
    } else if (value === undefined) {
      delete span[tier];
    } else {
      span[tier] = value;
    }
    return { ...node, span };
  });
}
```

(`addColumn` at the bottom already calls `newColumnNode()` with no argument — the new default `{ base: 12 }` applies with no edit.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/tree-ops.test.ts`
Expected: PASS — all node-factory, insert-invariant, span-op, and 12-column-cap tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/cms/admin/src/lib/tree-ops.ts packages/cms/admin/src/lib/tree-ops.test.ts
git commit -m "feat(cms)!: tree-ops setColumnSpan/effectiveSpan; MAX_COLUMNS 12; drop ratio ops

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: CMS admin — builder UI (span controls, preview bar, badge)

**Files:**
- Modify: `packages/cms/admin/src/components/tree-editor.tsx`
- Modify: `packages/cms/admin/src/components/builder-input.tsx`
- Test: `packages/cms/admin/src/components/tree-editor.test.tsx` (create)
- Test: `packages/cms/admin/src/components/builder-input.test.tsx`

**Interfaces:**
- Consumes (from Task 3): `MAX_COLUMNS = 12`, `newRowNode()`, `newColumnNode`, `setColumnSpan`, `effectiveSpan`.
- Consumes (from Task 1): `ColumnNode.span`, `PRESS_TREE_VERSION`.
- Produces: builder emits `ColumnNode` with per-tier spans; new presentational `GridPreview`, `SpanControls` (module-scoped in `tree-editor.tsx`); a per-row breakpoint toggle (`data-press-tier`) and total badge (`data-press-span-total`).

- [ ] **Step 1: Write the design-system render test (fails first)**

Create `packages/cms/admin/src/components/tree-editor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DesignSystemProvider } from '@strapi/design-system';
import type { PressSchema } from '@ogs-tech/press-shared';
import { TreeEditor } from './tree-editor';
import { newBlockNode, newRowNode, type Forest } from '../lib/tree-ops';

const SCHEMA = { tree: { version: 2 }, contentTypes: {}, components: {} } as unknown as PressSchema;
const MediaField = () => null;

let container: HTMLDivElement;
let root: Root;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const stubBrowserApis = (): void => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    })) as any;
  }
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
};

const render = (ui: ReactElement) => root.render(<DesignSystemProvider>{ui}</DesignSystemProvider>);

beforeEach(() => {
  stubBrowserApis();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const buttonByText = (scope: ParentNode, text: string): HTMLButtonElement => {
  const btn = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!btn) throw new Error(`button "${text}" not found`);
  return btn as HTMLButtonElement;
};

describe('TreeEditor span controls', () => {
  // hero + a 2-column row → collapsibleIds.length === 2 → the "Expand all" button appears.
  const forest = (): Forest => [newBlockNode('preset-organism.hero'), newRowNode()];

  it('renders per-column span selects, a tier toggle, and a per-tier total badge', async () => {
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={SCHEMA} onChange={() => {}} MediaField={MediaField} />);
    });
    // open the row (and the hero) so the row body renders its span UI
    await act(async () => { buttonByText(container, 'Expand all').click(); });

    // three tier-toggle buttons on the row
    expect(container.querySelectorAll('[data-press-tier]')).toHaveLength(3);
    // each column card exposes a span control group
    expect(container.querySelectorAll('[data-press-span]').length).toBeGreaterThanOrEqual(2);

    // default tier is base: two columns at base 12 → 24/12 total
    const badge = () => container.querySelector('[data-press-span-total]')!.textContent ?? '';
    expect(badge()).toContain('24/12');

    // switch the toggle to md: two columns at md 6 → 12/12
    await act(async () => { (container.querySelector('[data-press-tier="md"]') as HTMLButtonElement).click(); });
    expect(badge()).toContain('12/12');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @ogs-tech/press-cms test src/components/tree-editor.test.tsx`
Expected: FAIL — `newRowNode()` type/signature already updated by Task 3, but there are no `[data-press-tier]` / `[data-press-span]` / `[data-press-span-total]` elements yet (the RowCard still renders a ratio select).

- [ ] **Step 3: Update the imports + constants in `tree-editor.tsx`**

In `packages/cms/admin/src/components/tree-editor.tsx`:

Change the shared import (lines 20–22) to drop `Ratio`:

```ts
import type {
  BlockNode, ColumnNode, PressSchema, RowNode,
} from '@ogs-tech/press-shared';
```

Change the tree-ops import (lines 28–30) to drop `setRowRatio` and add `effectiveSpan`, `setColumnSpan`:

```ts
import {
  addColumn, effectiveSpan, insertNode, MAX_COLUMNS, moveNode, newBlockNode, newRowNode,
  removeNode, setBlockData, setColumnSpan, setContainerAttr, type Forest, type NodePath,
} from '../lib/tree-ops';
```

Replace the `const RATIOS` line (line 33) with the span-control constants:

```ts
const SPAN_VALUES = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const TIERS = ['base', 'md', 'lg'] as const;
type Tier = (typeof TIERS)[number];
```

- [ ] **Step 4: Add `SpanControls` and `GridPreview` (module-scoped)**

In `tree-editor.tsx`, add these two components immediately **before** `function ColumnCard` (before line 237):

```tsx
/** Per-column base/md/lg span selects — base required 1..12, md/lg clearable (inherit). */
function SpanControls({ column, columnPath, ctx }: { column: ColumnNode; columnPath: NodePath; ctx: TreeCtx }) {
  const set = (tier: Tier, value: number | undefined): void =>
    ctx.onChange(setColumnSpan(ctx.forest, columnPath, tier, value));
  return (
    <Flex gap={2} alignItems="flex-end" wrap="wrap" data-press-span="">
      <Field.Root name="span-base">
        <Field.Label>Base</Field.Label>
        <SingleSelect size="S" disabled={ctx.disabled} value={String(column.span.base)}
          onChange={(v) => set('base', Number(v))}>
          {SPAN_VALUES.map((n) => <SingleSelectOption key={n} value={String(n)}>{n}</SingleSelectOption>)}
        </SingleSelect>
      </Field.Root>
      <Field.Root name="span-md">
        <Field.Label>md</Field.Label>
        <SingleSelect size="S" placeholder="inherit" disabled={ctx.disabled}
          value={column.span.md !== undefined ? String(column.span.md) : undefined}
          onClear={() => set('md', undefined)} clearLabel="Inherit from base"
          onChange={(v) => set('md', v ? Number(v) : undefined)}>
          {SPAN_VALUES.map((n) => <SingleSelectOption key={n} value={String(n)}>{n}</SingleSelectOption>)}
        </SingleSelect>
      </Field.Root>
      <Field.Root name="span-lg">
        <Field.Label>lg</Field.Label>
        <SingleSelect size="S" placeholder="inherit" disabled={ctx.disabled}
          value={column.span.lg !== undefined ? String(column.span.lg) : undefined}
          onClear={() => set('lg', undefined)} clearLabel="Inherit from md"
          onChange={(v) => set('lg', v ? Number(v) : undefined)}>
          {SPAN_VALUES.map((n) => <SingleSelectOption key={n} value={String(n)}>{n}</SingleSelectOption>)}
        </SingleSelect>
      </Field.Root>
    </Flex>
  );
}

/** Read-only 12-track bar of each column's EFFECTIVE span at the active tier. */
function GridPreview({ columns, tier }: { columns: ColumnNode[]; tier: Tier }) {
  const spans = columns.map((c) => effectiveSpan(c.span, tier));
  const total = spans.reduce((a, b) => a + b, 0);
  const trailing = total < 12 ? 12 - total : 0; // fill; overflow (>12) wraps naturally
  return (
    <div data-press-grid-preview="" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2px' }}>
      {spans.map((n, i) => (
        <div key={i} style={{
          gridColumn: `span ${Math.max(1, Math.min(n, 12))}`,
          background: '#4945ff', color: '#fff', fontSize: '11px', lineHeight: '18px',
          textAlign: 'center', borderRadius: '2px',
        }}>{n}</div>
      ))}
      {trailing > 0 ? <div style={{ gridColumn: `span ${trailing}`, background: '#dcdce4', borderRadius: '2px' }} /> : null}
    </div>
  );
}
```

- [ ] **Step 5: Add `SpanControls` into `ColumnCard`**

In `ColumnCard` (lines 237–257), insert a span-control block between the header `Flex` and the existing `ContainerSection` `Box`. The body becomes:

```tsx
function ColumnCard({ column, columnPath, index, ctx }: { column: ColumnNode; columnPath: NodePath; index: number; ctx: TreeCtx }) {
  return (
    <Box data-press-node="column" hasRadius background="neutral0" borderColor="neutral200" borderStyle="solid" borderWidth="1px" padding={2}>
      <Flex justifyContent="space-between" alignItems="center">
        <Flex gap={2} alignItems="center">
          <COLUMN_ICON />
          <Typography variant="pi" fontWeight="bold" textColor="neutral700">Column {index + 1}</Typography>
        </Flex>
        <IconButton label={`Remove column ${index + 1}`} variant="ghost" size="S" disabled={ctx.disabled}
          onClick={() => ctx.onChange(removeNode(ctx.forest, columnPath))}><Trash /></IconButton>
      </Flex>
      <Box marginTop={2}>
        <SpanControls column={column} columnPath={columnPath} ctx={ctx} />
      </Box>
      <Box marginTop={2}>
        <ContainerSection nodeType="column" topLevel={false} container={column.container as Record<string, unknown> | undefined}
          disabled={ctx.disabled} onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, columnPath, k, v))} />
      </Box>
      <Box marginTop={2}>
        <TreeForest nodes={column.children} parentPath={columnPath} topLevel={false} ctx={ctx} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 6: Rewrite `RowCard` — remove the ratio select, add the tier toggle + badge + preview**

Replace `RowCard` (lines 259–310) with:

```tsx
function RowCard({ node, path, topLevel, ctx }: { node: RowNode; path: NodePath; topLevel: boolean; ctx: TreeCtx }) {
  const open = ctx.openIds.has(node.id);
  const [tier, setTier] = useState<Tier>('base');
  const columnCount = node.children.length;
  const total = node.children.reduce((sum, c) => sum + effectiveSpan(c.span, tier), 0);
  return (
    <Box data-press-node="row" hasRadius background="primary100" borderColor="primary200" borderStyle="solid" borderWidth="1px" padding={2}>
      <Flex justifyContent="space-between" alignItems="center" gap={2} wrap="wrap">
        <Flex gap={2} alignItems="center" minWidth={0}>
          <IconButton label={open ? 'Collapse row' : 'Expand row'} variant="ghost" size="S" onClick={() => ctx.toggleOpen(node.id)}>
            {open ? <ChevronDown /> : <ChevronRight />}
          </IconButton>
          <ROW_ICON />
          <Typography fontWeight="bold" textColor="primary600">Row</Typography>
          {!open ? (
            <Typography variant="pi" textColor="neutral600">· {columnCount} column{columnCount === 1 ? '' : 's'}</Typography>
          ) : null}
        </Flex>
        <NodeControls
          label="row"
          disabled={ctx.disabled}
          onUp={() => ctx.onChange(moveNode(ctx.forest, path, -1))}
          onDown={() => ctx.onChange(moveNode(ctx.forest, path, 1))}
          onRemove={() => ctx.onChange(removeNode(ctx.forest, path))}
        />
      </Flex>
      {open ? (
        <>
          <Box marginTop={2}>
            <ContainerSection nodeType="row" topLevel={topLevel} container={node.container as Record<string, unknown> | undefined}
              disabled={ctx.disabled} onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, path, k, v))} />
          </Box>
          <Box marginTop={2} data-press-preview="">
            <Flex justifyContent="space-between" alignItems="center" marginBottom={2}>
              <Flex gap={1} tag="span" data-press-tier-toggle="">
                {TIERS.map((t) => (
                  <Button key={t} size="S" variant={t === tier ? 'secondary' : 'tertiary'} disabled={ctx.disabled}
                    aria-pressed={t === tier} data-press-tier={t} onClick={() => setTier(t)}>
                    {t === 'base' ? 'Base' : t}
                  </Button>
                ))}
              </Flex>
              <Typography variant="pi" fontWeight="bold" data-press-span-total=""
                textColor={total > 12 ? 'danger600' : 'neutral600'}>
                {tier} {total}/12
              </Typography>
            </Flex>
            <GridPreview columns={node.children} tier={tier} />
          </Box>
          <Flex direction="column" alignItems="stretch" gap={2} marginTop={2} data-press-columns="">
            {node.children.map((column, ci) => (
              <ColumnCard key={column.id} column={column} columnPath={[...path, ci]} index={ci} ctx={ctx} />
            ))}
            {columnCount < MAX_COLUMNS ? (
              <Box>
                <Button variant="tertiary" size="S" startIcon={<Plus />} disabled={ctx.disabled}
                  onClick={() => ctx.onChange(addColumn(ctx.forest, path))}>Add column</Button>
              </Box>
            ) : null}
          </Flex>
        </>
      ) : null}
    </Box>
  );
}
```

- [ ] **Step 7: Fix `newRowNode('50-50')` in `AddMenu`**

In `AddMenu.add` (line 150), change the row branch to call `newRowNode()` with no argument:

```tsx
    const node = kind === 'row' ? newRowNode() : newBlockNode(kind);
```

- [ ] **Step 8: Update `builder-input.tsx` to stamp version 2**

In `packages/cms/admin/src/components/builder-input.tsx`:

Add `PRESS_TREE_VERSION` to the shared import (line 15) — it currently imports types only, so add a value import line beneath it:

```ts
import type { Node, PressSchema, PressTree, Slot } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
```

Change `emptyTree` (lines 38–41) so the version is single-sourced:

```ts
const emptyTree = (): PressTree => ({
  version: PRESS_TREE_VERSION,
  root: { type: 'layout', header: { mode: 'inherit' }, footer: { mode: 'inherit' }, children: [] },
});
```

- [ ] **Step 9: Update `builder-input.test.tsx` to version 2**

In `packages/cms/admin/src/components/builder-input.test.tsx`:
- Change the `SCHEMA` mock (line 15) `tree: { version: 1 }` → `tree: { version: 2 }`.
- Change the assertion (line 87) `expect(emitted.value.version).toBe(1);` → `expect(emitted.value.version).toBe(2);`.

- [ ] **Step 10: Run the admin component tests + build (admin tsc)**

Run: `pnpm --filter @ogs-tech/press-cms test src/components/tree-editor.test.tsx src/components/builder-input.test.tsx && pnpm --filter @ogs-tech/press-cms build`
Expected: PASS — the render test finds the three tier buttons, the span groups, and the badge flipping `24/12` → `12/12`; `builder-input` emits `version: 2`; `strapi-plugin build` type-checks the admin bundle clean (no `Ratio`, no `setRowRatio`).

- [ ] **Step 11: Commit**

```bash
git add packages/cms/admin/src/components/tree-editor.tsx packages/cms/admin/src/components/tree-editor.test.tsx \
  packages/cms/admin/src/components/builder-input.tsx packages/cms/admin/src/components/builder-input.test.tsx
git commit -m "feat(cms)!: builder span controls, 12-track preview bar, tier toggle + total badge

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: CMS server — descriptor + server-side fixtures

**Files:**
- Modify: `packages/cms/server/src/components/layout/row.json`
- Test: `packages/cms/server/src/lib/inject-components.test.ts`
- Test: `packages/cms/server/src/lib/serialize-schema.test.ts`
- Test: `packages/cms/server/src/lib/validate-write.test.ts`
- Test: `packages/cms/server/src/lib/hydrate-tree.test.ts`
- Test: `packages/cms/server/src/lib/serve-hydrated.test.ts`

**Interfaces:**
- Consumes (from Task 1): validator at version 2, span-aware columns, no ratio.
- Produces: `preset-layout.row` descriptor with **no** `ratio` attribute; `/api/press/schema` serves `tree: { version: 2 }` (no code change — `serialize-schema.ts` reads the imported `PRESS_TREE_VERSION`).

- [ ] **Step 1: Remove `ratio` from the row descriptor**

Replace `packages/cms/server/src/components/layout/row.json` with:

```json
{
  "collectionName": "components_preset_layout_rows",
  "info": {
    "displayName": "Row",
    "icon": "apps",
    "description": "A tree row: a horizontal band of columns; each column owns its per-breakpoint span. container carries the shared layout attributes"
  },
  "options": {},
  "attributes": {
    "container": { "type": "component", "repeatable": false, "component": "preset-layout.container" }
  },
  "config": {
    "metadatas": {
      "container": { "edit": { "label": "Container" } }
    }
  }
}
```

(`column.json` is unchanged — span is builder-owned structural data, not a descriptor field, exactly as `id`/`children` are.)

- [ ] **Step 2: Update the server-side test fixtures/assertions**

In `packages/cms/server/src/lib/inject-components.test.ts`, replace the `preset-layout.row` assertion (lines 119–128) so it proves `ratio` is gone:

```ts
    const rowAttrs = components.get('preset-layout.row')?.attributes as Record<string, unknown>;
    expect(components.get('preset-layout.row')?.modelType).toBe('component');
    expect(components.get('preset-layout.row')?.category).toBe('preset-layout');
    expect(rowAttrs).not.toHaveProperty('ratio');
    expect(rowAttrs).toMatchObject({
      container: { type: 'component', repeatable: false, component: 'preset-layout.container' },
    });
```

Also update the comment just above (lines 104–107) so it no longer claims `row's ratio is the closed column-split enum` — change that clause to: `row carries only the container reference now; column span is builder-owned structural data`.

In `packages/cms/server/src/lib/serialize-schema.test.ts`, change the version assertion (line 47):

```ts
    expect(serializeSchema(fakeStrapi()).tree).toEqual({ version: 2 });
```

In `packages/cms/server/src/lib/validate-write.test.ts`:
- `validTree` (line 5) `version: 1` → `version: 2`.
- In the "rejects structural errors AND stripped-attr warnings" test, the `warned` tree (lines 18–24) → `version: 2`, drop `ratio: '50-50'`, and give the column a span. It must still trip the `width: 'xl'` warning so the write is rejected:

```ts
    const warned = {
      version: 2,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'r', type: 'row', container: { width: 'xl' }, children: [
          { id: 'c', type: 'column', span: { base: 12 }, children: [] },
        ] },
      ] },
    };
```

In `packages/cms/server/src/lib/hydrate-tree.test.ts`:
- The `nodes` fixture's row (line 20) → drop `ratio: '50-50'`, add `span: { base: 12 }` to each column (`{ id: 'c1', type: 'column', span: { base: 12 }, children: [...] }`, `{ id: 'c2', type: 'column', span: { base: 12 }, children: [] }`).
- The tree fixture at line 71 `version: 1` → `version: 2`.

In `packages/cms/server/src/lib/serve-hydrated.test.ts`:
- `bodyOf` (line 44) `version: 1` → `version: 2`.
- If any `bodyOf(...)` call constructs a row with `ratio`, drop it and add `span: { base: 12 }` to its columns (search the file for `type: 'row'`).

- [ ] **Step 3: Run the full cms suite + server tsc**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS — `serializeSchema` serves `{ version: 2 }`; the row descriptor no longer exposes `ratio`; the strict-write test still rejects on the `width` warning; hydration/serve tests green; server `tsc --noEmit` clean.

- [ ] **Step 4: Commit**

```bash
git add packages/cms/server/src/components/layout/row.json \
  packages/cms/server/src/lib/inject-components.test.ts packages/cms/server/src/lib/serialize-schema.test.ts \
  packages/cms/server/src/lib/validate-write.test.ts packages/cms/server/src/lib/hydrate-tree.test.ts \
  packages/cms/server/src/lib/serve-hydrated.test.ts
git commit -m "feat(cms)!: drop ratio from the row descriptor; serve tree version 2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Seeds + generated types

**Files:**
- Modify: `packages/cli/templates/cms/scripts/seed-content.mjs`
- Modify: `apps/playground/packages/cms/scripts/seed-content.mjs` (byte-identical copy)
- Test: `packages/cli/src/create/seed-content.test.ts`
- Modify: `packages/cli/templates/project/packages/shared/types/generated.ts`
- Modify: `apps/playground/packages/shared/types/generated.ts`

**Interfaces:**
- Consumes (from Task 1): validator at version 2, span-aware columns.
- Produces: `buildHomeBody(...)` returns a `version: 2` tree whose row columns carry `span`; `PresetLayoutRow` generated interface has no `ratio?`.

- [ ] **Step 1: Update the CLI seed-content test (fails first)**

In `packages/cli/src/create/seed-content.test.ts`, replace the "demonstrates atoms then the grid …" test body (lines 18–34) with the span-aware assertions:

```ts
  it('demonstrates atoms then the grid: heading/paragraph/list atoms + a spanned row (no hero, no nested rows)', () => {
    const children = tree.root.children;
    expect(children.map((n: any) => n.type)).toEqual(['block', 'block', 'block', 'block', 'row']);
    expect(children.slice(0, 4).map((n: any) => n.component)).toEqual([
      'preset-atom.heading', 'preset-atom.paragraph', 'preset-atom.list', 'preset-atom.heading',
    ]);
    expect(children.some((n: any) => n.component === 'preset-organism.hero')).toBe(false);

    const rowNode = children[4];
    expect(rowNode).toMatchObject({ type: 'row' });
    expect(rowNode).not.toHaveProperty('ratio');
    expect(rowNode.children).toHaveLength(2);
    // each column carries a mobile-first span (stacked on phones, 50/50 on desktop)
    expect(rowNode.children[0].span).toEqual({ base: 12, md: 6 });
    expect(rowNode.children[1].span).toEqual({ base: 12, md: 6 });
    // an image atom (media assetId ref) sits in the first column; no deeper row nesting
    const imageAtom = rowNode.children[0].children[0];
    expect(imageAtom).toMatchObject({ type: 'block', component: 'preset-atom.image' });
    expect(imageAtom.data.image).toEqual({ assetId: 7 });
    expect(rowNode.children[1].children.some((n: any) => n.type === 'row')).toBe(false);
  });
```

(The first test — "is a valid PressTree with inherited chrome" — needs no edit; it already asserts `errors`/`warnings` are empty, which now runs against the v2 validator.)

- [ ] **Step 2: Run the CLI test to verify it fails**

Run: `pnpm --filter @ogs-tech/create-press test src/create/seed-content.test.ts`
Expected: FAIL — the seed still emits `version: 1`, a `ratio` on the row, and columns without `span`.

- [ ] **Step 3: Rewrite the seed helpers + demo**

In `packages/cli/templates/cms/scripts/seed-content.mjs`, replace the `column`/`row` helpers (lines 35–36) with span-aware versions:

```js
const column = (span, children, container) => ({ id: randomUUID(), type: 'column', span, children, ...(container ? { container } : {}) });
const row = (children, container) => ({ id: randomUUID(), type: 'row', children, ...(container ? { container } : {}) });
```

Change the `buildHomeBody` version + the demo row (lines 47–72). Set `version: 2` and rewrite the `row(...)` call so each column carries a span:

```js
export const buildHomeBody = ({ imageAssetId }) => ({
  version: 2,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [
      block('preset-atom.heading', { text: 'Components', level: '2' }),
      block('preset-atom.paragraph', {
        content: 'Components are the blocks you place in the tree. They render as static HTML with no client hydration.',
      }),
      block('preset-atom.list', {
        format: 'unordered',
        content: ['Atoms — heading, paragraph, list, quote, image, button', 'Organisms — hero, cta and site chrome', 'Your own custom-* blocks, anywhere in the tree'].join('\n'),
      }),
      block('preset-atom.heading', { text: 'Grid layout', level: '2' }),
      // Grid layout: two columns, stacked on phones (base 12) and 50/50 on desktop (md 6).
      row([
        column({ base: 12, md: 6 }, [block('preset-atom.image', { image: { assetId: imageAssetId }, caption: 'An image component inside a column' })]),
        column({ base: 12, md: 6 }, [block('preset-atom.paragraph', {
          content: 'Rows and columns are the grid layout. Here an image fills the left column and this paragraph the right — a 12/6 span split. Compose the rest in the builder.',
        })]),
      ]),
    ],
  },
});
```

(`buildPageDefaults` uses no rows/columns — it stays unchanged.)

- [ ] **Step 4: Mirror the change into the playground copy**

The playground seed is a byte-identical copy. Copy the file over:

Run: `cp packages/cli/templates/cms/scripts/seed-content.mjs apps/playground/packages/cms/scripts/seed-content.mjs`

Verify identical:

Run: `diff packages/cli/templates/cms/scripts/seed-content.mjs apps/playground/packages/cms/scripts/seed-content.mjs && echo IDENTICAL`
Expected: `IDENTICAL`.

- [ ] **Step 5: Drop `ratio?` from both generated `PresetLayoutRow` interfaces**

In `packages/cli/templates/project/packages/shared/types/generated.ts`, replace the `PresetLayoutRow` interface (lines 70–73) with:

```ts
export interface PresetLayoutRow {
  container?: PresetLayoutContainer;
}
```

Apply the exact same edit to `apps/playground/packages/shared/types/generated.ts` (the interface there spans lines 100–103; the `PresetLayoutColumn` interface directly below stays unchanged — span is structural, not a generated field). `pnpm dev` regenerates the playground copy from the live schema and will reproduce this shape.

- [ ] **Step 6: Run the CLI test to verify it passes**

Run: `pnpm --filter @ogs-tech/create-press test && pnpm --filter @ogs-tech/create-press typecheck`
Expected: PASS — the seeded home body validates clean at v2 and the row columns carry `{ base: 12, md: 6 }` spans.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/templates/cms/scripts/seed-content.mjs apps/playground/packages/cms/scripts/seed-content.mjs \
  packages/cli/src/create/seed-content.test.ts \
  packages/cli/templates/project/packages/shared/types/generated.ts apps/playground/packages/shared/types/generated.ts
git commit -m "feat(cli)!: seed spanned columns at tree version 2; generated PresetLayoutRow drops ratio

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Docs, changeset, full-suite verification + playground reseed

**Files:**
- Modify: `CLAUDE.md`
- Create: `.changeset/free-column-spans.md`

**Interfaces:**
- Consumes: every prior task.
- Produces: an updated architectural reference + a `major`/`major`/`major` changeset; a fully green monorepo build/test/typecheck; a reseeded playground DB at v2.

- [ ] **Step 1: Update `CLAUDE.md` — "Composition trees"**

Open `CLAUDE.md`. In the "Composition trees (`PressTree`)" bullet list, find the `RowNode`/`ColumnNode` sentence (grep for `carries a \`ratio\``) and replace it with:

> A `RowNode` carries 1–`MAX_COLUMNS` (12) `ColumnNode` children (no shared
> row-level ratio); each `ColumnNode` carries a `span` (`ColumnSpan`: `{ base;
> md?; lg? }`, `base` required, each tier 1–12 tracks, mobile-first) — the ONE
> responsive value stored in the tree — and is the recursion point: it nests
> arbitrary further `Node`s, including more rows, to unlimited depth; a
> `BlockNode` is a placed component.

Find the "Responsiveness NEVER appears in this JSON" sentence (grep `Responsiveness NEVER appears`) and replace it with:

> Column `span` (per-breakpoint, mobile-first) is the ONE responsive value the
> composition JSON carries — a deliberate reversal of the old
> "responsiveness never in the JSON" rule. Everything else stays code-side:
> `container` attrs are editorial intents only, mapped to `Responsive<T>`
> layout-primitive props by `web/src/tree/container-attrs.ts` (`GAP_TIERS`).
> `spanFor(column)` now passes the stored span straight to `<Column>` — the old
> `RATIO_SPANS`/`RATIO_SLOTS`/`setRowRatio` mapping table is retired.

Find "**Version-gated readers.** `PRESS_TREE_VERSION` (currently `1`)" and change `1` → `2`.

- [ ] **Step 2: Update `CLAUDE.md` — "Layout primitives" + retirement note**

In the "Layout primitives" section, find the `TreeRenderer` paragraph describing how a `ColumnNode` becomes `<Column span={…}>`. Append a sentence:

> A column's `<Column span>` now comes from its own stored `ColumnSpan`
> (`spanFor(column)` — a passthrough); the retired `RowNode.ratio` no longer
> exists, so `spanFor` takes the column, not `(ratio, index)`. `theme.css` and
> the four primitives are untouched — `ColumnSpan` already matches the
> `Responsive<Span>` the `<Column>` primitive consumes, and the
> `--press-col-span[-md|-lg]` var() cascade handles mobile-first inheritance.

Also, in the "Retired" bullet inside "Canonical identity" or wherever retired mechanisms are catalogued, note in prose: `RATIO_SPANS` (web), `setRowRatio`/`RATIO_SLOTS` (cms admin), and `MAX_ROW_COLUMNS` (shared validator) are retired with the ratio→span change; `MAX_COLUMNS` (builder) is now 12.

- [ ] **Step 3: Write the changeset**

Create `.changeset/free-column-spans.md`:

```md
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
```

- [ ] **Step 4: Run the whole monorepo build + test + typecheck**

Run: `pnpm build && pnpm -r test && pnpm -r --if-present typecheck`
Expected: PASS across all packages — `strapi-plugin build` compiles the cms plugin (admin + server) clean; every Vitest suite green; every `tsc --noEmit` clean. If anything fails, fix the offending fixture/type before proceeding (do not weaken assertions to pass).

- [ ] **Step 5: Reseed the playground DB and smoke-test the app**

The playground DB was seeded at v1 and must be reset so the idempotent seed writes a v2 tree:

Run: `rm -f apps/playground/packages/cms/.tmp/data.db`

Then boot the dogfood and confirm it comes up (cms `:1337/admin`, web `:3000`) and regenerates `apps/playground/packages/shared/types/generated.ts`:

Run: `pnpm dev`
Expected: the CMS boots, `seedSiteSetting`/CLI seed write pageDefaults + home at v2, the web home renders the spanned demo row (image + paragraph, 50/50 on desktop / stacked on mobile), and `generated.ts` has no `ratio?` on `PresetLayoutRow`. Stop the dev process once verified (Ctrl-C).

> If `pnpm dev` cannot be run interactively in your environment, at minimum confirm `git status` shows the regenerated `apps/playground/packages/shared/types/generated.ts` matches the hand-edit from Task 6 (no `ratio?`), and note in the PR that a manual playground reseed is required.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .changeset/free-column-spans.md apps/playground/packages/shared/types/generated.ts
git commit -m "docs+chore!: document column spans; changeset (shared/web/cms major)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (completed against the spec)

**Spec coverage** — every section maps to a task:
- §3 data model → Task 1 (tree.ts).
- §4 validator (version gate, ratio removal, span validation, non-empty columns) → Task 1 (validate-tree.ts + tests).
- §5 web renderer (`spanFor(column)`, drop `RATIO_SPANS`, `ColumnView`/`RowView`) → Task 2. Primitives/CSS explicitly untouched (confirmed: `theme.css:528-539` already has the base/md/lg cascade).
- §6 builder (tree-ops `setColumnSpan`/`newRowNode`/`MAX_COLUMNS=12`; tree-editor `SpanControls`/`GridPreview`/toggle/badge; row.json ratio removal; form-model unaffected) → Tasks 3, 4, 5. `form-model.ts` needs no edit — it never references `ratio` (verified).
- §7 seeds, generated.ts, serialize-schema (no code change) → Tasks 5, 6.
- §8 testing (shared span cases, web spanFor + renderer vars, tree-ops caps, tree-editor DS test, serialize/descriptor, breakpoints unchanged) → embedded in each task. `breakpoints.test.ts` is intentionally not modified (its passing run in Task 7's `pnpm -r test` confirms no CSS drift).
- §9 migration/changeset → Task 7 (changeset + playground reseed).
- §10 docs → Task 7 (CLAUDE.md) + Task 1 (tree.ts header).
- §11 out of scope (drag/resize, `start` offset, `<section>` question, theme.css/primitives) → nothing in the plan touches these.

**Ripple coverage beyond the spec's explicit list** (found during exploration, all assigned): `web/src/index.ts` `Ratio` re-export (Task 2), `builder-input.tsx`/`.test.tsx` hard-coded `version: 1` (Task 4), and the v1 fixtures in `resolve-slots.test.ts` / `map-page.test.ts` / `validate-write.test.ts` / `hydrate-tree.test.ts` / `serve-hydrated.test.ts` / `inject-components.test.ts` (Tasks 2 & 5) — all would break `tsc`/assertions once the wire moves to v2.

**Type consistency:** `ColumnSpan`/`Span`/`effectiveSpan`/`setColumnSpan`/`spanFor(column)`/`newRowNode()`/`MAX_COLUMNS` names and signatures are used identically across the Interfaces blocks and code steps. `spanFor` is `(column: ColumnNode) => Responsive<Span>` everywhere; `effectiveSpan` is `(span: ColumnSpan, tier) => number` everywhere.
