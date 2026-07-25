# Site-Level Layout Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the three hardcoded container-attr fallbacks (`width: 'lg'`, `gap: 'normal'`, `verticalAlign: 'top'`) out of the web renderer into a CMS-owned "Layout" section on Site Settings, then make the composition builder name the resolved value (`Site default · Content width`) instead of the opaque word `engine default`.

**Architecture:** A new `LayoutDefaults` contract in `@ogs-tech/press-shared` (one group per tree level: `page` / `row` / `column`) plus a sanitizing `resolveLayoutDefaults`. The cms stores it in four `preset-config.layout*` components on Site Settings and serves it on the EXISTING `GET /api/press/schema` payload (which the builder already fetches, module-cached) as well as on `GET /api/site-setting` (which the web renderer already fetches). Web's `container-attrs.ts` pickers take the site defaults as a second argument; `TreeRenderer` threads `site.layout` down beside the existing `registry` prop. The builder reads `schema.layoutDefaults`, names it in every placeholder, and gains a body-level "Layout options" section writing `tree.root.container`.

**Tech Stack:** TypeScript 5, Strapi 5 plugin (`@strapi/sdk-plugin` build), Next.js 15 / React 19 RSC, vitest 2, pnpm 10 workspaces, changesets.

## Global Constraints

- Node 20.x, pnpm 10.x. Run every command from the repo root unless a task says otherwise.
- **No wire migration.** `PRESS_TREE_VERSION` stays `2`. Nothing in `validatePressTree` changes semantically.
- **Versioning:** `@ogs-tech/press-web` is a **major** (`ResolvedPressConfig` gains a required `layout` key); `@ogs-tech/press-shared` and `@ogs-tech/press-cms` are **minors** (purely additive); `@ogs-tech/create-press` is a **patch** (seed copy only).
- **Fail-to-default, not fail-to-empty.** CMS down / record missing / unrecognized value ⇒ `DEFAULT_LAYOUT` (per key). This joins `DEFAULT_THEME` and `mapCookieConsent`, NOT the identity/SEO fail-to-empty rule. Nothing in this feature may throw.
- **Nothing is seeded.** An unset enum select renders as an empty placeholder, which is already truthful. Do not add a `seedLayout` step or a plugin-store flag.
- **Label strings are a contract.** These exact strings appear in BOTH the Site Settings component JSON (`config.metadatas.*.edit.label`) and the builder's `containerFieldLabel`. They must match verbatim — that correspondence is what makes `Site default · Normal` traceable to the field an editor set:
  - page: `gap` → **Vertical rhythm**
  - row: `width` → **Width**, `gap` → **Column gap**, `verticalAlign` → **Vertical align**
  - column: `gap` → **Vertical rhythm**, `verticalAlign` → **Content align**
- **Option labels** (builder-only, presentation): `prose` → `Reading width`, `lg` → `Content width`, `full` → `Full bleed`; `compact|normal|spacious` → `Compact|Normal|Spacious`; `top|center|bottom` → `Top|Center|Bottom`; `undefined` → `per-block spacing`.
- Never hand-edit anything under `.press/` — it is regenerated on every `press dev`/`build`.
- `packages/cms` must be rebuilt (`pnpm --filter @ogs-tech/press-cms build`) before any playground boot: `strapi develop` loads `dist/`, not TS source.
- There is no eslint. The quality gate is `pnpm -r --if-present typecheck` + `pnpm -r test` + `pnpm --filter @ogs-tech/press-cms test:ts:back`.
- Commit after every task (the plan's last step in each task). Do not push; do not open a PR.

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `packages/shared/src/layout-defaults.ts` | The `LayoutDefaults` type, `DEFAULT_LAYOUT`, and the sanitizing `resolveLayoutDefaults`. |
| `packages/shared/src/layout-defaults.test.ts` | Unit tests for the above. |
| `packages/cms/server/src/components/config/layout.json` | `preset-config.layout` — the group holding one component per tree level. |
| `packages/cms/server/src/components/config/layout-page.json` | `preset-config.layout-page` — `gap` only. |
| `packages/cms/server/src/components/config/layout-row.json` | `preset-config.layout-row` — `width`, `gap`, `verticalAlign`. |
| `packages/cms/server/src/components/config/layout-column.json` | `preset-config.layout-column` — `gap`, `verticalAlign`. |
| `packages/cms/server/src/lib/read-layout-defaults.ts` | Reads the single type → `resolveLayoutDefaults`; never throws. |
| `packages/cms/server/src/lib/read-layout-defaults.test.ts` | Unit tests for the above. |
| `packages/cms/server/src/controllers/schema.test.ts` | Pins that `/api/press/schema` carries `layoutDefaults`. |
| `packages/cms/admin/src/lib/palette-labels.test.ts` | Unit tests for the two new label functions. |
| `.changeset/site-layout-defaults.md` | The release note. |

**Modified**

| File | Change |
| --- | --- |
| `packages/shared/src/tree.ts` | Export `ContainerKey`. |
| `packages/shared/src/validate-tree.ts` | The three private enum lists become ONE exported `CONTAINER_ENUMS`. |
| `packages/shared/src/validate-tree.test.ts` | One assertion pinning `CONTAINER_ENUMS`. |
| `packages/shared/src/index.ts` | Re-export `./layout-defaults`; `PressSchema.layoutDefaults?`; correct the stale "type-only" header. |
| `packages/cms/server/src/lib/inject-components.ts` | Register the four new config components. |
| `packages/cms/server/src/lib/inject-components.test.ts` | New cases for the four components + the Site Settings `layout` attribute. |
| `packages/cms/server/src/content-types/site-setting/schema.json` | New `layout` component attribute + `"Layout"` metadata. |
| `packages/cms/server/src/controllers/site-setting.ts` | Deep-populate `layout`. |
| `packages/cms/server/src/controllers/site-setting.test.ts` | New populate assertion. |
| `packages/cms/server/src/controllers/schema.ts` | Merge `layoutDefaults` into the response. |
| `packages/cms/admin/src/lib/palette-labels.ts` | `containerFieldLabel`, `containerOptionLabel`. |
| `packages/cms/admin/src/lib/form-model.ts` | `layoutDefaultsOf(schema)`. |
| `packages/cms/admin/src/lib/tree-ops.ts` | Extract `patchContainer`; use `ContainerKey`. |
| `packages/cms/admin/src/lib/tree-ops.test.ts` | New `patchContainer` cases. |
| `packages/cms/admin/src/components/tree-editor.tsx` | `TreeCtx.layoutDefaults`; `ContainerSection` names the site default, exported. |
| `packages/cms/admin/src/components/tree-editor.test.tsx` | Placeholder + per-level label assertions. |
| `packages/cms/admin/src/components/builder-input.tsx` | Body-level "Layout options" writing `tree.root.container`. |
| `packages/cms/admin/src/components/builder-input.test.tsx` | Body-level section assertions. |
| `packages/web/src/config/types.ts` | `SiteSettingsData.layout?`; `ResolvedPressConfig.layout` (required). |
| `packages/web/src/map-site-settings.ts` | `layout: resolveLayoutDefaults(c.layout)`. |
| `packages/web/src/map-site-settings.test.ts` | New layout cases. |
| `packages/web/src/config/build-metadata.test.ts`, `build-theme-style.test.ts` | Fixtures gain the now-required `layout` key. |
| `packages/web/src/tree/container-attrs.ts` | Every picker takes the site defaults for its level. |
| `packages/web/src/tree/container-attrs.test.ts` | Retargeted at the new signatures. |
| `packages/web/src/tree/tree-renderer.tsx` | Thread `site.layout` through `NodeList`/`RowView`/`ColumnView`. |
| `packages/web/src/tree/tree-renderer.test.tsx` | Fixture + site-default resolution test. |
| `packages/web/src/util/watch-schema.ts` | Compare the type-relevant slice, not the raw body. |
| `packages/web/src/util/watch-schema.test.ts` | New cases for the slice comparison. |
| `packages/web/src/index.ts` | Re-export the `LayoutDefaults` type. |
| `packages/cli/templates/cms/scripts/seed-content.mjs`, `seed.mjs` | "Grid layout" → "Grid system". |
| `apps/playground/packages/cms/scripts/seed-content.mjs`, `seed.mjs` | Same edits (committed scaffold output). |
| `CLAUDE.md` | Two documentation edits. |

---

### Task 1: `LayoutDefaults` contract in `@ogs-tech/press-shared`

**Files:**
- Create: `packages/shared/src/layout-defaults.ts`
- Create: `packages/shared/src/layout-defaults.test.ts`
- Modify: `packages/shared/src/tree.ts:43` (after the `ContainerAttrs` interface)
- Modify: `packages/shared/src/validate-tree.ts:27-29` and `:64-66`
- Modify: `packages/shared/src/validate-tree.test.ts` (append one case)
- Modify: `packages/shared/src/index.ts:1-13,33-41`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `type ContainerKey = keyof ContainerAttrs` (i.e. `'width' | 'gap' | 'verticalAlign'`) — from `./tree`
  - `const CONTAINER_ENUMS: Record<ContainerKey, readonly string[]>` — from `./validate-tree`
  - `interface LayoutDefaults { page: Pick<ContainerAttrs, 'gap'>; row: ContainerAttrs; column: Pick<ContainerAttrs, 'gap' | 'verticalAlign'> }`
  - `const DEFAULT_LAYOUT: LayoutDefaults`
  - `function resolveLayoutDefaults(raw: unknown): LayoutDefaults`
  - `PressSchema.layoutDefaults?: LayoutDefaults`
  - All re-exported from `@ogs-tech/press-shared`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/layout-defaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, resolveLayoutDefaults } from './layout-defaults';

describe('DEFAULT_LAYOUT', () => {
  it('carries exactly the fallbacks the web pickers used to hardcode', () => {
    expect(DEFAULT_LAYOUT.row).toEqual({ width: 'lg', gap: 'normal', verticalAlign: 'top' });
    expect(DEFAULT_LAYOUT.column).toEqual({ verticalAlign: 'top' });
    // An ABSENT page/column gap is meaningful, not a hole: the renderer emits no
    // stack attribute and the legacy per-block margins apply.
    expect(DEFAULT_LAYOUT.page).toEqual({});
    expect(DEFAULT_LAYOUT.column.gap).toBeUndefined();
  });
});

describe('resolveLayoutDefaults', () => {
  it('maps null / undefined / a non-object to DEFAULT_LAYOUT', () => {
    expect(resolveLayoutDefaults(null)).toEqual(DEFAULT_LAYOUT);
    expect(resolveLayoutDefaults(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(resolveLayoutDefaults('lg')).toEqual(DEFAULT_LAYOUT);
    expect(resolveLayoutDefaults([])).toEqual(DEFAULT_LAYOUT);
  });

  it('merges per key over DEFAULT_LAYOUT and leaves sibling keys/levels untouched', () => {
    const r = resolveLayoutDefaults({ row: { width: 'full' } });
    expect(r.row).toEqual({ width: 'full', gap: 'normal', verticalAlign: 'top' });
    expect(r.column).toEqual(DEFAULT_LAYOUT.column);
    expect(r.page).toEqual(DEFAULT_LAYOUT.page);
  });

  it('accepts a page gap — the one level whose engine default is absent', () => {
    expect(resolveLayoutDefaults({ page: { gap: 'spacious' } }).page).toEqual({ gap: 'spacious' });
  });

  it('falls back per KEY on an unrecognized value, never throwing', () => {
    const r = resolveLayoutDefaults({ row: { width: 'gigantic', gap: 'compact', verticalAlign: 7 } });
    expect(r.row).toEqual({ width: 'lg', gap: 'compact', verticalAlign: 'top' });
  });

  it('ignores a null group and a null value (an unset Strapi component / enum)', () => {
    expect(resolveLayoutDefaults({ row: null, column: { gap: null } })).toEqual(DEFAULT_LAYOUT);
  });

  it('ignores keys that do not apply to a level (page carries gap only)', () => {
    const r = resolveLayoutDefaults({ page: { gap: 'compact', width: 'full', verticalAlign: 'center' } });
    expect(r.page).toEqual({ gap: 'compact' });
  });

  it('returns a fresh object — DEFAULT_LAYOUT is never handed out for mutation', () => {
    const r = resolveLayoutDefaults(null);
    expect(r).not.toBe(DEFAULT_LAYOUT);
    expect(r.row).not.toBe(DEFAULT_LAYOUT.row);
  });
});
```

Append to `packages/shared/src/validate-tree.test.ts` (a drift guard: the cms component JSONs and the builder selects now read these lists):

```ts
describe('CONTAINER_ENUMS', () => {
  it('is the ONE copy of the allowed container-attr values', () => {
    expect(CONTAINER_ENUMS.width).toEqual(['prose', 'lg', 'full']);
    expect(CONTAINER_ENUMS.gap).toEqual(['compact', 'normal', 'spacious']);
    expect(CONTAINER_ENUMS.verticalAlign).toEqual(['top', 'center', 'bottom']);
  });
});
```

Add `CONTAINER_ENUMS` to that file's existing import from `./validate-tree`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-shared test`
Expected: FAIL — `Failed to resolve import "./layout-defaults"` and `CONTAINER_ENUMS is not exported`.

- [ ] **Step 3: Export `ContainerKey` from `tree.ts`**

In `packages/shared/src/tree.ts`, directly after the `ContainerAttrs` interface (currently ends at line 43), add:

```ts
/** The three container attr keys, named once — read by the validator's enum map,
 *  the layout defaults resolver, and the builder's per-level label maps. */
export type ContainerKey = keyof ContainerAttrs;
```

- [ ] **Step 4: Collapse the three enum lists into one exported map**

In `packages/shared/src/validate-tree.ts`, replace lines 27-29:

```ts
const WIDTHS: readonly string[] = ['prose', 'lg', 'full'];
const GAPS: readonly string[] = ['compact', 'normal', 'spacious'];
const VERTICAL_ALIGNS: readonly string[] = ['top', 'center', 'bottom'];
```

with:

```ts
/**
 * The allowed value list per container attr — the ONE copy of these enums.
 * Read by `sanitizeContainer` below, by `resolveLayoutDefaults`
 * (layout-defaults.ts), by the cms `preset-config.layout*` component schemas
 * (pinned by a test), and by the builder's own selects. A `Record<ContainerKey>`
 * so adding an attr to `ContainerAttrs` is a compile error until its values are
 * declared here.
 */
export const CONTAINER_ENUMS: Record<ContainerKey, readonly string[]> = {
  width: ['prose', 'lg', 'full'],
  gap: ['compact', 'normal', 'spacious'],
  verticalAlign: ['top', 'center', 'bottom'],
};
```

Add `ContainerKey` to the existing type import on line 13:

```ts
import type { ColumnNode, ColumnSpan, ContainerAttrs, ContainerKey, LayoutNode, Node, PressTree, RowNode, Slot } from './tree';
```

Then update the three `pick(...)` calls (currently lines 64-66) to read from the map:

```ts
  pick('width', CONTAINER_ENUMS.width);
  pick('gap', CONTAINER_ENUMS.gap);
  pick('verticalAlign', CONTAINER_ENUMS.verticalAlign);
```

- [ ] **Step 5: Write `layout-defaults.ts`**

Create `packages/shared/src/layout-defaults.ts`:

```ts
/**
 * Site-level layout defaults (layout-defaults spec §3) — the fallbacks the web
 * pickers used to hardcode (`attrs?.width ?? 'lg'`, …), promoted to a CMS-owned
 * contract so a site's baseline rhythm is an editorial decision, not an engine
 * edit + redeploy.
 *
 * ONE GROUP PER TREE LEVEL, not one shared group: `gap` is two different
 * physical axes — space BETWEEN columns on a row (`--press-grid-gap`) versus
 * vertical rhythm WITHIN a page/column stack (`--press-tree-gap` /
 * `--press-cell-gap`). A single field would force one label onto both, and
 * setting it would silently flip every column cell from per-block margins to
 * flex stacking.
 *
 * Lives here, not in web, because the cms (serving the builder's payload) and
 * web (rendering) must resolve the SAME value — the `validate-tree` precedent:
 * one shared implementation both sides import.
 */
import type { ContainerAttrs, ContainerKey } from './tree';
import { CONTAINER_ENUMS } from './validate-tree';

/** Each level carries the SUBSET of ContainerAttrs that actually applies there
 *  (tree design §3: a non-applicable attr is ignored by the renderer and hidden
 *  by the builder form — here it is absent from the type outright, so the CMS
 *  can never grow a field the renderer would ignore). */
export interface LayoutDefaults {
  page: Pick<ContainerAttrs, 'gap'>;
  row: ContainerAttrs;
  column: Pick<ContainerAttrs, 'gap' | 'verticalAlign'>;
}

/** The engine baseline. An ABSENT `gap` on page/column is meaningful, not a
 *  hole: the renderer emits no stack attribute and legacy per-block margins
 *  apply — which is also why there is no enum member meaning "no stack". */
export const DEFAULT_LAYOUT: LayoutDefaults = {
  page: {},
  row: { width: 'lg', gap: 'normal', verticalAlign: 'top' },
  column: { verticalAlign: 'top' },
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Which keys each level admits — the type's `Pick`s, as data. */
const LEVEL_KEYS: Record<keyof LayoutDefaults, readonly ContainerKey[]> = {
  page: ['gap'],
  row: ['width', 'gap', 'verticalAlign'],
  column: ['gap', 'verticalAlign'],
};

/**
 * CMS shape → a TOTAL LayoutDefaults. Sanitizing and never throwing: an absent
 * group, a `null` value (an unset Strapi enum), a wrong type, or an unknown enum
 * member all fall back to the engine default for THAT KEY — the validate-tree
 * discipline, where an attr-level failure is never a document-level failure.
 * Always returns a fresh object, so DEFAULT_LAYOUT is never handed out for
 * mutation.
 */
export function resolveLayoutDefaults(raw: unknown): LayoutDefaults {
  const source = isRecord(raw) ? raw : {};
  const level = <L extends keyof LayoutDefaults>(name: L): LayoutDefaults[L] => {
    const group = isRecord(source[name]) ? (source[name] as Record<string, unknown>) : {};
    const out: Record<string, string> = { ...(DEFAULT_LAYOUT[name] as Record<string, string>) };
    for (const key of LEVEL_KEYS[name]) {
      const value = group[key];
      if (typeof value === 'string' && CONTAINER_ENUMS[key].includes(value)) out[key] = value;
    }
    return out as LayoutDefaults[L];
  };
  return { page: level('page'), row: level('row'), column: level('column') };
}
```

- [ ] **Step 6: Wire the exports and correct the stale package header**

In `packages/shared/src/index.ts`, replace the header's last paragraph (lines 11-12):

```ts
 * Consumed type-only (`import type`), so it never enters either package's
 * runtime/published artifact — purely a build-time, single-source-of-truth dep.
```

with:

```ts
 * NO LONGER type-only. Alongside the types this package ships RUNTIME values —
 * `PRESS_TREE_VERSION`, `validatePressTree`/`validateNodeArray`,
 * `CONTAINER_ENUMS`, `DEFAULT_LAYOUT`/`resolveLayoutDefaults` — so it is a
 * PUBLISHED dependency: press-cms inlines it into its compiled `dist`
 * (`strapi-plugin build`) and press-web consumes the source (transpiled by the
 * Next host). The rule that survives: zero Strapi/Next imports, so the same code
 * runs unmodified on the cms write path and the web render path.
```

Add the optional schema key (after the `tree` key, line 34):

```ts
  /** Site-level layout defaults served by this cms (absent on pre-layout engines). */
  layoutDefaults?: LayoutDefaults;
```

Add the type import at the top of the interface block and the barrel export at the bottom:

```ts
import type { LayoutDefaults } from './layout-defaults';
```
```ts
export * from './tree';
export * from './validate-tree';
export * from './layout-defaults';
```

(The `import type` goes directly above `export interface Attr` — `index.ts` currently has no imports.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-shared test && pnpm --filter @ogs-tech/press-shared typecheck`
Expected: PASS — all `layout-defaults.test.ts` cases green, `validate-tree.test.ts` still green.

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): LayoutDefaults contract — DEFAULT_LAYOUT + resolveLayoutDefaults"
```

---

### Task 2: CMS components + the Site Settings "Layout" field

**Files:**
- Create: `packages/cms/server/src/components/config/layout.json`
- Create: `packages/cms/server/src/components/config/layout-page.json`
- Create: `packages/cms/server/src/components/config/layout-row.json`
- Create: `packages/cms/server/src/components/config/layout-column.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts:18-22` (imports), `:106-110` (registry entries)
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json:20-21,36-38`
- Modify: `packages/cms/server/src/controllers/site-setting.ts:17-33`
- Modify: `packages/cms/server/src/lib/inject-components.test.ts` (append cases)
- Modify: `packages/cms/server/src/controllers/site-setting.test.ts` (append case)

**Interfaces:**
- Consumes: `CONTAINER_ENUMS` from `@ogs-tech/press-shared` (Task 1) — for the drift-guard test only.
- Produces: registered component uids `preset-config.layout`, `preset-config.layout-page`, `preset-config.layout-row`, `preset-config.layout-column`; the Site Settings `layout` attribute; a `layout: { populate: { page, row, column } }` entry in the site-setting controller's populate.

**Why four purpose-built components instead of reusing `preset-layout.container` three times.** Reuse is tempting (same three attrs, same enums), and CLAUDE.md praises `container` as the descriptor "defined exactly once and shared by both node types" — but that sharing happens in the PLUGIN's builder form, which filters fields through `applicableContainerAttrs`. Site Settings is edited in Strapi's NATIVE single-type form, which has no such filter: reuse would render "Width" under `page` and `column`, where the renderer ignores it. Shipping a field that silently does nothing is the exact defect this feature exists to remove. The four-file shape mirrors the existing `preset-config.cookie-consent` → `preset-config.cookie-category` nesting.

- [ ] **Step 1: Write the failing tests**

Append to `packages/cms/server/src/lib/inject-components.test.ts` (inside the existing `describe('injectComponents', …)` block, after the last `it`):

```ts
  it('registers the four preset-config.layout* descriptors (layout-defaults spec §4)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    for (const uid of ['preset-config.layout', 'preset-config.layout-page', 'preset-config.layout-row', 'preset-config.layout-column']) {
      expect(components.get(uid)?.modelType).toBe('component');
      expect(components.get(uid)?.category).toBe('preset-config');
    }
    // the group holds exactly one component per tree level — the shape LayoutDefaults mirrors
    expect(components.get('preset-config.layout')?.attributes).toEqual({
      page: { type: 'component', repeatable: false, component: 'preset-config.layout-page' },
      row: { type: 'component', repeatable: false, component: 'preset-config.layout-row' },
      column: { type: 'component', repeatable: false, component: 'preset-config.layout-column' },
    });
  });

  it('gives each level exactly the attrs that apply there — never a field the renderer ignores', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    expect(Object.keys(components.get('preset-config.layout-page').attributes)).toEqual(['gap']);
    expect(Object.keys(components.get('preset-config.layout-row').attributes)).toEqual(['width', 'gap', 'verticalAlign']);
    expect(Object.keys(components.get('preset-config.layout-column').attributes)).toEqual(['gap', 'verticalAlign']);
  });

  it('pins every layout enum to the shared CONTAINER_ENUMS (one source of allowed values)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const attrs = (uid: string) => components.get(uid).attributes as Record<string, { enum: string[] }>;
    expect(attrs('preset-config.layout-page').gap.enum).toEqual([...CONTAINER_ENUMS.gap]);
    expect(attrs('preset-config.layout-row').width.enum).toEqual([...CONTAINER_ENUMS.width]);
    expect(attrs('preset-config.layout-row').gap.enum).toEqual([...CONTAINER_ENUMS.gap]);
    expect(attrs('preset-config.layout-row').verticalAlign.enum).toEqual([...CONTAINER_ENUMS.verticalAlign]);
    expect(attrs('preset-config.layout-column').gap.enum).toEqual([...CONTAINER_ENUMS.gap]);
    expect(attrs('preset-config.layout-column').verticalAlign.enum).toEqual([...CONTAINER_ENUMS.verticalAlign]);
  });

  it('labels the level fields EXACTLY as the builder names them (Site default · … traceability)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const label = (uid: string, field: string) => (components.get(uid) as any).config.metadatas[field].edit.label;
    expect(label('preset-config.layout-page', 'gap')).toBe('Vertical rhythm');
    expect(label('preset-config.layout-row', 'width')).toBe('Width');
    expect(label('preset-config.layout-row', 'gap')).toBe('Column gap');
    expect(label('preset-config.layout-row', 'verticalAlign')).toBe('Vertical align');
    expect(label('preset-config.layout-column', 'gap')).toBe('Vertical rhythm');
    expect(label('preset-config.layout-column', 'verticalAlign')).toBe('Content align');
  });
```

Add the import at the top of that test file:

```ts
import { CONTAINER_ENUMS } from '@ogs-tech/press-shared';
```

Then append a new top-level `describe` at the end of the same file:

```ts
describe('site-setting layout attribute (layout-defaults spec §4)', () => {
  it('attaches preset-config.layout as a config component labelled "Layout"', () => {
    expect((siteSettingSchema.attributes as any).layout).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.layout',
    });
    expect((siteSettingSchema as any).config.metadatas.layout.edit.label).toBe('Layout');
  });
});
```

Append to `packages/cms/server/src/controllers/site-setting.test.ts` (inside the existing `describe`):

```ts
  it('deep-populates layout — one component per tree level sits below a shallow populate', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.layout).toEqual({ populate: { page: true, row: true, column: true } });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — `components.get('preset-config.layout')` is `undefined`; `siteSettingSchema.attributes.layout` is `undefined`; `populate.layout` is `undefined`.

- [ ] **Step 3: Create the four component schemas**

`packages/cms/server/src/components/config/layout.json`:

```json
{
  "collectionName": "components_preset_config_layouts",
  "info": {
    "displayName": "Layout",
    "icon": "expand",
    "description": "Site-level layout defaults — the baseline every page, row and column inherits unless a node overrides it"
  },
  "options": {},
  "attributes": {
    "page": { "type": "component", "repeatable": false, "component": "preset-config.layout-page" },
    "row": { "type": "component", "repeatable": false, "component": "preset-config.layout-row" },
    "column": { "type": "component", "repeatable": false, "component": "preset-config.layout-column" }
  },
  "config": {
    "metadatas": {
      "page": { "edit": { "label": "Page", "description": "Applies to the page as a whole: rhythm between top-level blocks and rows." } },
      "row": { "edit": { "label": "Row", "description": "Applies to every row: container width, space between columns, cell alignment." } },
      "column": { "edit": { "label": "Column", "description": "Applies inside every column cell: vertical rhythm and content alignment." } }
    }
  }
}
```

`packages/cms/server/src/components/config/layout-page.json`:

```json
{
  "collectionName": "components_preset_config_layout_pages",
  "info": {
    "displayName": "Layout · Page",
    "icon": "stack",
    "description": "Page-level layout default: the vertical rhythm between top-level blocks and rows"
  },
  "options": {},
  "attributes": {
    "gap": { "type": "enumeration", "enum": ["compact", "normal", "spacious"] }
  },
  "config": {
    "metadatas": {
      "gap": { "edit": { "label": "Vertical rhythm", "description": "Space between top-level blocks and rows. Leave empty to keep each block's own spacing." } }
    }
  }
}
```

`packages/cms/server/src/components/config/layout-row.json`:

```json
{
  "collectionName": "components_preset_config_layout_rows",
  "info": {
    "displayName": "Layout · Row",
    "icon": "apps",
    "description": "Row-level layout defaults: container width, gap between columns, and cell alignment"
  },
  "options": {},
  "attributes": {
    "width": { "type": "enumeration", "enum": ["prose", "lg", "full"] },
    "gap": { "type": "enumeration", "enum": ["compact", "normal", "spacious"] },
    "verticalAlign": { "type": "enumeration", "enum": ["top", "center", "bottom"] }
  },
  "config": {
    "metadatas": {
      "width": { "edit": { "label": "Width", "description": "How wide a top-level row's content sits: reading width, content width, or full bleed." } },
      "gap": { "edit": { "label": "Column gap", "description": "Horizontal space between the columns of a row." } },
      "verticalAlign": { "edit": { "label": "Vertical align", "description": "How a row aligns its columns against each other." } }
    }
  }
}
```

`packages/cms/server/src/components/config/layout-column.json`:

```json
{
  "collectionName": "components_preset_config_layout_columns",
  "info": {
    "displayName": "Layout · Column",
    "icon": "stack",
    "description": "Column-level layout defaults: vertical rhythm inside a cell and where its content sits"
  },
  "options": {},
  "attributes": {
    "gap": { "type": "enumeration", "enum": ["compact", "normal", "spacious"] },
    "verticalAlign": { "type": "enumeration", "enum": ["top", "center", "bottom"] }
  },
  "config": {
    "metadatas": {
      "gap": { "edit": { "label": "Vertical rhythm", "description": "Space between the blocks stacked inside a column. Leave empty to keep each block's own spacing." } },
      "verticalAlign": { "edit": { "label": "Content align", "description": "Where a column's content sits within the cell height." } }
    }
  }
}
```

(`expand`, `stack` and `apps` are all already used by shipped engine components, so they are known-valid members of Strapi's fixed icon enum.)

- [ ] **Step 4: Register them**

In `packages/cms/server/src/lib/inject-components.ts`, add four imports after line 22 (`cookieConsentSchema`):

```ts
import layoutPageSchema from '../components/config/layout-page.json';
import layoutRowSchema from '../components/config/layout-row.json';
import layoutColumnSchema from '../components/config/layout-column.json';
import layoutDefaultsSchema from '../components/config/layout.json';
```

and four entries at the end of the `config` group in `ENGINE_COMPONENTS` (after the `cookie-consent` entry, line 110):

```ts
  // Layout defaults — the CMS-owned baseline `resolveLayoutDefaults` sanitizes and
  // both sides resolve against. Nested children first: `layout` references them.
  { layer: 'config', name: 'layout-page', schema: layoutPageSchema as Record<string, unknown> },
  { layer: 'config', name: 'layout-row', schema: layoutRowSchema as Record<string, unknown> },
  { layer: 'config', name: 'layout-column', schema: layoutColumnSchema as Record<string, unknown> },
  { layer: 'config', name: 'layout', schema: layoutDefaultsSchema as Record<string, unknown> },
```

- [ ] **Step 5: Add the Site Settings field**

In `packages/cms/server/src/content-types/site-setting/schema.json`, insert after the `themeRadius` attribute (line 20) — so the admin form reads identity → SEO → theme → layout → cookie consent → page defaults:

```json
    "layout": { "type": "component", "repeatable": false, "component": "preset-config.layout" },
```

and the matching metadata after the `themeRadius` entry (line 37):

```json
      "layout": { "edit": { "label": "Layout", "description": "Baseline layout every page, row and column inherits unless a node overrides it in the Composition builder. Leave a field empty to keep the engine default." } },
```

- [ ] **Step 6: Deep-populate it**

In `packages/cms/server/src/controllers/site-setting.ts`, add to `settingsPopulate()` after `themeRadius: true` (line 22):

```ts
    // The layout group holds one component per tree level, and a shallow populate
    // stops at the group — same reason as seo.image above.
    layout: { populate: { page: true, row: true, column: true } },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): preset-config.layout* components + Site Settings Layout field"
```

---

### Task 3: Serve `layoutDefaults` on `/api/press/schema`

**Files:**
- Create: `packages/cms/server/src/lib/read-layout-defaults.ts`
- Create: `packages/cms/server/src/lib/read-layout-defaults.test.ts`
- Create: `packages/cms/server/src/controllers/schema.test.ts`
- Modify: `packages/cms/server/src/controllers/schema.ts` (whole file)

**Interfaces:**
- Consumes: `resolveLayoutDefaults`, `DEFAULT_LAYOUT`, `PRESS_TREE_VERSION`, `LayoutDefaults` from `@ogs-tech/press-shared` (Task 1); the `layout` populate shape (Task 2).
- Produces: `readLayoutDefaults(strapi: Core.Strapi): Promise<LayoutDefaults>`; `GET /api/press/schema` now returns `{ tree, contentTypes, components, layoutDefaults }`.

**Why not inside `serializeSchema`.** That function's docblock makes its character load-bearing — synchronous, registry-only, "reading the live registry … means the generator can never disagree with what Strapi actually serves". A database read does not belong there. The merge happens one level up, in the controller.

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/server/src/lib/read-layout-defaults.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { readLayoutDefaults } from './read-layout-defaults';

const strapiWith = (record: unknown, opts: { throws?: boolean } = {}) => {
  const findFirst = vi.fn(async () => {
    if (opts.throws) throw new Error('db unavailable');
    return record;
  });
  return { strapi: { documents: vi.fn(() => ({ findFirst })) } as any, findFirst };
};

describe('readLayoutDefaults', () => {
  it('resolves the stored layout group through the shared resolver', async () => {
    const { strapi } = strapiWith({ layout: { row: { width: 'full' }, page: { gap: 'spacious' } } });
    const layout = await readLayoutDefaults(strapi);
    expect(layout.row).toEqual({ width: 'full', gap: 'normal', verticalAlign: 'top' });
    expect(layout.page).toEqual({ gap: 'spacious' });
  });

  it('returns DEFAULT_LAYOUT when the single type is missing (pre-bootstrap / wiped db)', async () => {
    const { strapi } = strapiWith(null);
    expect(await readLayoutDefaults(strapi)).toEqual(DEFAULT_LAYOUT);
  });

  it('returns DEFAULT_LAYOUT when the record carries no layout group', async () => {
    const { strapi } = strapiWith({ name: 'Acme' });
    expect(await readLayoutDefaults(strapi)).toEqual(DEFAULT_LAYOUT);
  });

  it('never throws — a failed read still yields a complete payload', async () => {
    const { strapi } = strapiWith(null, { throws: true });
    expect(await readLayoutDefaults(strapi)).toEqual(DEFAULT_LAYOUT);
  });

  it('deep-populates the three level components (a shallow populate stops at the group)', async () => {
    const { strapi, findFirst } = strapiWith({});
    await readLayoutDefaults(strapi);
    expect(findFirst.mock.calls[0][0]).toEqual({
      populate: { layout: { populate: { page: true, row: true, column: true } } },
    });
  });
});
```

Create `packages/cms/server/src/controllers/schema.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT, PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import schema from './schema';

/** Minimal registry-shaped fake (keys()/get(), never a Map) + a single-type read. */
const fakeStrapi = (record: unknown) => {
  const componentRecord: Record<string, any> = {
    'preset-atom.paragraph': { uid: 'preset-atom.paragraph', attributes: { content: { type: 'text' } } },
  };
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': { uid: 'plugin::press-cms.page', info: {}, attributes: {} },
    'plugin::press-cms.site-setting': { uid: 'plugin::press-cms.site-setting', info: {}, attributes: {} },
  };
  return {
    contentType: (uid: string) => contentTypes[uid],
    get: (key: string) =>
      key === 'components'
        ? { keys: () => Object.keys(componentRecord), get: (uid: string) => componentRecord[uid] }
        : undefined,
    documents: vi.fn(() => ({ findFirst: vi.fn(async () => record) })),
  } as any;
};

describe('schema controller', () => {
  it('serves the registry view PLUS the CMS-owned layoutDefaults', async () => {
    const ctx: any = {};
    await schema({ strapi: fakeStrapi({ layout: { row: { gap: 'compact' } } }) }).get(ctx);
    expect(ctx.body.contentTypes['plugin::press-cms.page']).toBeDefined();
    expect(ctx.body.components['preset-atom.paragraph']).toBeDefined();
    expect(ctx.body.tree).toEqual({ version: PRESS_TREE_VERSION });
    expect(ctx.body.layoutDefaults.row).toEqual({ width: 'lg', gap: 'compact', verticalAlign: 'top' });
  });

  it('serves DEFAULT_LAYOUT when the Site Settings record is missing', async () => {
    const ctx: any = {};
    await schema({ strapi: fakeStrapi(null) }).get(ctx);
    expect(ctx.body.layoutDefaults).toEqual(DEFAULT_LAYOUT);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — `Failed to resolve import "./read-layout-defaults"`, and `ctx.body.layoutDefaults` is `undefined`.

- [ ] **Step 3: Write `read-layout-defaults.ts`**

Create `packages/cms/server/src/lib/read-layout-defaults.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { resolveLayoutDefaults, type LayoutDefaults } from '@ogs-tech/press-shared';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * The CMS-owned layout defaults, resolved TOTAL for the `/api/press/schema`
 * payload (layout-defaults spec §4). Deliberately NOT part of `serializeSchema`:
 * that function is synchronous and registry-only by design ("the generator can
 * never disagree with what Strapi actually serves") — a database read does not
 * belong there.
 *
 * FAILS TO DEFAULT, never throws. `resolveLayoutDefaults` already turns a missing
 * record or an unset group into DEFAULT_LAYOUT; the catch covers the read ITSELF
 * failing (no db yet, a mid-bootstrap boot) so a pre-bootstrap or wiped database
 * still serves a complete payload and the builder always has a value to name.
 * Passing `undefined` back through the resolver (rather than returning
 * DEFAULT_LAYOUT directly) keeps the shared const out of callers' hands.
 */
export async function readLayoutDefaults(strapi: Core.Strapi): Promise<LayoutDefaults> {
  try {
    const record = await strapi
      .documents(SITE_SETTING_UID as any)
      .findFirst({ populate: { layout: { populate: { page: true, row: true, column: true } } } as any });
    return resolveLayoutDefaults((record as { layout?: unknown } | null)?.layout);
  } catch {
    return resolveLayoutDefaults(undefined);
  }
}
```

- [ ] **Step 4: Merge it into the controller**

Replace `packages/cms/server/src/controllers/schema.ts` entirely:

```ts
import type { Core } from '@strapi/strapi';
import { serializeSchema } from '../lib/serialize-schema';
import { readLayoutDefaults } from '../lib/read-layout-defaults';

/**
 * Public, versioned type-sync source of truth (Spec §5.2). Returns the engine's
 * runtime registry view; `@ogs-tech/press-web sync-types` fetches this to generate types.
 *
 * The registry view stays synchronous and DB-free (`serializeSchema`); the
 * CMS-owned layout defaults are merged in HERE, one level up (layout-defaults
 * spec §4), so the builder learns them from the ONE fetch it already makes.
 * Editable values on this endpoint are why `watchSchema` compares only the
 * type-relevant slice of the body — see web/src/util/watch-schema.ts.
 */
const schema = ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(ctx: any) {
    ctx.body = { ...serializeSchema(strapi), layoutDefaults: await readLayoutDefaults(strapi) };
  },
});

export default schema;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): serve layoutDefaults on /api/press/schema"
```

---

### Task 4: `ResolvedPressConfig.layout` (web, BREAKING)

**Files:**
- Modify: `packages/web/src/config/types.ts:1` (import), `:116-131` (add `layout`), `:156-173` (`SiteSettingsData`)
- Modify: `packages/web/src/map-site-settings.ts:1-5,52-85`
- Modify: `packages/web/src/map-site-settings.test.ts` (append cases)
- Modify: `packages/web/src/config/build-metadata.test.ts:27` (fixture)
- Modify: `packages/web/src/config/build-theme-style.test.ts:19` (fixture)
- Modify: `packages/web/src/index.ts:23-35` (re-export the type)

**Interfaces:**
- Consumes: `resolveLayoutDefaults`, `DEFAULT_LAYOUT`, `LayoutDefaults` from `@ogs-tech/press-shared` (Task 1).
- Produces: `ResolvedPressConfig.layout: LayoutDefaults` (REQUIRED — this is the press-web major); `SiteSettingsData.layout?: unknown`; `LayoutDefaults` re-exported from `@ogs-tech/press-web`.

- [ ] **Step 1: Write the failing tests**

Append to the first `describe('mapSiteSettings', …)` block in `packages/web/src/map-site-settings.test.ts`:

```ts
  it('resolves layout to DEFAULT_LAYOUT for a null/empty CMS (fail-to-DEFAULT, not fail-to-empty)', () => {
    expect(mapSiteSettings(buildTime, null).layout).toEqual(DEFAULT_LAYOUT);
    expect(mapSiteSettings(buildTime, {}).layout).toEqual(DEFAULT_LAYOUT);
  });

  it('lets a CMS layout value win per key while siblings keep the engine default', () => {
    const r = mapSiteSettings(buildTime, { layout: { row: { width: 'full' }, column: { gap: 'compact' } } } as any);
    expect(r.layout.row).toEqual({ width: 'full', gap: 'normal', verticalAlign: 'top' });
    expect(r.layout.column).toEqual({ verticalAlign: 'top', gap: 'compact' });
    expect(r.layout.page).toEqual({});
  });

  it('keeps an unrecognized layout value from breaking the document', () => {
    const r = mapSiteSettings(buildTime, { layout: { row: { gap: 'huge' } } } as any);
    expect(r.layout.row.gap).toBe('normal');
  });
```

Add the import at the top of that file:

```ts
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/map-site-settings.test.ts`
Expected: FAIL — `expected undefined to deeply equal { page: {}, row: {…}, column: {…} }`.

- [ ] **Step 3: Extend the types**

In `packages/web/src/config/types.ts`, line 1 becomes:

```ts
import type { LayoutDefaults, Node } from '@ogs-tech/press-shared';
```

Add to `ResolvedPressConfig`, directly after the `pageDefaults` block (line 119):

```ts
  /**
   * Site-level layout defaults (layout-defaults spec §5), TOTAL — the baseline
   * `container-attrs.ts` resolves an undeclared node attr against. A fail-to-DEFAULT
   * key (joining `theme` and `plugins.cookieConsent`, NOT the identity/SEO
   * fail-to-empty rule): a site with an unreachable CMS should render with the
   * engine's layout, not with no layout. Required, hence a press-web major — the
   * same discipline as `urn` / `pageDefaults` / `plugins`.
   */
  layout: LayoutDefaults;
```

Add to `SiteSettingsData`, after the `pageDefaults` field (line 172):

```ts
  /** The `preset-config.layout` group, RAW: sanitized downstream by
   *  `resolveLayoutDefaults`, so the wire shape is never trusted here. */
  layout?: unknown;
```

- [ ] **Step 4: Map it**

In `packages/web/src/map-site-settings.ts`, line 1 becomes:

```ts
import { resolveLayoutDefaults, validateNodeArray, type Node } from '@ogs-tech/press-shared';
```

and add the key after the `pageDefaults` block (line 79):

```ts
    // Fail-to-DEFAULT (layout-defaults spec §5), like `theme` above and unlike
    // identity/SEO: an unreachable CMS renders with the engine's layout, not none.
    layout: resolveLayoutDefaults(c.layout),
```

- [ ] **Step 5: Fix the two typed fixtures the required key breaks**

In `packages/web/src/config/build-metadata.test.ts`, add to the `resolved` object after `pageDefaults` (line 27):

```ts
  layout: DEFAULT_LAYOUT,
```

and import it: `import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';`

Do exactly the same in `packages/web/src/config/build-theme-style.test.ts` (`baseResolved`, after line 19).

- [ ] **Step 6: Re-export the type**

In `packages/web/src/index.ts`, add `LayoutDefaults` to the existing `export type { … } from '@ogs-tech/press-shared';` block (line 23-35), after `ContainerWidth`:

```ts
  ContainerWidth,
  LayoutDefaults,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS. (`tree-renderer.test.tsx` and `resolve-slots.test.ts` build their site fixture with `as any`, so they still typecheck; Task 5 gives the renderer fixture a real `layout`.)

- [ ] **Step 8: Commit**

```bash
git add packages/web
git commit -m "feat(web)!: ResolvedPressConfig gains a required layout key"
```

---

### Task 5: Renderer resolves node attr → site default → engine literal

**Files:**
- Modify: `packages/web/src/tree/container-attrs.ts` (whole file below `spanFor`)
- Modify: `packages/web/src/tree/container-attrs.test.ts` (replace the second `describe`)
- Modify: `packages/web/src/tree/tree-renderer.tsx:10,19,43-119`
- Modify: `packages/web/src/tree/tree-renderer.test.tsx:7-12` (fixture) + append a case

**Interfaces:**
- Consumes: `LayoutDefaults`, `DEFAULT_LAYOUT` (Task 1); `ResolvedPressConfig.layout` (Task 4).
- Produces the new picker signatures — every later reader of these functions must pass the second argument:
  - `rowGap(attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): Responsive<GridGap>`
  - `rowAlign(attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): GridAlignItems`
  - `rowWidth(attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): ContainerMaxWidth`
  - `stackGap(attrs: ContainerAttrs | undefined, d: Pick<ContainerAttrs, 'gap'>): string | undefined`
  - `cellAlign(attrs: ContainerAttrs | undefined, d: LayoutDefaults['column']): 'center' | 'end' | undefined`
  - `spanFor(column)` is UNCHANGED — a span is node-owned and never site-defaulted.

`stackGap` serves BOTH the layout root (`layout.page`) and a column cell (`layout.column`); typing its second parameter as `Pick<ContainerAttrs, 'gap'>` accepts either group.

- [ ] **Step 1: Write the failing test**

In `packages/web/src/tree/container-attrs.test.ts`, keep the `spanFor` describe and REPLACE the `describe('container pickers (absent attr → engine default)', …)` block with:

```ts
const SITE: LayoutDefaults = {
  page: { gap: 'compact' },
  row: { width: 'full', gap: 'spacious', verticalAlign: 'center' },
  column: { gap: 'normal', verticalAlign: 'bottom' },
};

describe('container pickers (node attr > site default > engine literal)', () => {
  it('falls back to the ENGINE default when the site sets nothing', () => {
    expect(rowGap(undefined, DEFAULT_LAYOUT.row)).toBe('md');             // 'normal'
    expect(rowAlign(undefined, DEFAULT_LAYOUT.row)).toBe('start');        // 'top'
    expect(rowWidth(undefined, DEFAULT_LAYOUT.row)).toBe('lg');
    expect(stackGap(undefined, DEFAULT_LAYOUT.page)).toBeUndefined();     // absent gap = per-block margins
    expect(cellAlign(undefined, DEFAULT_LAYOUT.column)).toBeUndefined();  // 'top' emits nothing
  });

  it('uses the SITE default when the node declares nothing', () => {
    expect(rowGap(undefined, SITE.row)).toEqual({ base: 'md', lg: 'lg' }); // 'spacious' tier-scales
    expect(rowAlign(undefined, SITE.row)).toBe('center');
    expect(rowWidth(undefined, SITE.row)).toBe('full');
    expect(stackGap(undefined, SITE.page)).toBe('var(--press-space-3)');   // 'compact'
    expect(cellAlign(undefined, SITE.column)).toBe('end');                 // 'bottom'
  });

  it('lets the NODE attr win over the site default', () => {
    expect(rowGap({ gap: 'compact' }, SITE.row)).toBe('sm');
    expect(rowAlign({ verticalAlign: 'top' }, SITE.row)).toBe('start');
    expect(rowWidth({ width: 'prose' }, SITE.row)).toBe('prose');
    expect(stackGap({ gap: 'spacious' }, SITE.page)).toBe('var(--press-space-7)');
    expect(cellAlign({ verticalAlign: 'center' }, SITE.column)).toBe('center');
  });

  it('keeps the trailing engine literal as a TYPE terminator only (an empty site group resolves)', () => {
    expect(rowGap(undefined, {})).toBe('md');
    expect(rowAlign(undefined, {})).toBe('start');
    expect(rowWidth(undefined, {})).toBe('lg');
  });
});
```

Extend the file's imports:

```ts
import { DEFAULT_LAYOUT, type ColumnNode, type LayoutDefaults } from '@ogs-tech/press-shared';
```

(replacing the current `import type { ColumnNode } from '@ogs-tech/press-shared';`).

In `packages/web/src/tree/tree-renderer.test.tsx`, give the fixture a real layout — replace lines 7-12:

```tsx
const site = (overrides: Partial<{ header: Node[]; footer: Node[]; layout: LayoutDefaults }> = {}) =>
  ({
    brand: { name: 'Press', favicon: '' },
    routes: { home: 'home' },
    pageDefaults: { header: overrides.header ?? [], footer: overrides.footer ?? [] },
    layout: overrides.layout ?? DEFAULT_LAYOUT,
  }) as any;
```

with imports:

```tsx
import { DEFAULT_LAYOUT, type LayoutDefaults, type Node, type PressTree } from '@ogs-tech/press-shared';
```

(replacing the current `import type { Node, PressTree } from '@ogs-tech/press-shared';`).

Then append two cases inside `describe('TreeRenderer', …)`:

```tsx
  it('resolves an undeclared node attr against the SITE layout defaults at every level', () => {
    const layout: LayoutDefaults = {
      page: { gap: 'compact' },
      row: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      column: { gap: 'spacious', verticalAlign: 'bottom' },
    };
    const body = tree([{
      id: 'r', type: 'row', children: [
        { id: 'c', type: 'column', span: { base: 12 }, children: [paragraph('p', 'x')] },
      ],
    }]);
    const html = renderToStaticMarkup(createElement(TreeRenderer, { body, site: site({ layout }) }));
    expect(html).toContain('data-max-width="full"');                             // row.width
    expect(html).toContain('--press-grid-gap-current:var(--press-grid-gap-sm)');  // row.gap compact
    expect(html).toContain('data-align-items="center"');                          // row.verticalAlign
    expect(html).toContain('data-cell-align="end"');                              // column.verticalAlign
    expect(html).toContain('--press-cell-gap:var(--press-space-7)');              // column.gap spacious
    expect(html).toMatch(/<main[^>]*data-press-stack[^>]*--press-tree-gap:var\(--press-space-3\)/); // page.gap
  });

  it('lets a node container attr override the site default', () => {
    const layout: LayoutDefaults = {
      page: {},
      row: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      column: { verticalAlign: 'top' },
    };
    const body = tree([{
      id: 'r', type: 'row', container: { width: 'prose' },
      children: [{ id: 'c', type: 'column', span: { base: 12 }, children: [paragraph('p', 'x')] }],
    }]);
    const html = renderToStaticMarkup(createElement(TreeRenderer, { body, site: site({ layout }) }));
    expect(html).toContain('data-max-width="prose"');   // node wins
    expect(html).toContain('data-align-items="center"'); // untouched attr still inherits the site
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/tree/`
Expected: FAIL — `Expected 1 arguments, but got 2` on the picker calls (vitest reports the runtime effect: the site-default assertions get the engine values instead), and the new renderer test's `data-max-width="full"` assertion fails.

- [ ] **Step 3: Rewrite the pickers**

In `packages/web/src/tree/container-attrs.ts`, update the header docblock's last sentence and every picker. The file below `spanFor` becomes:

```ts
/** Semantic gap → GridGap tiers: a 12-track grid carries 11 interior gaps, so 'spacious' tier-scales. */
const GAP_TIERS: Record<Gap, Responsive<GridGap>> = {
  compact: 'sm',
  normal: 'md',
  spacious: { base: 'md', lg: 'lg' },
};

export const rowGap = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): Responsive<GridGap> =>
  GAP_TIERS[attrs?.gap ?? d.gap ?? 'normal'];

const ALIGN_ITEMS: Record<NonNullable<ContainerAttrs['verticalAlign']>, GridAlignItems> = {
  top: 'start',
  center: 'center',
  bottom: 'end',
};

export const rowAlign = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): GridAlignItems =>
  ALIGN_ITEMS[attrs?.verticalAlign ?? d.verticalAlign ?? 'top'];

export const rowWidth = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): ContainerMaxWidth =>
  attrs?.width ?? d.width ?? 'lg';

/** Stack rhythm (layout root / column cells): a CSS space token consumed by theme.css stack rules. */
export const STACK_GAPS: Record<Gap, string> = {
  compact: 'var(--press-space-3)',
  normal: 'var(--press-space-5)',
  spacious: 'var(--press-space-7)',
};

/** undefined when neither the node nor the site declares a gap — the renderer then
 *  emits NO stack attr and legacy per-block margins apply. `d` is deliberately the
 *  narrow `Pick`: this serves BOTH `layout.page` and `layout.column`. */
export const stackGap = (attrs: ContainerAttrs | undefined, d: Pick<ContainerAttrs, 'gap'>): string | undefined => {
  const gap = attrs?.gap ?? d.gap;
  return gap ? STACK_GAPS[gap] : undefined;
};

/** Cell content placement; 'top' is the flex default so it emits nothing. */
export const cellAlign = (
  attrs: ContainerAttrs | undefined,
  d: LayoutDefaults['column'],
): 'center' | 'end' | undefined => {
  const align = attrs?.verticalAlign ?? d.verticalAlign;
  return align === 'center' ? 'center' : align === 'bottom' ? 'end' : undefined;
};
```

Update the import on line 8 and the docblock's closing sentence:

```ts
import type { ColumnNode, ContainerAttrs, Gap, LayoutDefaults } from '@ogs-tech/press-shared';
```

Replace the docblock line `* Every picker treats an ABSENT attr as the engine default.` with:

```
 * Resolution order per attr: the NODE's own value, then the site default for that
 * tree level (CMS-owned `LayoutDefaults`, layout-defaults spec §5), then a trailing
 * literal that exists ONLY as a type terminator — `ContainerAttrs` keys are
 * optional, so TS needs a total value. The literal is never a second source of
 * truth; `DEFAULT_LAYOUT` is.
```

- [ ] **Step 4: Thread the defaults through `TreeRenderer`**

In `packages/web/src/tree/tree-renderer.tsx`:

Line 10 becomes:

```tsx
import type { ColumnNode, LayoutDefaults, Node, RowNode } from '@ogs-tech/press-shared';
```

Replace `ColumnView`, `RowView`, `NodeList` and the body of `TreeRenderer` (lines 43-119) with:

```tsx
function ColumnView({ column, registry, layout }: { column: ColumnNode; registry: Registry; layout: LayoutDefaults }) {
  const gap = stackGap(column.container, layout.column);
  const align = cellAlign(column.container, layout.column);
  const style = gap ? ({ ['--press-cell-gap' as string]: gap } as CSSProperties) : undefined;
  return (
    <Column span={spanFor(column)}>
      <div data-press-cell="" data-cell-align={align} style={style}>
        <NodeList nodes={column.children} registry={registry} layout={layout} top={false} />
      </div>
    </Column>
  );
}

function RowView({ row, registry, layout, top }: { row: RowNode; registry: Registry; layout: LayoutDefaults; top: boolean }) {
  const grid = (
    <Grid gap={rowGap(row.container, layout.row)} alignItems={rowAlign(row.container, layout.row)}>
      {row.children.map((column) => (
        <ColumnView key={column.id} column={column} registry={registry} layout={layout} />
      ))}
    </Grid>
  );
  // width applies to top-level rows only (Spec §3); nested rows fill their cell.
  if (!top) return grid;
  return (
    <Container as="section" maxWidth={rowWidth(row.container, layout.row)}>
      {grid}
    </Container>
  );
}

function NodeList({ nodes, registry, layout, top }: { nodes: Node[]; registry: Registry; layout: LayoutDefaults; top: boolean }) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'block') return <BlockView key={node.id} node={node} registry={registry} />;
        if (node.type === 'row') return <RowView key={node.id} row={node} registry={registry} layout={layout} top={top} />;
        // A stray column never survives the validator; belt-and-braces skip.
        return null;
      })}
    </>
  );
}

export function TreeRenderer({ body, site, components = {} }: TreeRendererProps) {
  const registry: Registry = { ...atomBlocks, ...organismBlocks, ...components };
  // Site layout defaults ride alongside `registry` as an explicit prop, not React
  // context: this subtree is server-first and uses no context today, and four
  // signatures cost less than introducing a provider.
  const layout = site.layout;
  const { value: tree, errors } = validatePressTree(body);
  if (!tree && process.env.NODE_ENV !== 'production') {
    console.warn('[press/web] malformed composition tree — rendering empty body', errors);
  }
  const brand = { name: site.brand.name, logo: site.brand.logo };
  const resolved: ResolvedTree = tree
    ? resolveTree(tree, site)
    : {
        // Malformed body (Spec §7): body fails to empty, chrome still inherits.
        header: hydrateEngineBlocks(site.pageDefaults.header, brand, site.routes.home),
        children: [],
        footer: hydrateEngineBlocks(site.pageDefaults.footer, brand, site.routes.home),
        rootContainer: undefined,
      };
  const gap = stackGap(resolved.rootContainer, layout.page);
  return (
    <>
      <header>
        <NodeList nodes={resolved.header} registry={registry} layout={layout} top />
      </header>
      <main
        data-press-stack={gap ? '' : undefined}
        style={gap ? ({ ['--press-tree-gap' as string]: gap } as CSSProperties) : undefined}
      >
        <NodeList nodes={resolved.children} registry={registry} layout={layout} top />
      </main>
      <footer>
        <NodeList nodes={resolved.footer} registry={registry} layout={layout} top />
      </footer>
    </>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS — including the pre-existing `renders a top-level row as Container>Grid>Column …` case, whose values are unchanged (`DEFAULT_LAYOUT` reproduces the old literals exactly).

- [ ] **Step 6: Commit**

```bash
git add packages/web
git commit -m "feat(web): container pickers resolve node attr > site default > engine literal"
```

---

### Task 6: `watchSchema` compares only the type-relevant slice

**Files:**
- Modify: `packages/web/src/util/watch-schema.ts:28-57`
- Modify: `packages/web/src/util/watch-schema.test.ts` (append cases)

**Interfaces:**
- Consumes: nothing from earlier tasks (the payload shape is Task 3's, but this file never imports it).
- Produces: no exported API change — `watchSchema(opts)` keeps its signature.

**Why this is required, not cleanup.** `/api/press/schema` now serves EDITABLE values, and `watchSchema` compares the entire response body as text — so an editorial layout change would look like a schema change and re-sync types on every save. The generator only walks `contentTypes`/`components`, so the re-sync is a no-op, but it is churn plus a misleading log line. Without this, the feature regresses the dev loop.

- [ ] **Step 1: Write the failing tests**

Append to `describe('watchSchema', …)` in `packages/web/src/util/watch-schema.test.ts`:

```ts
  it('ignores a change confined to editable values (layoutDefaults) — types did not change', async () => {
    const controller = new AbortController();
    const payload = (gap: string) => JSON.stringify({
      tree: { version: 2 },
      contentTypes: { 'plugin::press-cms.page': {} },
      components: { 'preset-atom.paragraph': {} },
      layoutDefaults: { page: {}, row: { gap }, column: {} },
    });
    const bodies = [payload('normal'), payload('spacious'), payload('compact')];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still fires when a component or content-type actually changes', async () => {
    const controller = new AbortController();
    const payload = (components: object) => JSON.stringify({
      tree: { version: 2 },
      contentTypes: {},
      components,
      layoutDefaults: { page: {}, row: {}, column: {} },
    });
    const bodies = [payload({}), payload({ 'custom-organism.callout': {} }), payload({ 'custom-organism.callout': {} })];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('falls back to raw-body comparison for a non-JSON body (cms mid-restart)', async () => {
    const controller = new AbortController();
    const bodies = ['<html>restarting</html>', 'still not json', 'still not json'];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const body = bodies[Math.min(i, bodies.length - 1)];
      i += 1;
      if (i >= bodies.length) controller.abort();
      return okText(body);
    }));

    const onChange = vi.fn();
    await watchSchema({ url: 'http://x', signal: controller.signal, intervalMs: 1, onChange });
    // baseline · changed raw body fires once · unchanged
    expect(onChange).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-web test src/util/watch-schema.test.ts`
Expected: FAIL on the first new case — `expected "spy" to not be called at all, but was called 2 times`.

- [ ] **Step 3: Compare the fingerprint, not the body**

In `packages/web/src/util/watch-schema.ts`, insert above `watchSchema` (after the `delay` helper):

```ts
/**
 * The TYPE-relevant slice of the schema payload. `/api/press/schema` also serves
 * EDITABLE values (`layoutDefaults`, layout-defaults spec §8a), so comparing the
 * raw text would make an editorial change look like a schema change and re-sync
 * types on every layout edit — a no-op for the generator (it walks
 * `contentTypes`/`components` only), but churn and a misleading log line. This
 * preserves the invariant "type-sync runs when TYPES change".
 *
 * A body that does not parse as a JSON OBJECT (a cms mid-restart returns HTML)
 * falls back to the raw text, so that path behaves exactly as it did before:
 * compare, retry, never tear down.
 */
function typeFingerprint(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) return body;
    const { contentTypes, components, tree } = parsed as Record<string, unknown>;
    return JSON.stringify({ contentTypes, components, tree });
  } catch {
    return body;
  }
}
```

Then in the loop, replace line 46:

```ts
        const body = await res.text();
```

with:

```ts
        const body = typeFingerprint(await res.text());
```

Also update the `watchSchema` docblock's first sentence, replacing "whenever the served body differs from the last successful read" with "whenever the TYPE-relevant slice of the served body differs from the last successful read (see `typeFingerprint`)".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-web test src/util/watch-schema.test.ts`
Expected: PASS — all seven cases (the four pre-existing ones still pass: their `'A'`/`'B'`/`'C'` bodies are not JSON objects, so they compare raw).

- [ ] **Step 5: Commit**

```bash
git add packages/web
git commit -m "fix(web): type-sync watcher ignores editable schema values"
```

---

### Task 7: Builder pure helpers — labels, `patchContainer`, `layoutDefaultsOf`

**Files:**
- Create: `packages/cms/admin/src/lib/palette-labels.test.ts`
- Modify: `packages/cms/admin/src/lib/palette-labels.ts:1-16` (imports/header), append the two functions
- Modify: `packages/cms/admin/src/lib/form-model.ts:1-8,66-74`
- Modify: `packages/cms/admin/src/lib/tree-ops.ts:9,135-151`
- Modify: `packages/cms/admin/src/lib/tree-ops.test.ts` (append cases)

**Interfaces:**
- Consumes: `ContainerKey`, `LayoutDefaults`, `DEFAULT_LAYOUT`, `ContainerAttrs` (Task 1); `PressSchema.layoutDefaults` (Task 1).
- Produces:
  - `containerFieldLabel(nodeType: 'layout' | 'row' | 'column', key: ContainerKey): string`
  - `containerOptionLabel(key: ContainerKey, value: string | undefined): string`
  - `layoutDefaultsOf(schema: PressSchema): LayoutDefaults`
  - `patchContainer(container: ContainerAttrs | undefined, key: ContainerKey, value: string | undefined): ContainerAttrs | undefined`
  - `setContainerAttr` keeps its signature, with `key` now typed `ContainerKey`.

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/admin/src/lib/palette-labels.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { containerFieldLabel, containerOptionLabel } from './palette-labels';

describe('containerFieldLabel', () => {
  it('names `gap` per LEVEL — two different physical axes, never one shared label', () => {
    expect(containerFieldLabel('row', 'gap')).toBe('Column gap');
    expect(containerFieldLabel('column', 'gap')).toBe('Vertical rhythm');
    expect(containerFieldLabel('layout', 'gap')).toBe('Vertical rhythm');
  });

  it('matches the Site Settings field labels verbatim (the traceability contract)', () => {
    expect(containerFieldLabel('row', 'width')).toBe('Width');
    expect(containerFieldLabel('row', 'verticalAlign')).toBe('Vertical align');
    expect(containerFieldLabel('column', 'verticalAlign')).toBe('Content align');
  });

  it('degrades to the generic field label for a level/key pair with no entry', () => {
    expect(containerFieldLabel('layout', 'verticalAlign')).toBe('Vertical Align');
  });
});

describe('containerOptionLabel', () => {
  it('humanizes the wire tokens an editor cannot read', () => {
    expect(containerOptionLabel('width', 'prose')).toBe('Reading width');
    expect(containerOptionLabel('width', 'lg')).toBe('Content width');
    expect(containerOptionLabel('width', 'full')).toBe('Full bleed');
  });

  it('title-cases the gap and alignment tokens', () => {
    expect(containerOptionLabel('gap', 'compact')).toBe('Compact');
    expect(containerOptionLabel('gap', 'normal')).toBe('Normal');
    expect(containerOptionLabel('gap', 'spacious')).toBe('Spacious');
    expect(containerOptionLabel('verticalAlign', 'top')).toBe('Top');
    expect(containerOptionLabel('verticalAlign', 'bottom')).toBe('Bottom');
  });

  it('names the ABSENT state — a real, nameable default on page/column gap', () => {
    expect(containerOptionLabel('gap', undefined)).toBe('per-block spacing');
    expect(containerOptionLabel('width', undefined)).toBe('per-block spacing');
  });

  it('degrades to a title-cased token for an unmapped value', () => {
    expect(containerOptionLabel('gap', 'roomy')).toBe('Roomy');
  });
});
```

Append to `packages/cms/admin/src/lib/tree-ops.test.ts`:

```ts
describe('patchContainer', () => {
  it('adds a key to an absent container', () => {
    expect(patchContainer(undefined, 'gap', 'compact')).toEqual({ gap: 'compact' });
  });

  it('replaces one key and leaves siblings alone, without mutating the input', () => {
    const before = { width: 'full', gap: 'normal' } as const;
    expect(patchContainer(before, 'gap', 'spacious')).toEqual({ width: 'full', gap: 'spacious' });
    expect(before).toEqual({ width: 'full', gap: 'normal' });
  });

  it('deletes the key when the value is undefined', () => {
    expect(patchContainer({ width: 'full', gap: 'normal' }, 'gap', undefined)).toEqual({ width: 'full' });
  });

  it('returns undefined when clearing the LAST key — an emptied container disappears', () => {
    expect(patchContainer({ gap: 'normal' }, 'gap', undefined)).toBeUndefined();
    expect(patchContainer(undefined, 'gap', undefined)).toBeUndefined();
  });
});
```

Add `patchContainer` to that file's existing import from `./tree-ops`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — `containerFieldLabel is not a function` / `patchContainer is not a function`.

- [ ] **Step 3: Add the two label functions**

In `packages/cms/admin/src/lib/palette-labels.ts`, add the type import after line 10:

```ts
import type { ContainerKey } from '@ogs-tech/press-shared';
```

and append at the end of the file:

```ts
/**
 * Per-LEVEL container field labels. `gap` is two different physical axes — space
 * BETWEEN columns on a row versus vertical rhythm WITHIN a page/column stack — so
 * there is one label per (node type, key), never one shared label.
 *
 * These strings must match the Site Settings "Layout" field labels verbatim
 * (`preset-config.layout-*`): that correspondence is what makes a builder
 * placeholder like `Site default · Normal` traceable to the field an editor set.
 */
const CONTAINER_FIELD_LABELS: Record<'layout' | 'row' | 'column', Partial<Record<ContainerKey, string>>> = {
  layout: { gap: 'Vertical rhythm' },
  row: { width: 'Width', gap: 'Column gap', verticalAlign: 'Vertical align' },
  column: { gap: 'Vertical rhythm', verticalAlign: 'Content align' },
};

export function containerFieldLabel(nodeType: 'layout' | 'row' | 'column', key: ContainerKey): string {
  return CONTAINER_FIELD_LABELS[nodeType][key] ?? fieldLabel(key);
}

/** Wire token → editorial name. The wire keeps `lg`; an editor reads "Content width". */
const CONTAINER_OPTION_LABELS: Record<ContainerKey, Record<string, string>> = {
  width: { prose: 'Reading width', lg: 'Content width', full: 'Full bleed' },
  gap: { compact: 'Compact', normal: 'Normal', spacious: 'Spacious' },
  verticalAlign: { top: 'Top', center: 'Center', bottom: 'Bottom' },
};

/** `undefined` is a real, nameable state (page/column gap): no stack attribute is
 *  emitted and every block keeps its own margins. */
export function containerOptionLabel(key: ContainerKey, value: string | undefined): string {
  if (value === undefined) return 'per-block spacing';
  return CONTAINER_OPTION_LABELS[key][value] ?? titleize(value);
}
```

- [ ] **Step 4: Add `layoutDefaultsOf`**

In `packages/cms/admin/src/lib/form-model.ts`, change line 8 to:

```ts
import { DEFAULT_LAYOUT, type Attr, type ContainerKey, type LayoutDefaults, type PressSchema } from '@ogs-tech/press-shared';
```

Retype `applicableContainerAttrs`'s return (line 70) and add the helper directly below it:

```ts
export function applicableContainerAttrs(
  nodeType: 'layout' | 'row' | 'column',
  topLevel: boolean,
): ContainerKey[] {
  if (nodeType === 'layout') return ['gap'];
  if (nodeType === 'row') return topLevel ? ['width', 'gap', 'verticalAlign'] : ['gap', 'verticalAlign'];
  return ['gap', 'verticalAlign'];
}

/** The site layout defaults the served schema carries — the ONE `?? DEFAULT_LAYOUT`
 *  in the admin, so an older cms that omits the key degrades identically everywhere. */
export const layoutDefaultsOf = (schema: PressSchema): LayoutDefaults => schema.layoutDefaults ?? DEFAULT_LAYOUT;
```

- [ ] **Step 5: Extract `patchContainer`**

In `packages/cms/admin/src/lib/tree-ops.ts`, change line 9 to:

```ts
import type { BlockNode, ColumnNode, ColumnSpan, ContainerAttrs, ContainerKey, Node, RowNode } from '@ogs-tech/press-shared';
```

and replace `setContainerAttr` (lines 135-151) with:

```ts
/**
 * The container-attr patch RULE, shared by the path-addressed `setContainerAttr`
 * below and the root-addressed layout-node call in builder-input: setting
 * `undefined` deletes the key, and an emptied container disappears entirely so a
 * cleared node never persists `container: {}`. Pure — never mutates its input.
 */
export function patchContainer(
  container: ContainerAttrs | undefined,
  key: ContainerKey,
  value: string | undefined,
): ContainerAttrs | undefined {
  const next = { ...(container ?? {}) } as Record<string, unknown>;
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length === 0 ? undefined : (next as ContainerAttrs);
}

export function setContainerAttr(
  forest: Forest,
  path: NodePath,
  key: ContainerKey,
  value: string | undefined,
): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type === 'block') throw new Error('[press-cms] blocks carry no container attrs');
    const container = patchContainer(node.container, key, value);
    const next = { ...node } as Node & { container?: ContainerAttrs };
    if (container) next.container = container;
    else delete next.container;
    return next as Node;
  });
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:front`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): builder label + container-patch helpers for site layout defaults"
```

---

### Task 8: The builder names the site default

**Files:**
- Modify: `packages/cms/admin/src/components/tree-editor.tsx:12-40` (imports/consts), `:44-54` (`TreeCtx`), `:97-140` (`ContainerSection`), `:304-310` (`ColumnCard`), `:344-349` (`RowCard`), `:406-437` (`TreeEditor`)
- Modify: `packages/cms/admin/src/components/tree-editor.test.tsx` (append a describe)

**Interfaces:**
- Consumes: `containerFieldLabel`, `containerOptionLabel`, `layoutDefaultsOf`, `patchContainer` (Task 7); `CONTAINER_ENUMS`, `ContainerKey`, `ContainerAttrs`, `LayoutDefaults` (Task 1).
- Produces: `ContainerSection` is now EXPORTED from `tree-editor.tsx` with props `{ nodeType: 'layout' | 'row' | 'column'; topLevel: boolean; container: ContainerAttrs | undefined; defaults: Partial<ContainerAttrs>; disabled?: boolean; onSet(key: ContainerKey, value: string | undefined): void }`. `TreeEditorProps` is UNCHANGED — the defaults are derived from the `schema` prop it already receives, so no call site changes.

- [ ] **Step 1: Write the failing test**

Append to `packages/cms/admin/src/components/tree-editor.test.tsx`:

```tsx
/** Opens every collapsed "Layout options" section currently in the DOM. */
const openLayoutOptions = async (): Promise<void> => {
  const toggles = [...container.querySelectorAll('[data-press-container-toggle]')] as HTMLButtonElement[];
  for (const toggle of toggles) await act(async () => { toggle.click(); });
};

describe('TreeEditor container sections', () => {
  const forest = (): Forest => [newBlockNode('preset-organism.hero'), newRowNode()];

  it('names the SITE default in every placeholder and never says "engine default"', async () => {
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={SCHEMA} onChange={() => {}} MediaField={MediaField} />);
    });
    await act(async () => { buttonByText(container, 'Expand all').click(); });
    await openLayoutOptions();

    const text = container.textContent ?? '';
    expect(text).not.toContain('engine default');
    expect(text).toContain('Site default · Content width');     // row width  ← DEFAULT_LAYOUT lg
    expect(text).toContain('Site default · Normal');             // row gap    ← DEFAULT_LAYOUT normal
    expect(text).toContain('Site default · Top');                // vertical alignment ← top
    expect(text).toContain('Site default · per-block spacing');  // column gap ← absent by default
  });

  it('labels the same `gap` key per level — "Column gap" on a row, "Vertical rhythm" in a column', async () => {
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={SCHEMA} onChange={() => {}} MediaField={MediaField} />);
    });
    await act(async () => { buttonByText(container, 'Expand all').click(); });
    await openLayoutOptions();

    const text = container.textContent ?? '';
    expect(text).toContain('Column gap');
    expect(text).toContain('Vertical rhythm');
    expect(text).toContain('Vertical align');
    expect(text).toContain('Content align');
    expect(text).toContain('Width');
  });

  it('reflects the CMS-served layoutDefaults, so the placeholder traces to the field an editor set', async () => {
    const schema = {
      ...SCHEMA,
      layoutDefaults: {
        page: {},
        row: { width: 'full', gap: 'spacious', verticalAlign: 'center' },
        column: { gap: 'compact', verticalAlign: 'bottom' },
      },
    } as unknown as PressSchema;
    await act(async () => {
      render(<TreeEditor forest={forest()} schema={schema} onChange={() => {}} MediaField={MediaField} />);
    });
    await act(async () => { buttonByText(container, 'Expand all').click(); });
    await openLayoutOptions();

    const text = container.textContent ?? '';
    expect(text).toContain('Site default · Full bleed');
    expect(text).toContain('Site default · Spacious');
    expect(text).toContain('Site default · Compact');
    expect(text).toContain('Site default · Bottom');
  });
});
```

(Strapi's `SingleSelect` renders its placeholder as visible text in the trigger, so `textContent` is a valid assertion surface. The OPTION labels are only mounted once a select is opened — those are covered by `palette-labels.test.ts` in Task 7 instead.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test admin/src/components/tree-editor.test.tsx`
Expected: FAIL — `[data-press-container-toggle]` matches nothing, so no fields render and every `Site default · …` assertion fails.

- [ ] **Step 3: Rewrite `ContainerSection`**

In `packages/cms/admin/src/components/tree-editor.tsx`:

Delete the `CONTAINER_OPTIONS` const (lines 36-40) — `CONTAINER_ENUMS` from the shared package is now the single source for the option lists, so the builder selects can never drift from what the validator accepts.

Update the imports (lines 20-30):

```tsx
import type {
  BlockNode, ColumnNode, ContainerAttrs, ContainerKey, LayoutDefaults, PressSchema, RowNode,
} from '@ogs-tech/press-shared';
import { CONTAINER_ENUMS } from '@ogs-tech/press-shared';
import { applicableContainerAttrs, layoutDefaultsOf, paletteGroups } from '../lib/form-model';
import {
  blockIcon, blockLabel, categoryLabel, COLUMN_ICON, containerFieldLabel, containerOptionLabel, ROW_ICON,
} from '../lib/palette-labels';
```

(`fieldLabel` is no longer imported here — `containerFieldLabel` falls back to it internally.)

Add to `TreeCtx` (after `schema`, line 47):

```tsx
  /** Site layout defaults from the served schema — what every placeholder names. */
  layoutDefaults: LayoutDefaults;
```

Replace `ContainerSection` (lines 97-140) with:

```tsx
/**
 * Collapsible "Layout options" — the shared container attrs applicable to this
 * node. An unset select does NOT mean "unknown": its placeholder NAMES the value
 * that will be used (`Site default · Content width`), sourced from the CMS-owned
 * LayoutDefaults, and clearing is phrased as returning to that default. Exported
 * so builder-input can render the layout-root (page-level) section too.
 */
export function ContainerSection({ nodeType, topLevel, container, defaults, disabled, onSet }: {
  nodeType: 'layout' | 'row' | 'column';
  topLevel: boolean;
  container: ContainerAttrs | undefined;
  /** The site defaults for THIS level only — the subset the renderer actually reads. */
  defaults: Partial<ContainerAttrs>;
  disabled?: boolean;
  onSet(key: ContainerKey, value: string | undefined): void;
}) {
  const [open, setOpen] = useState(false);
  const attrs = applicableContainerAttrs(nodeType, topLevel);
  if (attrs.length === 0) return null;
  const activeCount = attrs.filter((k) => container?.[k] != null).length;
  return (
    <Box data-press-container="">
      <Flex gap={1} alignItems="center">
        <IconButton label={open ? 'Hide layout options' : 'Show layout options'} variant="ghost" size="S"
          data-press-container-toggle="" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown /> : <ChevronRight />}
        </IconButton>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          Layout options{activeCount ? ` · ${activeCount}` : ''}
        </Typography>
      </Flex>
      {open ? (
        <Flex direction="column" alignItems="stretch" gap={2} marginTop={2} paddingLeft={6}>
          {attrs.map((key) => (
            <Field.Root key={key} name={key}>
              <Field.Label>{containerFieldLabel(nodeType, key)}</Field.Label>
              <SingleSelect
                placeholder={`Site default · ${containerOptionLabel(key, defaults[key])}`}
                disabled={disabled}
                value={container?.[key] ?? undefined}
                onClear={() => onSet(key, undefined)}
                clearLabel="Use site default"
                onChange={(v) => onSet(key, v ? String(v) : undefined)}
              >
                {CONTAINER_ENUMS[key].map((opt) => (
                  <SingleSelectOption key={opt} value={opt}>{containerOptionLabel(key, opt)}</SingleSelectOption>
                ))}
              </SingleSelect>
            </Field.Root>
          ))}
        </Flex>
      ) : null}
    </Box>
  );
}
```

- [ ] **Step 4: Feed the per-level defaults from the two card call sites**

In `ColumnCard` (line 308), replace the `ContainerSection` element with:

```tsx
        <ContainerSection nodeType="column" topLevel={false} container={column.container}
          defaults={ctx.layoutDefaults.column} disabled={ctx.disabled}
          onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, columnPath, k, v))} />
```

In `RowCard` (line 347), replace it with:

```tsx
            <ContainerSection nodeType="row" topLevel={topLevel} container={node.container}
              defaults={ctx.layoutDefaults.row} disabled={ctx.disabled}
              onSet={(k, v) => ctx.onChange(setContainerAttr(ctx.forest, path, k, v))} />
```

(Both drop the old `as Record<string, unknown> | undefined` casts — `ContainerAttrs` is now the prop type.)

- [ ] **Step 5: Source the defaults once in `TreeEditor`**

In `TreeEditor` (line 415), replace the ctx construction with:

```tsx
  const ctx: TreeCtx = {
    forest, schema, disabled, onChange, MediaField, openIds, toggleOpen,
    layoutDefaults: layoutDefaultsOf(schema),
  };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:front`
Expected: PASS — including the pre-existing span-controls test.

- [ ] **Step 7: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): builder placeholders name the site default, per-level labels"
```

---

### Task 9: Body-level "Layout options" (the page override)

**Files:**
- Modify: `packages/cms/admin/src/components/builder-input.tsx:15-19` (imports), `:178-192` (the tree-mode return)
- Modify: `packages/cms/admin/src/components/builder-input.test.tsx` (append a case)

**Interfaces:**
- Consumes: `ContainerSection` (Task 8, now exported), `layoutDefaultsOf` and `patchContainer` (Task 7), `ContainerKey` (Task 1).
- Produces: no new exports. `page.body`'s stored tree may now carry `root.container.gap`.

**Why in scope.** `LayoutNode.container` already exists on the wire and is already read by `TreeRenderer` (`--press-tree-gap`); only the builder UI was missing. Shipping a site default for the one level that cannot override it would read as a bug. This also activates the `applicableContainerAttrs('layout') → ['gap']` branch that no caller reaches today. Slots mode (Site Settings `pageDefaults`) has no root node and is unaffected.

- [ ] **Step 1: Write the failing test**

Append to `describe('BuilderInput (tree mode)', …)` in `packages/cms/admin/src/components/builder-input.test.tsx`:

```tsx
  it('offers page-level Layout options in the Body section, naming the site default', async () => {
    await act(async () => {
      render(<BuilderInput name="body" attribute={{}} value={undefined} onChange={() => {}} />);
    });
    await flush();

    const body = container.querySelector('[data-press-slot="body"]') as HTMLElement;
    // the body's OWN container section, before any node card is expanded
    const toggle = body.querySelector('[data-press-container-toggle]') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    await act(async () => { toggle.click(); });

    // only `gap` applies to the layout root — no Width, no alignment
    expect(body.textContent).toContain('Vertical rhythm');
    expect(body.textContent).toContain('Site default · per-block spacing');
    expect(body.textContent).not.toContain('Width');
  });

  it('names a CMS-served page gap in the body placeholder', async () => {
    (globalThis.fetch as any) = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        String(url).includes('/api/press/schema')
          ? { ...SCHEMA, layoutDefaults: { page: { gap: 'spacious' }, row: {}, column: {} } }
          : { data: [] },
    }));
    await act(async () => {
      render(<BuilderInput name="body" attribute={{}} value={undefined} onChange={() => {}} />);
    });
    await flush();

    const body = container.querySelector('[data-press-slot="body"]') as HTMLElement;
    await act(async () => { (body.querySelector('[data-press-container-toggle]') as HTMLButtonElement).click(); });
    expect(body.textContent).toContain('Site default · Spacious');
  });
```

(The emitted-value path — clearing/selecting writes `tree.root.container` — is covered by `patchContainer`'s unit tests in Task 7. Driving a Radix-portalled `SingleSelect` option click is not simulated here: it needs pointer-event APIs jsdom does not provide, which is why every existing builder test interacts through buttons only.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test admin/src/components/builder-input.test.tsx`
Expected: FAIL — `expect(toggle).not.toBeNull()` fails; the Body section has no container toggle.

- [ ] **Step 3: Render the body-level section**

In `packages/cms/admin/src/components/builder-input.tsx`, update the imports (lines 15-19):

```tsx
import type { ContainerKey, Node, PressSchema, PressTree, Slot } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { fetchPressSchema } from '../lib/press-data';
import { layoutDefaultsOf } from '../lib/form-model';
import { patchContainer, type Forest } from '../lib/tree-ops';
import { ContainerSection, TreeEditor } from './tree-editor';
```

Then replace the tree-mode tail (lines 178-192) with:

```tsx
  const tree: PressTree = isRecord(parsed) && isRecord(parsed.root) ? (parsed as unknown as PressTree) : emptyTree();
  const setRoot = (patch: Partial<PressTree['root']>): void => emit({ ...tree, root: { ...tree.root, ...patch } });
  /** Root-addressed container patch — same rule as the path-addressed
   *  setContainerAttr (an emptied container disappears), via patchContainer. */
  const setRootContainer = (key: ContainerKey, value: string | undefined): void => {
    const container = patchContainer(tree.root.container, key, value);
    const root = { ...tree.root };
    if (container) root.container = container;
    else delete root.container;
    emit({ ...tree, root });
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={4} data-press-builder="tree">
      {label ? <Typography variant="beta" tag="h2">{label}</Typography> : null}
      <SlotEditor title="Header" slot={tree.root.header} schema={schema} disabled={disabled} onChange={(header) => setRoot({ header })} />
      <Section dataSlot="body" title="Body">
        <>
          {/* The layout ROOT's own attrs — only `gap` applies (rhythm between
              top-level children). Slots mode has no root node, so this is
              tree-mode only. */}
          <ContainerSection nodeType="layout" topLevel container={tree.root.container}
            defaults={layoutDefaultsOf(schema).page} disabled={disabled} onSet={setRootContainer} />
          <Box marginTop={3}>
            <TreeEditor forest={tree.root.children as Forest} schema={schema} disabled={disabled}
              onChange={(children) => setRoot({ children: children as Node[] })} MediaField={MediaField} />
          </Box>
        </>
      </Section>
      <SlotEditor title="Footer" slot={tree.root.footer} schema={schema} disabled={disabled} onChange={(footer) => setRoot({ footer })} />
      {footer}
    </Flex>
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:front`
Expected: PASS — including the pre-existing "renders slot sections + body forest and emits a tree…" case.

- [ ] **Step 5: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): page-level Layout options in the composition builder body"
```

---

### Task 10: Seed copy — "Grid layout" → "Grid system"

**Files:**
- Modify: `packages/cli/templates/cms/scripts/seed-content.mjs:41,62,63,67`
- Modify: `packages/cli/templates/cms/scripts/seed.mjs:8`
- Modify: `apps/playground/packages/cms/scripts/seed-content.mjs:41,62,63,67`
- Modify: `apps/playground/packages/cms/scripts/seed.mjs:8`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable — copy only. The demo home page's second heading reads "Grid system", matching the feature's name across the specs.

The existing CLI seed-regression guard (`packages/cli/src/create/seed-content.test.ts`) validates tree SHAPE, not heading strings — verified: no test asserts `'Grid layout'`. The playground copies are committed scaffold output and must stay byte-identical to the templates.

- [ ] **Step 1: Confirm no test depends on the old string**

Run: `grep -rn "Grid layout" packages apps --include=*.ts --include=*.tsx --include=*.mjs`
Expected: only the four `seed-content.mjs` / `seed.mjs` hits listed above (no `.test.ts` hit).

- [ ] **Step 2: Edit the CLI template**

In `packages/cli/templates/cms/scripts/seed-content.mjs`:

- line 41: `* blocks + a note on the wider palette) and the GRID LAYOUT (a 50-50 row split` → `... and the GRID SYSTEM (a 50-50 row split`
- line 62: `block('preset-atom.heading', { text: 'Grid layout', level: '2' }),` → `text: 'Grid system'`
- line 63: `// Grid layout: two columns, stacked on phones (base 12) and 50/50 on desktop (md 6).` → `// Grid system: two columns, …`
- line 67: `content: 'Rows and columns are the grid layout. Here an image fills the left column and this paragraph the right — a 12/6 span split. Compose the rest in the builder.',` → `'Rows and columns are the grid system. Here an image fills …'`

In `packages/cli/templates/cms/scripts/seed.mjs` line 8: `// grid layout without being a pre-filled kitchen sink.` → `// grid system without being a pre-filled kitchen sink.`

- [ ] **Step 3: Mirror into the committed scaffold output**

Apply the identical four + one edits to `apps/playground/packages/cms/scripts/seed-content.mjs` and `apps/playground/packages/cms/scripts/seed.mjs`.

Verify the two copies agree:

```bash
diff packages/cli/templates/cms/scripts/seed-content.mjs apps/playground/packages/cms/scripts/seed-content.mjs
diff packages/cli/templates/cms/scripts/seed.mjs apps/playground/packages/cms/scripts/seed.mjs
```
Expected: no output from either diff.

- [ ] **Step 4: Run the seed guard**

Run: `pnpm --filter @ogs-tech/create-press test`
Expected: PASS (shape assertions unaffected).

- [ ] **Step 5: Commit**

```bash
git add packages/cli apps/playground
git commit -m "docs(cli): seed copy says Grid system, matching the feature name"
```

---

### Task 11: Documentation, changeset, and the full gate

**Files:**
- Modify: `CLAUDE.md:89-91` and `:392-393`
- Create: `.changeset/site-layout-defaults.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the release note and the living architectural reference.

- [ ] **Step 1: Update the composition-trees / layout-primitives note**

In `CLAUDE.md`, replace lines 89-91:

```
  "responsiveness never in the JSON" rule. Everything else stays code-side:
  `container` attrs are editorial intents only, mapped to `Responsive<T>`
  layout-primitive props by `web/src/tree/container-attrs.ts` (`GAP_TIERS`).
```

with:

```
  "responsiveness never in the JSON" rule. Everything else stays code-side:
  `container` attrs are editorial intents only, mapped to `Responsive<T>`
  layout-primitive props by `web/src/tree/container-attrs.ts` (`GAP_TIERS`).
  Their DEFAULTS are no longer code-side: an undeclared attr resolves against
  CMS-owned `LayoutDefaults` (`shared/src/layout-defaults.ts` — one group per
  tree level, `page`/`row`/`column`, because a row's `gap` is the space BETWEEN
  columns while a page/column `gap` is stack rhythm), threaded to the pickers as
  `site.layout` by `TreeRenderer`. Resolution order per attr: node value → site
  default → a trailing literal that exists only as a TS type terminator.
  `resolveLayoutDefaults` sanitizes per key (unknown value ⇒ engine default for
  that key, never a document failure) and the whole key FAILS TO DEFAULT, not to
  empty — `DEFAULT_LAYOUT`, the `DEFAULT_THEME` precedent. The builder names the
  resolved value in every placeholder (`Site default · Content width`) instead of
  the word "engine", reading it off the existing `/api/press/schema` fetch
  (`layoutDefaults`) — which is why `watchSchema` now compares only the
  type-relevant slice of that payload.
```

- [ ] **Step 2: Update the Site Settings enumeration**

In `CLAUDE.md`, replace lines 392-393:

```
- **Identity, SEO, theme color/radius VALUES, and the two `pageDefaults` composition-tree
  slots (header/footer)** live in the CMS **"Site Settings"** single type — edited in the
```

with:

```
- **Identity, SEO, theme color/radius VALUES, layout DEFAULTS (`preset-config.layout`
  → `layout-page`/`layout-row`/`layout-column`, mirrored 1:1 by `LayoutDefaults`),
  and the two `pageDefaults` composition-tree
  slots (header/footer)** live in the CMS **"Site Settings"** single type — edited in the
```

- [ ] **Step 3: Write the changeset**

Create `.changeset/site-layout-defaults.md`:

```markdown
---
'@ogs-tech/press-shared': minor
'@ogs-tech/press-cms': minor
'@ogs-tech/press-web': major
'@ogs-tech/create-press': patch
---

feat: site-level layout defaults — the builder speaks editorial, not engine

The three container-attr fallbacks that were hardcoded in the renderer
(`attrs?.width ?? 'lg'`, `gap ?? 'normal'`, `verticalAlign ?? 'top'`) are now
CMS-owned, edited in a new **Layout** section on Site Settings and picked up on
the next ISR cycle — no engine edit, no redeploy. The composition builder stops
saying `engine default` and NAMES the resolved value instead
(`Site default · Content width`), with humanized option labels
(`prose` → "Reading width", `lg` → "Content width", `full` → "Full bleed") and
per-level field names, so `gap` reads "Column gap" on a row and "Vertical
rhythm" in a column — the two different physical axes it actually is.

**press-shared** (minor, additive): new `LayoutDefaults` / `DEFAULT_LAYOUT` /
`resolveLayoutDefaults` (`src/layout-defaults.ts`), one group per tree level
(`page` / `row` / `column`, each the subset of `ContainerAttrs` that applies
there); the validator's three private enum lists become one exported
`CONTAINER_ENUMS`; `ContainerKey` is exported; `PressSchema` gains an OPTIONAL
`layoutDefaults`. No wire migration — `PRESS_TREE_VERSION` stays `2`.

**press-cms** (minor, additive): four new `preset-config.layout*` components and
a `layout` field on Site Settings; `GET /api/press/schema` now also carries
`layoutDefaults` (read via the new `readLayoutDefaults`, failing to
`DEFAULT_LAYOUT` so a pre-bootstrap database still serves a complete payload);
`GET /api/site-setting` deep-populates the group. The builder gains a
page-level "Layout options" section writing `tree.root.container` — the wire
field `TreeRenderer` already read but no UI could set.

**press-web** (MAJOR): `ResolvedPressConfig` gains a REQUIRED `layout:
LayoutDefaults` key (the `urn` / `pageDefaults` / `plugins` discipline). Every
`container-attrs.ts` picker takes the site defaults for its level as a second
argument (`rowGap(attrs, layout.row)`, `stackGap(attrs, layout.page)`, …) and
`TreeRenderer` threads `site.layout` beside `registry`. `mapSiteSettings`
resolves the key FAIL-TO-DEFAULT, joining `theme` and `plugins.cookieConsent`
rather than the identity/SEO fail-to-empty rule: an unreachable CMS renders with
the engine's layout, not with none. `watchSchema` now compares the
type-relevant slice of the schema payload (`contentTypes`/`components`/`tree`)
instead of the raw body, so editing a layout default no longer looks like a type
change; a non-JSON body (a cms mid-restart) still compares raw.

**create-press** (patch): the demo home page's second heading and its
surrounding copy say "Grid system", the feature's name everywhere else.
```

- [ ] **Step 4: Run the full gate**

```bash
pnpm -r --if-present typecheck
pnpm -r test
pnpm --filter @ogs-tech/press-cms test:ts:back
pnpm --filter @ogs-tech/press-cms test:ts:front
pnpm build
```
Expected: all green. `pnpm build` must succeed because `press-cms` compiles its
plugin bundle — and `strapi develop` loads `dist/`, not TS source, so a stale
build would silently serve the pre-feature schema in the playground.

- [ ] **Step 5: Verify end-to-end in the playground (manual)**

```bash
pnpm --filter @ogs-tech/press-cms build
pnpm dev
```

Then in `http://localhost:1337/admin`:
1. Site Settings → **Layout** → Row → set **Width** = `full`, **Column gap** = `spacious`. Save.
2. Content Manager → Pages → home → **Composition** → expand the row → **Layout options**: the Width placeholder now reads `Site default · Full bleed` and the gap placeholder `Site default · Spacious`.
3. The Body section's own **Layout options** shows only **Vertical rhythm**, placeholder `Site default · per-block spacing`.
4. `http://localhost:3000` — the seeded 50/50 row is now full-bleed with wider column gaps; no redeploy, within one ISR cycle (~60s) or on reload in dev.
5. Watch the `press dev` log while saving a Layout change: NO `re-syncing types` line (that is Task 6's invariant).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .changeset
git commit -m "docs: site layout defaults in CLAUDE.md + changeset"
```

---

## Self-Review

**Spec coverage**

| Spec section | Covered by |
| --- | --- |
| §3 `LayoutDefaults` / `DEFAULT_LAYOUT` / `resolveLayoutDefaults`, enum reuse, `PressSchema` key, stale header comment | Task 1 |
| §4 four components + registration + Site Settings field + populate | Task 2 |
| §4 `readLayoutDefaults` + controller merge (serializeSchema untouched) | Task 3 |
| §5 `SiteSettingsData.layout` / `ResolvedPressConfig.layout` / mapper fail-to-default | Task 4 |
| §5 picker signatures + `TreeRenderer` threading (`spanFor` untouched) | Task 5 |
| §6 `TreeCtx.layoutDefaults`, placeholder + `clearLabel`, `containerFieldLabel` / `containerOptionLabel`, `patchContainer` extraction | Tasks 7, 8 |
| §6 Body "Layout options" activating the `applicableContainerAttrs('layout')` branch | Task 9 |
| §7 seed copy (both template and playground mirror) | Task 10 |
| §8a `watchSchema` slice comparison with raw fallback | Task 6 |
| §8b single-node opt-out — accepted, no work | (none, by design) |
| §8c changesets: web major, shared/cms minor | Task 11 |
| §9 test plan (shared / web / cms / cli) | Tasks 1, 3–6, 8–10 |
| §9 gate commands + cms rebuild before playground boot | Task 11 |
| §10 two CLAUDE.md edits | Task 11 |
| §2 "nothing seeded" | Stated in Global Constraints; no task adds a seeder |

**Type consistency** — `ContainerKey` (Task 1) is the key type used by `CONTAINER_ENUMS`, `resolveLayoutDefaults`'s `LEVEL_KEYS`, `applicableContainerAttrs`, `patchContainer`, `setContainerAttr`, `containerFieldLabel`, `containerOptionLabel`, and `ContainerSection.onSet`. `LayoutDefaults['row']` is the picker parameter type in Task 5 and the `defaults` value in Task 8; `stackGap`'s narrower `Pick<ContainerAttrs, 'gap'>` accepts both `layout.page` and `layout.column`. `layoutDefaultsOf` is defined once (Task 7) and used by both `TreeEditor` (Task 8) and `builder-input` (Task 9). `ContainerSection` is exported in Task 8 before Task 9 imports it.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-layout-defaults.md`.
