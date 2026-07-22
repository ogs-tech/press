# Composition Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dynamic-zone composition mechanism engine-wide with a JSON `PressTree` stored in a custom page-builder field — per-page layout root (header/footer/children), rows with columns, full recursion, adopter blocks anywhere.

**Architecture:** `@ogs-tech/press-shared` grows the tree contract + a runtime validator (pure TS) consumed by both sides. `press-cms` swaps `page.body` to a JSON custom field, adds `site-setting.pageDefaults`, keeps components as a pure schema catalog, hydrates media/page refs server-side, and ships a structural tree-editor custom field in the admin. `press-web` replaces `BlockRenderer` with a `TreeRenderer` that maps curated container attrs onto the existing layout primitives.

**Tech Stack:** Strapi 5 plugin (custom field, db lifecycles), Next.js 15 App Router (RSC), React 18, vitest, pure-TS validator (zero deps).

**Spec:** `docs/superpowers/specs/2026-07-20-composition-builder-design.md`

## Decisions locked after spec approval (user-confirmed 2026-07-20)

These refine the spec and are binding for every task below:

1. **Curated plain-text content.** The text atoms' `content` attribute becomes Strapi
   `type: "text"` (a plain string). Interpretation is plain text: a blank line
   separates paragraphs (paragraph/quote); each non-empty line is one item (list).
   No inline formatting in v1. The Strapi `blocks` AST leaves the wire entirely:
   `renderBlocks` / `blocks-content.tsx` and the `BlocksContent`/`BlocksNode`/`BlocksText`
   types are deleted.
2. **Link is a first-class shared descriptor.** New `preset-molecule.link`
   (`label` / `page` relation / `url` / `newTab`). Every linking block references it via a
   `component:` field: `preset-atom.button` (`href`→`link`), `preset-organism.hero`
   (`ctaLabel`/`ctaHref`→`cta`), `preset-organism.cta` (`buttonLabel`/`buttonHref`→`button`),
   `preset-organism.navbar` (`items` become `link[]`). `preset-molecule.nav-item` is
   DELETED — it was exactly a link. The builder renders a published-pages dropdown for the
   `page` relation and stores `{ documentId }`; the cms hydrates `slug` server-side (the
   `{ assetId }` media pattern); the web gets one `resolveLink` + `<PressLink>` resolver.
3. **`@ogs-tech/press-shared` becomes a PUBLISHED package.** It is `private: true` today
   and consumed type-only. The runtime validator makes it a real dependency of press-web
   (adopters install it from npm) — remove `private`, add `publishConfig`, move it to
   press-web `dependencies` (`workspace:*`, rewritten to an exact pin at publish). press-cms
   keeps it as a devDependency so `strapi-plugin build` BUNDLES the validator into dist
   (verified by a grep step in Task 5).
4. **TreeRenderer is layout-by-components.** It emits `<header>` / `<main>{children}</main>` /
   `<footer>`; the App Router `children` slot is the "Outlet". `RootLayout` drops its
   chrome elements.

## Global Constraints

- Node **20.x**, pnpm **10.x**; install/build/test from the repo root.
- **No new runtime dependencies** in any engine package (the validator is pure TS; the admin builder uses plain HTML elements, no `@strapi/design-system` dependency added).
- Breaking wire + palette change is **authorized** (pre-release); **no data migration** anywhere.
- Custom field uid is exactly `plugin::press-cms.builder` (name `builder`, plugin `press-cms`, storage type `json`).
- Tree contract version is the number `1` (`PRESS_TREE_VERSION`); readers reject unknown versions (fail-to-empty).
- Closed enums, exact values: `ratio` ∈ `50-50 | 33-67 | 67-33 | 33-33-33 | 25-25-25-25`; `width` ∈ `prose | lg | full`; `gap` ∈ `compact | normal | spacious`; `verticalAlign` ∈ `top | center | bottom`. Raw `Span`/`GridGap` scales are never exposed to the CMS.
- Node `id`s are builder-minted strings (`crypto.randomUUID()`), never URN entities.
- The engine never names individual adopter blocks; `custom-*` categories remain the whole extension-point contract.
- Quality gate per task: `pnpm --filter <pkg> test` + the package's typecheck (`typecheck` script, or `test:ts:back` / `test:ts:front` for cms). There is no eslint.
- Every commit message follows the repo's `feat:`/`refactor:`/`docs:` convention and ends with the Claude co-author trailer used by this session's tooling.
- `Spec §N` comments in code refer to `docs/superpowers/specs/2026-07-20-composition-builder-design.md` sections.

## File Structure (locked decomposition)

```
packages/shared/src/
  index.ts                 (modified: re-export tree + validator; PressSchema gains tree version)
  tree.ts                  (new: PressTree/LayoutNode/RowNode/ColumnNode/BlockNode/Slot/ContainerAttrs)
  validate-tree.ts         (new: validatePressTree/validateNodeArray, sanitizing)
  validate-tree.test.ts    (new)
packages/cms/server/src/
  components/molecules/link.json          (new)   molecules/nav-item.json, molecules/column.json (DELETED)
  components/atoms/{paragraph,list,quote,button}.json   (modified: curated text / link)
  components/organisms/{hero,cta,navbar}.json           (modified: link fields)
  components/organisms/columns.json                     (DELETED)
  components/layout/{container,row,column}.json         (new: preset-layout descriptors)
  content-types/page/schema.json          (modified: body → customField)
  content-types/site-setting/schema.json  (modified: header/footer DZs → pageDefaults customField)
  register.ts                             (modified: customFields.register; admitCustomBlocks dropped)
  lib/inject-components.ts                (modified: palette list; admitCustomBlocks deleted)
  lib/dz-populate.ts + .test.ts           (DELETED)
  lib/serialize-schema.ts                 (modified: full palette + tree version)
  lib/hydrate-tree.ts + .test.ts          (new: media/page-ref hydration walker)
  lib/serve-hydrated.ts                   (new: resolver construction from strapi queries)
  lib/validate-write.ts + .test.ts        (new: lifecycle guards)
  lib/seed-site-setting.ts                (modified: pageDefaults seeding)
  bootstrap.ts                            (modified: lifecycle subscribe)
  controllers/{page,site-setting}.ts      (modified: no DZ populate; hydration)
packages/cms/admin/src/
  index.ts                                (modified: custom field registration + labels)
  lib/tree-ops.ts + .test.ts              (new: pure forest operations)
  lib/form-model.ts + .test.ts            (new: Attr → field descriptors; container applicability)
  lib/press-data.ts                       (new: schema + pages fetch cache)
  components/builder-input.tsx            (new: the custom field Input)
  components/tree-editor.tsx              (new: recursive node editor)
  components/node-form.tsx                (new: registry-driven block form)
  components/builder-input.test.tsx       (new: jsdom smoke tests)
packages/web/src/
  link.ts + link.test.ts                  (new: PressLinkData/ResolvedLink/resolveLink/coerceLink)
  press-link.tsx                          (new: <PressLink> anchor renderer)
  blocks/{paragraph,list,quote,button}.tsx (modified: plain text / link)
  blocks/blocks-content.tsx + .test.ts    (DELETED)
  sections/{hero,cta}.tsx                 (modified: link fields)
  sections/columns.tsx + .test.ts         (DELETED)
  chrome/navbar.tsx                       (modified: resolved link cta shape)
  tree/container-attrs.ts + .test.ts      (new: RATIO_SPANS/GAP_TIERS/STACK_GAPS/ALIGN_ITEMS + pickers)
  tree/resolve-slots.ts + .test.ts        (new: slot matrix + engine-block hydration)
  tree/tree-renderer.tsx + .test.tsx      (new: TreeRenderer)
  block-renderer.tsx + .test.tsx          (DELETED)   block-key.ts + .test.ts (DELETED)
  organism-blocks.ts                      (modified: columns removed)
  types/base.ts                           (modified: string content, link fields, PressTree body)
  map-site-settings.ts                    (modified: pageDefaults raw slots)
  config/types.ts                         (modified: pageDefaults, ResolvedLink)
  generator/generate.ts + .test.ts        (modified: PressTree body, no __component/id, PressPageRef)
  index.ts                                (modified exports)
packages/web/theme.css                    (modified: prose rescope, stack/cell rules, columns rules deleted)
packages/web/templates/host/app/layout.tsx            (modified: chrome dropped)
packages/web/templates/host/app/[[...slug]]/page.tsx  (modified: TreeRenderer)
packages/web/templates/host/next.config.ts            (modified: transpile press-shared)
packages/cli/templates/cms/scripts/seed-content.mjs   (new: exported seed data, testable)
packages/cli/templates/cms/scripts/seed.mjs           (modified: tree seed)
packages/cli/templates/project/packages/shared/types/generated.ts (modified baseline)
packages/cli/src/create/seed-content.test.ts          (new: seed-shape regression guard)
.changeset/composition-builder.md         (new)
CLAUDE.md                                 (modified: architecture sections rewritten)
```

Execution order is the task order: shared → cms server → cms admin → web → CLI/integration. `pnpm dev` stays broken between Phase 2 and the end of Phase 4 — that is expected for a wire-breaking refactor; per-package tests are the gate until Task 21 re-verifies the whole loop.

---

## Phase 1 — `@ogs-tech/press-shared`: contract + validator

### Task 1: Publishable press-shared + PressTree contract types

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/src/tree.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/vitest.config.ts`

**Interfaces:**
- Consumes: nothing (root of the dependency graph).
- Produces: `PressTree`, `LayoutNode`, `Node`, `RowNode`, `ColumnNode`, `BlockNode`, `Slot`, `ContainerAttrs`, `Ratio`, `Gap`, `VerticalAlign`, `ContainerWidth`, `PRESS_TREE_VERSION` — imported by every later task. `PressSchema` gains optional `tree?: { version: number }`.

- [ ] **Step 1: Make the package publishable and test-ready**

Replace `packages/shared/package.json` with:

```json
{
  "name": "@ogs-tech/press-shared",
  "version": "0.1.0",
  "description": "press — wire contract types and pure wire validators shared by the engine packages",
  "license": "MIT",
  "author": "Odenir Gomes",
  "type": "module",
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ogs-tech/press.git",
    "directory": "packages/shared"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" }
  },
  "files": ["src"],
  "scripts": {
    "build": "echo '@ogs-tech/press-shared ships TS source; nothing to build'",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^2.1.0"
  }
}
```

(The `private: true` flag is REMOVED — Decision 3. `files: ["src"]` publishes TS source, the web/shared precedent. Tests must exclude themselves from the published artifact: see `.npmignore` note in Step 2.)

Create `packages/shared/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Keep test files out of the published artifact**

Create `packages/shared/.npmignore`:

```
src/**/*.test.ts
```

(`files: ["src"]` would otherwise ship the vitest suites; `.npmignore` subtracts them. `package.json`/README are always included by npm.)

- [ ] **Step 3: Write the tree contract types**

Create `packages/shared/src/tree.ts`:

```ts
/**
 * The press composition tree — the JSON stored by the `plugin::press-cms.builder`
 * custom field (page `body`) and, as bare `Node[]` slots, by Site Settings
 * `pageDefaults` (Spec §3). Pure wire types: no Strapi, no React.
 *
 * Responsiveness NEVER appears in this JSON — `ratio` and the `container` attrs
 * are editorial intents; the web renderer maps them to Responsive<T> values.
 */

/** Readers reject any other version (fail-to-empty); gates future migrations. */
export const PRESS_TREE_VERSION = 1;

/** Row-only: defines the column split. The closed scale inherited from the retired columns organism. */
export type Ratio = '50-50' | '33-67' | '67-33' | '33-33-33' | '25-25-25-25';
export type Gap = 'compact' | 'normal' | 'spacious';
export type VerticalAlign = 'top' | 'center' | 'bottom';
export type ContainerWidth = 'prose' | 'lg' | 'full';

/**
 * The ONE attribute surface for every children-bearing node (Spec §3). An
 * absent field (or the whole group absent) means the engine default. Attrs
 * that don't apply to a node type are ignored by the renderer and hidden by
 * the builder form — never an error.
 */
export interface ContainerAttrs {
  /** Container tier — top-level Rows only; ignored when nested. */
  width?: ContainerWidth;
  /** Row: track gap; Column/Layout: stack rhythm. */
  gap?: Gap;
  /** Row: aligns cells; Column: content within the cell height. */
  verticalAlign?: VerticalAlign;
}

/**
 * A placed block: `component` is a palette uid (`preset-atom.paragraph`,
 * `custom-organism.callout`); `data` is validated against that component's
 * registry schema. Media inside `data` is a REFERENCE (`{ assetId: number }`),
 * page links are `{ documentId: string }` — the cms hydrates both server-side
 * so the wire never rots (Spec §3).
 */
export interface BlockNode {
  /** Builder-minted (crypto.randomUUID); React keys + builder ops only — never an Entity. */
  id: string;
  type: 'block';
  component: string;
  data: Record<string, unknown>;
}

/** The recursion point: a column nests arbitrary nodes, including further rows. */
export interface ColumnNode {
  id: string;
  type: 'column';
  container?: ContainerAttrs;
  children: Node[];
}

export interface RowNode {
  id: string;
  type: 'row';
  ratio: Ratio;
  container?: ContainerAttrs;
  /** 1..4, ratio-bound; extra columns beyond the ratio's slots reuse the last span. */
  children: ColumnNode[];
}

export type Node = RowNode | ColumnNode | BlockNode;

export type Slot =
  | { mode: 'inherit' }                    // resolve against Site Settings pageDefaults
  | { mode: 'none' }                       // bare page
  | { mode: 'custom'; children: Node[] };  // page-owned chrome

export interface LayoutNode {
  type: 'layout';
  header: Slot;
  footer: Slot;
  /** Only `gap` applies: rhythm between top-level children. */
  container?: ContainerAttrs;
  children: Node[];
}

export interface PressTree {
  version: typeof PRESS_TREE_VERSION;
  root: LayoutNode;
}
```

- [ ] **Step 4: Extend PressSchema and re-export**

In `packages/shared/src/index.ts`, add to the `PressSchema` interface a `tree` member and re-export the tree module. The interface becomes:

```ts
export interface PressSchema {
  /** The composition-tree contract version served by this cms (absent on pre-tree engines). */
  tree?: { version: number };
  contentTypes: Record<string, { uid: string; info: unknown; attributes: Record<string, Attr> }>;
  components: Record<string, { uid: string; attributes: Record<string, Attr> }>;
}
```

and append at the end of the file:

```ts
export * from './tree';
export * from './validate-tree';
```

(The `validate-tree` module arrives in Task 2 — create an empty `packages/shared/src/validate-tree.ts` containing only `export {};` now so typecheck passes, or add the export line in Task 2. Prefer adding BOTH export lines now and the placeholder file, replaced in Task 2.)

- [ ] **Step 5: Verify typecheck**

Run: `pnpm install && pnpm --filter @ogs-tech/press-shared typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): publishable press-shared + PressTree wire contract"
```

### Task 2: Tree validator (pure TS, sanitizing)

**Files:**
- Create: `packages/shared/src/validate-tree.ts` (replaces the Task 1 placeholder)
- Test: `packages/shared/src/validate-tree.test.ts`

**Interfaces:**
- Consumes: types from `./tree`.
- Produces (exact — cms lifecycle and web renderer both call these):
  - `interface TreeIssue { path: string; message: string }`
  - `interface TreeResult<T> { value: T | null; errors: TreeIssue[]; warnings: TreeIssue[] }`
  - `validatePressTree(input: unknown): TreeResult<PressTree>`
  - `validateNodeArray(input: unknown): TreeResult<Node[]>`
  - `MAX_ROW_COLUMNS = 4`
- Semantics: `value` is a SANITIZED deep copy. Structural problems → `errors` (+ `value: null`). Invalid `container` attr values are STRIPPED → `warnings` (attr-level failure never becomes tree-level, Spec §7). Unknown slot mode → warning + coerced `{ mode: 'none' }`. Writers (cms) reject on errors OR warnings; readers (web) render `value` whenever it is non-null.

- [ ] **Step 1: Write the failing tests**

Create `packages/shared/src/validate-tree.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateNodeArray, validatePressTree } from './validate-tree';
import type { PressTree } from './tree';

const block = (component: string, data: Record<string, unknown> = {}) => ({
  id: `id-${component}`,
  type: 'block',
  component,
  data,
});

const validTree = (): PressTree => ({
  version: 1,
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
        ratio: '50-50',
        container: { width: 'lg', gap: 'compact', verticalAlign: 'center' },
        children: [
          { id: 'col-1', type: 'column', children: [block('preset-atom.paragraph', { content: 'a' })] },
          {
            id: 'col-2',
            type: 'column',
            container: { gap: 'spacious', verticalAlign: 'bottom' },
            // the recursion point: a row INSIDE a column (Spec §8: must validate at depth)
            children: [
              {
                id: 'row-2',
                type: 'row',
                ratio: '33-67',
                children: [
                  { id: 'col-3', type: 'column', children: [block('custom-organism.callout')] },
                  { id: 'col-4', type: 'column', children: [] },
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

  it('rejects non-objects and unknown versions (fail-to-empty gate)', () => {
    expect(validatePressTree(null).value).toBeNull();
    expect(validatePressTree('[]').value).toBeNull();
    const v2 = { ...validTree(), version: 2 };
    const out = validatePressTree(v2);
    expect(out.value).toBeNull();
    expect(out.errors[0].path).toBe('$.version');
  });

  it('rejects a root that is not a layout node', () => {
    const out = validatePressTree({ version: 1, root: block('preset-atom.paragraph') });
    expect(out.value).toBeNull();
    expect(out.errors[0].path).toBe('$.root');
  });

  it('strips invalid container attr values as warnings, never errors (Spec §7)', () => {
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
      version: 1,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'c', type: 'column', children: [] },
      ] },
    });
    expect(stray.value).toBeNull();
    expect(stray.errors[0].message).toMatch(/only legal directly under a row/);

    const unknown = validatePressTree({
      version: 1,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'x', type: 'mystery' },
      ] },
    });
    expect(unknown.value).toBeNull();
  });

  it('enforces row arity 1..4 and column-only row children', () => {
    const tooMany = validTree();
    (tooMany.root.children[1] as any).children = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`, type: 'column', children: [],
    }));
    expect(validatePressTree(tooMany).value).toBeNull();

    const notColumn = validTree();
    (notColumn.root.children[1] as any).children = [block('preset-atom.paragraph')];
    expect(validatePressTree(notColumn).value).toBeNull();
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

describe('validateNodeArray', () => {
  it('accepts a bare Node[] (the pageDefaults slot shape)', () => {
    const nodes = [block('preset-organism.navbar')];
    const out = validateNodeArray(nodes);
    expect(out.errors).toEqual([]);
    expect(out.value).toEqual(nodes);
  });

  it('rejects non-arrays and invalid members', () => {
    expect(validateNodeArray({}).value).toBeNull();
    expect(validateNodeArray([{ id: 'x', type: 'column', children: [] }]).value).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-shared test`
Expected: FAIL — `validate-tree` exports missing (placeholder module).

- [ ] **Step 3: Write the validator**

Replace `packages/shared/src/validate-tree.ts` with:

```ts
/**
 * Runtime PressTree validator (Spec §3 "press-shared changes nature"): pure TS,
 * zero deps. Compiled into press-cms dist (save-time backstop) and consumed as
 * source by press-web (render-time guard).
 *
 * Contract: `value` is a SANITIZED deep copy — structural failures null it and
 * land in `errors`; invalid container-attr values are stripped and land in
 * `warnings` (attr-level failure never becomes tree-level, Spec §7); an unknown
 * slot mode degrades to `none` with a warning. Writers reject on errors OR
 * warnings (strict write); readers render whenever `value` is non-null
 * (tolerant read).
 */
import type { ColumnNode, ContainerAttrs, LayoutNode, Node, PressTree, RowNode, Slot } from './tree';
import { PRESS_TREE_VERSION } from './tree';

export interface TreeIssue {
  path: string;
  message: string;
}

export interface TreeResult<T> {
  value: T | null;
  errors: TreeIssue[];
  warnings: TreeIssue[];
}

export const MAX_ROW_COLUMNS = 4;

const RATIOS: readonly string[] = ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'];
const WIDTHS: readonly string[] = ['prose', 'lg', 'full'];
const GAPS: readonly string[] = ['compact', 'normal', 'spacious'];
const VERTICAL_ALIGNS: readonly string[] = ['top', 'center', 'bottom'];

interface Ctx {
  errors: TreeIssue[];
  warnings: TreeIssue[];
}

const fail = (ctx: Ctx, path: string, message: string): null => {
  ctx.errors.push({ path, message });
  return null;
};

const warn = (ctx: Ctx, path: string, message: string): void => {
  ctx.warnings.push({ path, message });
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitizeContainer(input: unknown, path: string, ctx: Ctx): ContainerAttrs | undefined {
  if (input === undefined || input === null) return undefined;
  if (!isRecord(input)) {
    warn(ctx, path, 'container must be an object — ignored');
    return undefined;
  }
  const out: ContainerAttrs = {};
  const pick = (key: keyof ContainerAttrs, allowed: readonly string[]): void => {
    const v = input[key];
    if (v === undefined) return;
    if (typeof v === 'string' && allowed.includes(v)) {
      (out as Record<string, unknown>)[key] = v;
    } else {
      warn(ctx, `${path}.${key}`, `invalid value ${JSON.stringify(v)} — attribute dropped`);
    }
  };
  pick('width', WIDTHS);
  pick('gap', GAPS);
  pick('verticalAlign', VERTICAL_ALIGNS);
  return Object.keys(out).length > 0 ? out : undefined;
}

function requireId(input: Record<string, unknown>, path: string, ctx: Ctx): string | null {
  if (typeof input.id !== 'string' || input.id.length === 0) {
    return fail(ctx, `${path}.id`, 'node id must be a non-empty string');
  }
  return input.id;
}

function validateColumn(input: unknown, path: string, ctx: Ctx): ColumnNode | null {
  if (!isRecord(input) || input.type !== 'column') {
    return fail(ctx, path, `row children must be column nodes, got ${JSON.stringify(isRecord(input) ? input.type : input)}`);
  }
  const id = requireId(input, path, ctx);
  if (id === null) return null;
  const children = validateChildren(input.children, `${path}.children`, ctx);
  if (children === null) return null;
  const node: ColumnNode = { id, type: 'column', children };
  const container = sanitizeContainer(input.container, `${path}.container`, ctx);
  if (container) node.container = container;
  return node;
}

/** A generic children position (layout root / column) admits block | row only. */
function validateChildren(input: unknown, path: string, ctx: Ctx): Node[] | null {
  if (!Array.isArray(input)) return fail(ctx, path, 'children must be an array');
  const out: Node[] = [];
  input.forEach((child, i) => {
    const node = validateNode(child, `${path}[${i}]`, ctx);
    if (node) out.push(node);
  });
  return out;
}

function validateNode(input: unknown, path: string, ctx: Ctx): Node | null {
  if (!isRecord(input)) return fail(ctx, path, 'node must be an object');
  switch (input.type) {
    case 'block': {
      const id = requireId(input, path, ctx);
      if (id === null) return null;
      if (typeof input.component !== 'string' || input.component.length === 0) {
        return fail(ctx, `${path}.component`, 'block component must be a non-empty palette uid');
      }
      let data: Record<string, unknown> = {};
      if (input.data === undefined) {
        // tolerated: an attribute-less block (bare navbar seed)
      } else if (isRecord(input.data)) {
        data = structuredClone(input.data) as Record<string, unknown>;
      } else {
        warn(ctx, `${path}.data`, 'block data must be an object — reset to {}');
      }
      return { id, type: 'block', component: input.component, data };
    }
    case 'row': {
      const id = requireId(input, path, ctx);
      if (id === null) return null;
      if (typeof input.ratio !== 'string' || !RATIOS.includes(input.ratio)) {
        return fail(ctx, `${path}.ratio`, `ratio must be one of ${RATIOS.join(' | ')}`);
      }
      if (!Array.isArray(input.children)) {
        return fail(ctx, `${path}.children`, 'row children must be an array of columns');
      }
      if (input.children.length < 1 || input.children.length > MAX_ROW_COLUMNS) {
        return fail(ctx, `${path}.children`, `a row carries 1–${MAX_ROW_COLUMNS} columns, got ${input.children.length}`);
      }
      const columns: ColumnNode[] = [];
      input.children.forEach((c, i) => {
        const col = validateColumn(c, `${path}.children[${i}]`, ctx);
        if (col) columns.push(col);
      });
      const node: RowNode = { id, type: 'row', ratio: input.ratio as RowNode['ratio'], children: columns };
      const container = sanitizeContainer(input.container, `${path}.container`, ctx);
      if (container) node.container = container;
      return node;
    }
    case 'column':
      return fail(ctx, path, 'a column node is only legal directly under a row');
    default:
      return fail(ctx, `${path}.type`, `unknown node type ${JSON.stringify(input.type)}`);
  }
}

function validateSlot(input: unknown, path: string, ctx: Ctx): Slot {
  if (!isRecord(input)) {
    warn(ctx, path, 'slot must be an object — treated as none');
    return { mode: 'none' };
  }
  if (input.mode === 'inherit') return { mode: 'inherit' };
  if (input.mode === 'none') return { mode: 'none' };
  if (input.mode === 'custom') {
    const children = validateChildren(input.children, `${path}.children`, ctx);
    return { mode: 'custom', children: children ?? [] };
  }
  warn(ctx, `${path}.mode`, `unknown slot mode ${JSON.stringify(input.mode)} — treated as none`);
  return { mode: 'none' };
}

export function validatePressTree(input: unknown): TreeResult<PressTree> {
  const ctx: Ctx = { errors: [], warnings: [] };
  if (!isRecord(input)) {
    return { value: null, errors: [{ path: '$', message: 'tree must be an object' }], warnings: [] };
  }
  if (input.version !== PRESS_TREE_VERSION) {
    return {
      value: null,
      errors: [{ path: '$.version', message: `unsupported tree version ${JSON.stringify(input.version)} (expected ${PRESS_TREE_VERSION})` }],
      warnings: [],
    };
  }
  const root = input.root;
  if (!isRecord(root) || root.type !== 'layout') {
    return { value: null, errors: [{ path: '$.root', message: "root must be a node of type 'layout'" }], warnings: ctx.warnings };
  }
  const header = validateSlot(root.header, '$.root.header', ctx);
  const footer = validateSlot(root.footer, '$.root.footer', ctx);
  const children = validateChildren(root.children, '$.root.children', ctx) ?? [];
  const layout: LayoutNode = { type: 'layout', header, footer, children };
  const container = sanitizeContainer(root.container, '$.root.container', ctx);
  if (container) layout.container = container;
  return {
    value: ctx.errors.length === 0 ? { version: PRESS_TREE_VERSION, root: layout } : null,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };
}

/** Validates a bare Node[] — the shape of one Site Settings pageDefaults slot. */
export function validateNodeArray(input: unknown): TreeResult<Node[]> {
  const ctx: Ctx = { errors: [], warnings: [] };
  const nodes = validateChildren(input, '$', ctx);
  return { value: ctx.errors.length === 0 ? nodes : null, errors: ctx.errors, warnings: ctx.warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-shared test && pnpm --filter @ogs-tech/press-shared typecheck`
Expected: all tests PASS, typecheck exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): sanitizing PressTree runtime validator"
```

---

## Phase 2 — `@ogs-tech/press-cms` server: catalog, storage, hydration, validation, seeds

### Task 3: Link descriptor + curated text atoms (palette rewrite)

**Files:**
- Create: `packages/cms/server/src/components/molecules/link.json`
- Delete: `packages/cms/server/src/components/molecules/nav-item.json`, `packages/cms/server/src/components/molecules/column.json`, `packages/cms/server/src/components/organisms/columns.json`
- Modify: `packages/cms/server/src/components/atoms/paragraph.json`, `atoms/list.json`, `atoms/quote.json`, `atoms/button.json`, `organisms/hero.json`, `organisms/cta.json`, `organisms/navbar.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts` (ENGINE_COMPONENTS list only)
- Test: `packages/cms/server/src/lib/inject-components.test.ts` (update expectations)

**Interfaces:**
- Consumes: nothing new.
- Produces: the palette uids every later task builds forms/types/renderers from: `preset-molecule.link` exists; `preset-molecule.nav-item`, `preset-molecule.column`, `preset-organism.columns` are gone; `preset-atom.{paragraph,list,quote}` carry `content: text`; link fields are `preset-atom.button.link`, `preset-organism.hero.cta`, `preset-organism.cta.button`, `preset-organism.navbar.items[]` (all `component: preset-molecule.link`).

- [ ] **Step 1: Write the link descriptor**

Create `packages/cms/server/src/components/molecules/link.json`:

```json
{
  "collectionName": "components_preset_molecule_links",
  "info": {
    "displayName": "Link",
    "icon": "link",
    "description": "The engine's one link concept: an internal page reference (survives renames) or a URL, with a label"
  },
  "options": {},
  "attributes": {
    "label": { "type": "string" },
    "page": { "type": "relation", "relation": "oneToOne", "target": "plugin::press-cms.page" },
    "url": { "type": "string" },
    "newTab": { "type": "boolean", "default": false }
  },
  "config": {
    "metadatas": {
      "label": { "edit": { "label": "Label" } },
      "page": { "edit": { "label": "Page", "description": "Internal page link (resolves to its slug; survives renames). Takes precedence over URL." } },
      "url": { "edit": { "label": "URL", "description": "External URL, anchor, or mailto: (used only when no Page is set)." } },
      "newTab": { "edit": { "label": "Open in new tab" } }
    }
  }
}
```

- [ ] **Step 2: Rewrite the text atoms to curated plain text**

Replace the `attributes` (and matching `config.metadatas`) of the three text atoms — keep each file's existing `collectionName`/`info` untouched:

`atoms/paragraph.json` attributes become:

```json
"attributes": {
  "content": { "type": "text", "required": true }
},
"config": {
  "metadatas": {
    "content": { "edit": { "label": "Content", "description": "Plain text. A blank line starts a new paragraph." } }
  }
}
```

`atoms/list.json` attributes become:

```json
"attributes": {
  "content": { "type": "text", "required": true },
  "format": { "type": "enumeration", "enum": ["unordered", "ordered"], "default": "unordered" }
},
"config": {
  "metadatas": {
    "content": { "edit": { "label": "Items", "description": "One item per line." } },
    "format": { "edit": { "label": "Format" } }
  }
}
```

`atoms/quote.json` attributes become:

```json
"attributes": {
  "content": { "type": "text", "required": true },
  "citation": { "type": "string" }
},
"config": {
  "metadatas": {
    "content": { "edit": { "label": "Quote", "description": "Plain text. A blank line starts a new paragraph." } },
    "citation": { "edit": { "label": "Citation" } }
  }
}
```

- [ ] **Step 3: Move every link onto the shared descriptor**

`atoms/button.json` attributes become (label moves INTO the link):

```json
"attributes": {
  "link": { "type": "component", "repeatable": false, "component": "preset-molecule.link" },
  "variant": { "type": "enumeration", "enum": ["primary", "secondary"], "default": "primary" }
},
"config": {
  "metadatas": {
    "link": { "edit": { "label": "Link" } },
    "variant": { "edit": { "label": "Variant" } }
  }
}
```

`organisms/hero.json`: delete `ctaLabel` + `ctaHref`, add:

```json
"cta": { "type": "component", "repeatable": false, "component": "preset-molecule.link" }
```

`organisms/cta.json`: delete `buttonLabel` + `buttonHref`, add:

```json
"button": { "type": "component", "repeatable": false, "component": "preset-molecule.link" }
```

`organisms/navbar.json` attributes become:

```json
"attributes": {
  "items": { "type": "component", "repeatable": true, "component": "preset-molecule.link" },
  "cta": { "type": "component", "repeatable": false, "component": "preset-atom.button" }
}
```

- [ ] **Step 4: Delete the superseded components and update the injection list**

```bash
git rm packages/cms/server/src/components/molecules/nav-item.json \
       packages/cms/server/src/components/molecules/column.json \
       packages/cms/server/src/components/organisms/columns.json
```

In `packages/cms/server/src/lib/inject-components.ts`: remove the `navItemSchema`, `columnSchema`, `columnsSchema` imports and their `ENGINE_COMPONENTS` entries; add `import linkSchema from '../components/molecules/link.json';` and the entry `{ layer: 'molecule', name: 'link', schema: linkSchema as Record<string, unknown> }` in the molecules group.

- [ ] **Step 5: Update the inject test and run**

In `packages/cms/server/src/lib/inject-components.test.ts`, update every expectation that lists injected uids: `preset-molecule.nav-item` / `preset-molecule.column` / `preset-organism.columns` are replaced by `preset-molecule.link` (e.g. an assertion like `expect(registry.get('preset-molecule.nav-item')).toBeDefined()` becomes `expect(registry.get('preset-molecule.link')).toBeDefined()`; counts drop by 2).

Run: `pnpm --filter @ogs-tech/press-cms test src/lib/inject-components.test.ts` — wait: cms tests run from the package root, so: `pnpm --filter @ogs-tech/press-cms test` and `pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS / exit 0 (the admitCustomBlocks tests still pass — that code is untouched until Task 4).

- [ ] **Step 6: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): preset-molecule.link descriptor + curated plain-text atoms; retire nav-item/column/columns"
```

### Task 4: Builder custom field + storage swap (kill the Dynamic Zones)

**Files:**
- Modify: `packages/cms/server/src/register.ts`
- Modify: `packages/cms/server/src/content-types/page/schema.json`
- Modify: `packages/cms/server/src/content-types/site-setting/schema.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts` (delete `admitCustomBlocks` + `ENGINE_DZ_TARGETS`; keep + export `isCustomBlockUid`)
- Delete: `packages/cms/server/src/lib/dz-populate.ts`, `packages/cms/server/src/lib/dz-populate.test.ts`
- Modify: `packages/cms/server/src/controllers/page.ts`, `packages/cms/server/src/controllers/site-setting.ts`
- Test: update `packages/cms/server/src/lib/inject-components.test.ts`, `packages/cms/server/src/controllers/site-setting.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (schema-level change).
- Produces: `page.body` attribute `{ "type": "customField", "customField": "plugin::press-cms.builder" }`; `site-setting.pageDefaults` same custom field with `"options": { "mode": "slots" }`; `isCustomBlockUid(uid: string): boolean` exported for Task 5. Controllers serve raw JSON (hydration lands in Task 6).

- [ ] **Step 1: Register the custom field server-side**

Replace `packages/cms/server/src/register.ts` with:

```ts
import type { Core } from '@strapi/strapi';
import { injectComponents } from './lib/inject-components';
import { quietSchemaHttpLog } from './lib/quiet-schema-log';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // The composition-builder storage primitive (Spec §4): a JSON custom field.
  // Declared before content-types are transformed into models so the
  // `plugin::press-cms.builder` reference in page/site-setting schema.json resolves.
  strapi.customFields.register({
    name: 'builder',
    plugin: 'press-cms',
    type: 'json',
  });
  injectComponents({ strapi });
  quietSchemaHttpLog(strapi);
};

export default register;
```

- [ ] **Step 2: Swap the storage attributes**

`packages/cms/server/src/content-types/page/schema.json` — replace the whole `body` attribute with:

```json
"body": {
  "type": "customField",
  "customField": "plugin::press-cms.builder"
}
```

`packages/cms/server/src/content-types/site-setting/schema.json` — DELETE the `header` and `footer` attributes and their two `config.metadatas` entries; ADD:

```json
"pageDefaults": {
  "type": "customField",
  "customField": "plugin::press-cms.builder",
  "options": { "mode": "slots" }
}
```

and the metadata entry:

```json
"pageDefaults": { "edit": { "label": "Page defaults", "description": "The default header and footer every page inherits. Pages can override or drop them per-slot." } }
```

- [ ] **Step 3: Shrink inject-components to injection only**

In `packages/cms/server/src/lib/inject-components.ts`: delete `admitCustomBlocks`, `ENGINE_DZ_TARGETS`, and their doc comments entirely. Keep `isCustomBlockUid` and export it (Task 5's serializer consumes it):

```ts
/** An adopter block: any registered component under a `custom` / `custom-${layer}` category. */
export const isCustomBlockUid = (uid: string): boolean => uid.startsWith('custom.') || uid.startsWith('custom-');
```

Update the file's header comment: custom blocks are no longer "admitted" anywhere — the builder palette and `serialize-schema` discover them straight from the components registry (`custom-*` category prefix stays the whole extension-point contract).

- [ ] **Step 4: Delete DZ populate and simplify the controllers**

```bash
git rm packages/cms/server/src/lib/dz-populate.ts packages/cms/server/src/lib/dz-populate.test.ts
```

Replace `packages/cms/server/src/controllers/page.ts` with:

```ts
import type { Core } from '@strapi/strapi';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * Engine-owned page controller. `body` is a JSON custom field now — no dynamic
 * zone, no populate tree: the whole "vanished from the wire but visible in the
 * admin" bug class is gone (Spec §4). Published-only + 404 semantics unchanged.
 * Media/page-ref hydration is layered on in lib/serve-hydrated (Task 6).
 */
const page = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const data = await strapi.documents(PAGE_UID as any).findMany({ status: 'published' });
    ctx.body = { data };
  },

  async findOne(ctx: any) {
    const { slug } = ctx.params;
    const [doc] = await strapi.documents(PAGE_UID as any).findMany({
      filters: { slug },
      status: 'published',
      limit: 1,
    });
    if (!doc) return ctx.notFound();
    ctx.body = { data: doc };
  },
});

export default page;
```

In `packages/cms/server/src/controllers/site-setting.ts`: remove the `buildChromeDzPopulate` import, the `header`/`footer` keys from `chromePopulate()` (rename it `settingsPopulate()`), and the chrome component-list reads. The populate keeps `logo`, `favicon`, `seo.image`, `themeColors`, `themeRadius`, and the `cookieConsent` block verbatim — `pageDefaults` is a JSON scalar and needs no populate key.

- [ ] **Step 5: Update tests and run**

- `inject-components.test.ts`: delete every `admitCustomBlocks` describe/it block (DZ admission is gone); keep/extend injection assertions.
- `site-setting.test.ts`: update the populate expectation — no `header`/`footer` keys; everything else identical.

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS / exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A packages/cms
git commit -m "feat(cms)!: page.body + site-setting.pageDefaults become the builder JSON custom field; Dynamic Zones and dz-populate removed"
```

### Task 5: preset-layout descriptors + full-palette serialize-schema (+ dist bundling proof)

**Files:**
- Create: `packages/cms/server/src/components/layout/container.json`, `layout/row.json`, `layout/column.json`
- Modify: `packages/cms/server/src/lib/inject-components.ts` (three new entries)
- Modify: `packages/cms/server/src/lib/serialize-schema.ts`
- Test: `packages/cms/server/src/lib/serialize-schema.test.ts` (rewrite)

**Interfaces:**
- Consumes: `isCustomBlockUid` (Task 4), `PRESS_TREE_VERSION` from `@ogs-tech/press-shared` (Task 1) — **the first RUNTIME import of press-shared inside cms**; the bundling proof below is mandatory.
- Produces: `GET /api/press/schema` serves `{ tree: { version: 1 }, contentTypes, components }` where `components` is the FULL registered palette (every `preset-*` + `custom-*` uid). `preset-layout.container` / `.row` / `.column` exist — the admin builder (Task 10/11) generates its layout-node forms from them.

- [ ] **Step 1: Write the layout descriptors**

Create `packages/cms/server/src/components/layout/container.json` — the shared `ContainerAttrs` descriptor. NO `default` keys on purpose: an absent value means "engine default", and a Strapi default would make absence unrepresentable:

```json
{
  "collectionName": "components_preset_layout_containers",
  "info": {
    "displayName": "Container",
    "icon": "expand",
    "description": "The shared curated attribute surface (width / gap / vertical alignment) carried by every children-bearing tree node"
  },
  "options": {},
  "attributes": {
    "width": { "type": "enumeration", "enum": ["prose", "lg", "full"] },
    "gap": { "type": "enumeration", "enum": ["compact", "normal", "spacious"] },
    "verticalAlign": { "type": "enumeration", "enum": ["top", "center", "bottom"] }
  },
  "config": {
    "metadatas": {
      "width": { "edit": { "label": "Width", "description": "Top-level rows only; ignored when nested." } },
      "gap": { "edit": { "label": "Gap", "description": "Row: space between columns. Column/page: vertical rhythm." } },
      "verticalAlign": { "edit": { "label": "Vertical alignment", "description": "Row: aligns cells. Column: places content within the cell." } }
    }
  }
}
```

Create `packages/cms/server/src/components/layout/row.json`:

```json
{
  "collectionName": "components_preset_layout_rows",
  "info": {
    "displayName": "Row",
    "icon": "apps",
    "description": "A tree row: the ratio defines the column split; container carries the shared layout attributes"
  },
  "options": {},
  "attributes": {
    "ratio": { "type": "enumeration", "enum": ["50-50", "33-67", "67-33", "33-33-33", "25-25-25-25"], "default": "50-50" },
    "container": { "type": "component", "repeatable": false, "component": "preset-layout.container" }
  },
  "config": {
    "metadatas": {
      "ratio": { "edit": { "label": "Column layout", "description": "How the columns split the width on desktop; every layout stacks on phones." } },
      "container": { "edit": { "label": "Container" } }
    }
  }
}
```

Create `packages/cms/server/src/components/layout/column.json`:

```json
{
  "collectionName": "components_preset_layout_columns",
  "info": {
    "displayName": "Column",
    "icon": "stack",
    "description": "A tree column: the recursion point — nests blocks and further rows"
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

In `inject-components.ts` add the imports and entries (after the organisms group, before config):

```ts
// Layout — the tree-node descriptors (Spec §4): pure schema for the builder's
// layout-node forms. `preset-layout.container` is the shared ContainerAttrs
// surface, referenced by row/column via `component:` fields (the link/nav-item
// nesting pattern) so the "Container" form section is defined exactly once.
{ layer: 'layout', name: 'container', schema: layoutContainerSchema as Record<string, unknown> },
{ layer: 'layout', name: 'row', schema: layoutRowSchema as Record<string, unknown> },
{ layer: 'layout', name: 'column', schema: layoutColumnSchema as Record<string, unknown> },
```

Also update the `PRESET_LAYERS` doc comment: `layout` is no longer reserved-empty; only `template` remains reserved.

- [ ] **Step 2: Rewrite the serialize-schema test**

Replace `packages/cms/server/src/lib/serialize-schema.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { serializeSchema } from './serialize-schema';

const fakeStrapi = () => {
  const components = new Map<string, any>([
    ['preset-atom.paragraph', { uid: 'preset-atom.paragraph', attributes: { content: { type: 'text', required: true }, createdAt: { type: 'datetime', private: true } } }],
    ['preset-molecule.link', { uid: 'preset-molecule.link', attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean', default: false } } }],
    ['preset-layout.container', { uid: 'preset-layout.container', attributes: { width: { type: 'enumeration', enum: ['prose', 'lg', 'full'] } } }],
    ['custom-organism.callout', { uid: 'custom-organism.callout', attributes: { message: { type: 'string', required: true } } }],
    // NOT part of the palette — must be excluded:
    ['admin.something', { uid: 'admin.something', attributes: { x: { type: 'string' } } }],
  ]);
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': {
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'customField', customField: 'plugin::press-cms.builder' },
      },
    },
    'plugin::press-cms.site-setting': {
      uid: 'plugin::press-cms.site-setting',
      info: { singularName: 'site-setting', pluralName: 'site-settings', displayName: 'Site Settings' },
      attributes: {
        name: { type: 'string' },
        pageDefaults: { type: 'customField', customField: 'plugin::press-cms.builder' },
      },
    },
  };
  return {
    contentType: (uid: string) => contentTypes[uid],
    get: (key: string) => (key === 'components' ? components : undefined),
  } as any;
};

describe('serializeSchema', () => {
  it('serves the tree contract version', () => {
    expect(serializeSchema(fakeStrapi()).tree).toEqual({ version: 1 });
  });

  it('serves the FULL registered palette — every preset-* and custom-* uid, nothing else', () => {
    const out = serializeSchema(fakeStrapi());
    expect(Object.keys(out.components).sort()).toEqual([
      'custom-organism.callout',
      'preset-atom.paragraph',
      'preset-layout.container',
      'preset-molecule.link',
    ]);
  });

  it('keeps contract attribute keys (target included, for page refs) and drops noise', () => {
    const out = serializeSchema(fakeStrapi());
    expect(out.components['preset-atom.paragraph'].attributes).toEqual({
      content: { type: 'text', required: true },
    });
    expect(out.components['preset-molecule.link'].attributes.page).toEqual({
      type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page',
    });
  });

  it('still fails loud when an engine content-type is missing', () => {
    const broken = fakeStrapi();
    const orig = broken.contentType;
    broken.contentType = (uid: string) => (uid === 'plugin::press-cms.page' ? undefined : orig(uid));
    expect(() => serializeSchema(broken)).toThrow(/not registered/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — `tree` missing from output; palette walking still DZ-based.

- [ ] **Step 4: Rewrite serializeSchema**

In `packages/cms/server/src/lib/serialize-schema.ts`:
- Add to `KEEP`: `'relation'`, `'target'` (the builder's page-dropdown and the generator's `PressPageRef` need to recognize page relations): `const KEEP = ['type', 'required', 'enum', 'default', 'components', 'multiple', 'allowedTypes', 'repeatable', 'component', 'relation', 'target'] as const;`
- Replace the DZ-walking block and return with:

```ts
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { isCustomBlockUid } from './inject-components';

/** Palette membership: engine presets + adopter customs; Strapi-internal categories never serve. */
const isPaletteUid = (uid: string): boolean => uid.startsWith('preset-') || isCustomBlockUid(uid);

export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = requireContentType(strapi, PAGE_UID);
  const siteSetting = requireContentType(strapi, SITE_SETTING_UID);

  // The body/pageDefaults JSON references components by uid at arbitrary depth,
  // so the runtime view is the FULL registered palette (Spec §4) — there are no
  // DZ admission lists left to walk.
  const registry = strapi.get('components') as Map<string, any>;
  const components: PressSchema['components'] = {};
  for (const [uid, comp] of registry.entries()) {
    if (!isPaletteUid(uid)) continue;
    components[uid] = { uid, attributes: pickAttributes(comp.attributes) };
  }

  return {
    tree: { version: PRESS_TREE_VERSION },
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
      [siteSetting.uid]: { uid: siteSetting.uid, info: siteSetting.info, attributes: pickAttributes(siteSetting.attributes) },
    },
    components,
  };
};
```

(The doc comment on the function is rewritten to match; the "missing component reachable from a DZ" throw disappears with the queue — `requireContentType` keeps the loud-failure guarantee for the content-types.)

- [ ] **Step 5: Run tests, then PROVE the validator bundles into dist**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

Now the bundling proof (Decision 3): press-shared stays a cms devDependency, so `strapi-plugin build` must INLINE it (a devDependency is not externalized by pack-up). Verify:

Run: `pnpm --filter @ogs-tech/press-cms build && ! grep -R "press-shared" packages/cms/dist/server/index.js && grep -q "PRESS_TREE_VERSION\|unsupported tree version" packages/cms/dist/server/index.js && echo BUNDLED-OK`
Expected: `BUNDLED-OK` (no runtime `require('@ogs-tech/press-shared')` left in dist; the constant/validator text is inlined). If the grep finds a bare import instead, STOP: the fix is adding press-shared to the cms `dependencies` (it is published as of Task 1) — flag this in the commit message if taken.

- [ ] **Step 6: Commit**

```bash
git add -A packages/cms
git commit -m "feat(cms): preset-layout descriptors + full-palette schema serialization with tree contract version"
```

### Task 6: Server-side tree hydration (media assetId + page documentId)

**Files:**
- Create: `packages/cms/server/src/lib/hydrate-tree.ts`
- Create: `packages/cms/server/src/lib/serve-hydrated.ts`
- Test: `packages/cms/server/src/lib/hydrate-tree.test.ts`
- Modify: `packages/cms/server/src/controllers/page.ts`, `packages/cms/server/src/controllers/site-setting.ts`

**Interfaces:**
- Consumes: component schemas from the registry (`strapi.get('components')`).
- Produces (exact):
  - `interface TreeRefs { assetIds: number[]; pageDocumentIds: string[] }`
  - `interface TreeResolvers { media(assetId: number): Record<string, unknown> | null; page(documentId: string): Record<string, unknown> | null }`
  - `type SchemaLookup = (uid: string) => { attributes?: Record<string, any> } | undefined`
  - `collectNodeRefs(nodes: unknown, getSchema: SchemaLookup): TreeRefs`
  - `hydrateNodeArray(nodes: unknown, getSchema: SchemaLookup, resolvers: TreeResolvers): unknown`
  - `collectTreeRefs(tree: unknown, getSchema): TreeRefs` / `hydrateTree(tree: unknown, getSchema, resolvers): unknown` (walk `root.children` + both custom slots)
  - `serve-hydrated.ts`: `hydratePageDoc(strapi, doc)`, `hydratePageDocs(strapi, docs)`, `hydrateSiteSetting(strapi, data)` — async, batched queries, tolerant of null/malformed input (pass through untouched).
- Wire shapes after hydration: media `{ assetId }` → `{ assetId, url, width, height, alternativeText, name, mime }` (missing asset → `null`); page ref `{ documentId }` → `{ documentId, slug }` (unpublished/missing page → `{ documentId }`, no slug — the web link resolver falls back to `url`).

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/server/src/lib/hydrate-tree.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collectNodeRefs, collectTreeRefs, hydrateNodeArray, hydrateTree } from './hydrate-tree';

const SCHEMAS: Record<string, any> = {
  'preset-atom.image': { attributes: { image: { type: 'media', multiple: false }, caption: { type: 'string' } } },
  'preset-atom.button': { attributes: { link: { type: 'component', component: 'preset-molecule.link' }, variant: { type: 'enumeration' } } },
  'preset-molecule.link': { attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean' } } },
  'preset-organism.navbar': { attributes: { items: { type: 'component', repeatable: true, component: 'preset-molecule.link' }, cta: { type: 'component', component: 'preset-atom.button' } } },
};
const getSchema = (uid: string) => SCHEMAS[uid];

const resolvers = {
  media: (assetId: number) => (assetId === 7 ? { assetId: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' } : null),
  page: (documentId: string) => (documentId === 'home-doc' ? { documentId: 'home-doc', slug: 'home' } : { documentId }),
};

const nodes = [
  { id: 'b1', type: 'block', component: 'preset-atom.image', data: { image: { assetId: 7 }, caption: 'c' } },
  {
    id: 'r1', type: 'row', ratio: '50-50', children: [
      { id: 'c1', type: 'column', children: [
        { id: 'b2', type: 'block', component: 'preset-organism.navbar', data: {
          items: [{ label: 'Home', page: { documentId: 'home-doc' } }, { label: 'Ext', url: 'https://x' }],
          cta: { link: { label: 'Go', page: { documentId: 'gone-doc' } }, variant: 'primary' },
        } },
      ] },
      { id: 'c2', type: 'column', children: [] },
    ],
  },
  { id: 'b3', type: 'block', component: 'unknown.block', data: { anything: true } },
];

describe('collectNodeRefs', () => {
  it('collects media + page refs through rows, columns and nested components', () => {
    const refs = collectNodeRefs(nodes, getSchema);
    expect(refs.assetIds).toEqual([7]);
    expect(refs.pageDocumentIds.sort()).toEqual(['gone-doc', 'home-doc']);
  });

  it('returns empty refs for malformed input', () => {
    expect(collectNodeRefs(null, getSchema)).toEqual({ assetIds: [], pageDocumentIds: [] });
    expect(collectNodeRefs('nope', getSchema)).toEqual({ assetIds: [], pageDocumentIds: [] });
  });
});

describe('hydrateNodeArray', () => {
  it('replaces refs with resolved shapes, deep, without mutating input', () => {
    const out = hydrateNodeArray(nodes, getSchema, resolvers) as any[];
    expect(out[0].data.image).toEqual({ assetId: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' });
    const navbar = out[1].children[0].children[0].data;
    expect(navbar.items[0].page).toEqual({ documentId: 'home-doc', slug: 'home' });
    expect(navbar.items[1]).toEqual({ label: 'Ext', url: 'https://x' });
    expect(navbar.cta.link.page).toEqual({ documentId: 'gone-doc' }); // unpublished → ref kept, no slug
    expect((nodes[0] as any).data.image).toEqual({ assetId: 7 }); // input untouched
  });

  it('nulls a media ref whose asset is gone and leaves unknown components untouched', () => {
    const out = hydrateNodeArray(
      [{ id: 'x', type: 'block', component: 'preset-atom.image', data: { image: { assetId: 999 } } }],
      getSchema,
      resolvers,
    ) as any[];
    expect(out[0].data.image).toBeNull();
    const unknown = hydrateNodeArray([nodes[2]], getSchema, resolvers) as any[];
    expect(unknown[0]).toEqual(nodes[2]);
  });
});

describe('tree-level helpers', () => {
  const tree = {
    version: 1,
    root: {
      type: 'layout',
      header: { mode: 'custom', children: [nodes[0]] },
      footer: { mode: 'inherit' },
      children: [nodes[1]],
    },
  };

  it('collects and hydrates root children AND custom slot children', () => {
    const refs = collectTreeRefs(tree, getSchema);
    expect(refs.assetIds).toEqual([7]);
    expect(refs.pageDocumentIds.sort()).toEqual(['gone-doc', 'home-doc']);
    const out = hydrateTree(tree, getSchema, resolvers) as any;
    expect(out.root.header.children[0].data.image.url).toBe('/uploads/x.png');
    expect(out.root.footer).toEqual({ mode: 'inherit' });
  });

  it('passes malformed trees through untouched', () => {
    expect(hydrateTree(null, getSchema, resolvers)).toBeNull();
    expect(hydrateTree({ nope: 1 }, getSchema, resolvers)).toEqual({ nope: 1 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the walker**

Create `packages/cms/server/src/lib/hydrate-tree.ts`:

```ts
/**
 * Media/page-ref hydration for composition trees (Spec §3 "Media inside `data`
 * is a reference, not a snapshot"). The builder stores `{ assetId }` for media
 * and `{ documentId }` for page relations; this walker — driven by the
 * components registry so it never hardcodes block shapes — swaps them for fresh
 * values at serve time, so the wire never rots.
 *
 * Pure: resolvers are injected; the strapi-facing batching lives in
 * serve-hydrated.ts. Never mutates its input; unknown components and malformed
 * values pass through untouched (the web renderer owns tolerance).
 */

export interface TreeRefs {
  assetIds: number[];
  pageDocumentIds: string[];
}

export interface TreeResolvers {
  media(assetId: number): Record<string, unknown> | null;
  page(documentId: string): Record<string, unknown> | null;
}

export type SchemaLookup = (uid: string) => { attributes?: Record<string, any> } | undefined;

const PAGE_TARGET = 'plugin::press-cms.page';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

type Visitor = {
  media(assetId: number): unknown;
  page(documentId: string): unknown;
};

/** Walks one component's data guided by its schema attributes; returns a new object. */
function walkData(data: unknown, attributes: Record<string, any> | undefined, getSchema: SchemaLookup, visit: Visitor): unknown {
  if (!isRecord(data) || !attributes) return data;
  const out: Record<string, unknown> = { ...data };
  for (const [name, attr] of Object.entries(attributes)) {
    const value = out[name];
    if (value === undefined || value === null) continue;
    if (attr?.type === 'media' && isRecord(value) && typeof value.assetId === 'number') {
      out[name] = visit.media(value.assetId);
    } else if (attr?.type === 'relation' && attr?.target === PAGE_TARGET && isRecord(value) && typeof value.documentId === 'string') {
      out[name] = visit.page(value.documentId);
    } else if (attr?.type === 'component' && typeof attr?.component === 'string') {
      const nested = getSchema(attr.component)?.attributes;
      out[name] = attr.repeatable && Array.isArray(value)
        ? value.map((item) => walkData(item, nested, getSchema, visit))
        : walkData(value, nested, getSchema, visit);
    }
  }
  return out;
}

function walkNodes(nodes: unknown, getSchema: SchemaLookup, visit: Visitor): unknown {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((node) => {
    if (!isRecord(node)) return node;
    if (node.type === 'block' && typeof node.component === 'string') {
      const attributes = getSchema(node.component)?.attributes;
      return { ...node, data: walkData(node.data, attributes, getSchema, visit) };
    }
    if ((node.type === 'row' || node.type === 'column') && Array.isArray(node.children)) {
      return { ...node, children: walkNodes(node.children, getSchema, visit) };
    }
    return node;
  });
}

function slotChildren(tree: unknown): { root: Record<string, unknown> | null; slots: Array<'header' | 'footer'> } {
  if (!isRecord(tree) || !isRecord(tree.root)) return { root: null, slots: [] };
  const slots: Array<'header' | 'footer'> = [];
  for (const key of ['header', 'footer'] as const) {
    const slot = (tree.root as Record<string, unknown>)[key];
    if (isRecord(slot) && slot.mode === 'custom') slots.push(key);
  }
  return { root: tree.root as Record<string, unknown>, slots };
}

export function collectNodeRefs(nodes: unknown, getSchema: SchemaLookup): TreeRefs {
  const assetIds = new Set<number>();
  const pageDocumentIds = new Set<string>();
  walkNodes(nodes, getSchema, {
    media: (assetId) => (assetIds.add(assetId), { assetId }),
    page: (documentId) => (pageDocumentIds.add(documentId), { documentId }),
  });
  return { assetIds: [...assetIds], pageDocumentIds: [...pageDocumentIds] };
}

export function hydrateNodeArray(nodes: unknown, getSchema: SchemaLookup, resolvers: TreeResolvers): unknown {
  return walkNodes(nodes, getSchema, {
    media: (assetId) => resolvers.media(assetId),
    page: (documentId) => resolvers.page(documentId),
  });
}

export function collectTreeRefs(tree: unknown, getSchema: SchemaLookup): TreeRefs {
  const { root, slots } = slotChildren(tree);
  if (!root) return { assetIds: [], pageDocumentIds: [] };
  const all = [
    collectNodeRefs(root.children, getSchema),
    ...slots.map((key) => collectNodeRefs((root[key] as Record<string, unknown>).children, getSchema)),
  ];
  return {
    assetIds: [...new Set(all.flatMap((r) => r.assetIds))],
    pageDocumentIds: [...new Set(all.flatMap((r) => r.pageDocumentIds))],
  };
}

export function hydrateTree(tree: unknown, getSchema: SchemaLookup, resolvers: TreeResolvers): unknown {
  const { root, slots } = slotChildren(tree);
  if (!root) return tree;
  const nextRoot: Record<string, unknown> = { ...root, children: hydrateNodeArray(root.children, getSchema, resolvers) };
  for (const key of slots) {
    const slot = root[key] as Record<string, unknown>;
    nextRoot[key] = { ...slot, children: hydrateNodeArray(slot.children, getSchema, resolvers) };
  }
  return { ...(tree as Record<string, unknown>), root: nextRoot };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: PASS.

- [ ] **Step 5: Wire the resolvers and controllers**

Create `packages/cms/server/src/lib/serve-hydrated.ts`:

```ts
import type { Core } from '@strapi/strapi';
import { collectNodeRefs, collectTreeRefs, hydrateNodeArray, hydrateTree, type SchemaLookup, type TreeRefs, type TreeResolvers } from './hydrate-tree';

const PAGE_UID = 'plugin::press-cms.page';

const schemaLookup = (strapi: Core.Strapi): SchemaLookup => {
  const registry = strapi.get('components') as Map<string, any>;
  return (uid) => registry.get(uid);
};

/** One batched query per ref kind; a missing asset → null, a missing/unpublished page → ref without slug. */
async function buildResolvers(strapi: Core.Strapi, refs: TreeRefs): Promise<TreeResolvers> {
  const files = refs.assetIds.length
    ? await strapi.db.query('plugin::upload.file').findMany({ where: { id: { $in: refs.assetIds } } })
    : [];
  const fileById = new Map<number, Record<string, unknown>>(
    files.map((f: any) => [f.id, {
      assetId: f.id, url: f.url, width: f.width, height: f.height,
      alternativeText: f.alternativeText ?? null, name: f.name, mime: f.mime,
    }]),
  );
  const pages = refs.pageDocumentIds.length
    ? await strapi.documents(PAGE_UID as any).findMany({
        filters: { documentId: { $in: refs.pageDocumentIds } },
        status: 'published',
        fields: ['slug'],
      })
    : [];
  const pageByDoc = new Map<string, Record<string, unknown>>(
    (pages as any[]).map((p) => [p.documentId, { documentId: p.documentId, slug: p.slug }]),
  );
  return {
    media: (assetId) => fileById.get(assetId) ?? null,
    page: (documentId) => pageByDoc.get(documentId) ?? { documentId },
  };
}

export async function hydratePageDoc<T extends { body?: unknown }>(strapi: Core.Strapi, doc: T | null): Promise<T | null> {
  if (!doc || doc.body === undefined || doc.body === null) return doc;
  const getSchema = schemaLookup(strapi);
  const resolvers = await buildResolvers(strapi, collectTreeRefs(doc.body, getSchema));
  return { ...doc, body: hydrateTree(doc.body, getSchema, resolvers) };
}

export async function hydratePageDocs<T extends { body?: unknown }>(strapi: Core.Strapi, docs: T[]): Promise<T[]> {
  return Promise.all(docs.map((doc) => hydratePageDoc(strapi, doc) as Promise<T>));
}

export async function hydrateSiteSetting<T extends { pageDefaults?: unknown }>(strapi: Core.Strapi, data: T | null): Promise<T | null> {
  const pd = data?.pageDefaults as { header?: unknown; footer?: unknown } | null | undefined;
  if (!data || !pd || typeof pd !== 'object') return data;
  const getSchema = schemaLookup(strapi);
  const refs = [collectNodeRefs(pd.header, getSchema), collectNodeRefs(pd.footer, getSchema)];
  const resolvers = await buildResolvers(strapi, {
    assetIds: [...new Set(refs.flatMap((r) => r.assetIds))],
    pageDocumentIds: [...new Set(refs.flatMap((r) => r.pageDocumentIds))],
  });
  return {
    ...data,
    pageDefaults: {
      ...pd,
      header: hydrateNodeArray(pd.header, getSchema, resolvers),
      footer: hydrateNodeArray(pd.footer, getSchema, resolvers),
    },
  };
}
```

Wire the controllers:
- `controllers/page.ts` `find`: `ctx.body = { data: await hydratePageDocs(strapi, data as any[]) };`; `findOne`: `ctx.body = { data: await hydratePageDoc(strapi, doc) };` (import from `../lib/serve-hydrated`).
- `controllers/site-setting.ts` `find`: `ctx.body = { data: await hydrateSiteSetting(strapi, data as any) };`.

- [ ] **Step 6: Run the cms gate and commit**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS / exit 0.

```bash
git add packages/cms
git commit -m "feat(cms): serve-time hydration of media assetId and page documentId refs in composition trees"
```

### Task 7: Lifecycle validation backstop

**Files:**
- Create: `packages/cms/server/src/lib/validate-write.ts`
- Test: `packages/cms/server/src/lib/validate-write.test.ts`
- Modify: `packages/cms/server/src/bootstrap.ts`

**Interfaces:**
- Consumes: `validatePressTree` / `validateNodeArray` from `@ogs-tech/press-shared` (Task 2).
- Produces: `assertValidPageWrite(data: Record<string, unknown> | undefined): void` and `assertValidSiteSettingWrite(data: Record<string, unknown> | undefined): void` — throw `Error` with an actionable multi-line message on ANY error or warning (strict write, Spec §4); no-op when the guarded field is absent (partial updates). `bootstrap` subscribes them via `strapi.db.lifecycles.subscribe`.
- Note: a plain `Error` (not `@strapi/utils` `ValidationError`) is deliberate — it avoids adding a dependency on `@strapi/utils` to the bundled plugin; the admin surfaces the message either way. Named trade-off: the HTTP status is 500 instead of 400; refine later if it bites.

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/server/src/lib/validate-write.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assertValidPageWrite, assertValidSiteSettingWrite } from './validate-write';

const validTree = {
  version: 1,
  root: { type: 'layout', header: { mode: 'inherit' }, footer: { mode: 'inherit' }, children: [] },
};

describe('assertValidPageWrite', () => {
  it('passes valid trees and skips writes without a body (partial update)', () => {
    expect(() => assertValidPageWrite({ body: validTree })).not.toThrow();
    expect(() => assertValidPageWrite({ title: 'x' })).not.toThrow();
    expect(() => assertValidPageWrite(undefined)).not.toThrow();
  });

  it('rejects structural errors AND stripped-attr warnings (strict write)', () => {
    expect(() => assertValidPageWrite({ body: { version: 99 } })).toThrow(/unsupported tree version/);
    const warned = {
      version: 1,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'r', type: 'row', ratio: '50-50', container: { width: 'xl' }, children: [
          { id: 'c', type: 'column', children: [] },
        ] },
      ] },
    };
    expect(() => assertValidPageWrite({ body: warned })).toThrow(/width/);
  });

  it('tolerates a JSON string body (db layer serialization)', () => {
    expect(() => assertValidPageWrite({ body: JSON.stringify(validTree) })).not.toThrow();
    expect(() => assertValidPageWrite({ body: 'not json {' })).toThrow(/invalid composition tree/);
  });
});

describe('assertValidSiteSettingWrite', () => {
  it('validates each pageDefaults slot as a Node[] and skips absent slots', () => {
    expect(() => assertValidSiteSettingWrite({ pageDefaults: { header: [], footer: [] } })).not.toThrow();
    expect(() => assertValidSiteSettingWrite({ name: 'x' })).not.toThrow();
    expect(() =>
      assertValidSiteSettingWrite({ pageDefaults: { header: [{ id: 'c', type: 'column', children: [] }] } }),
    ).toThrow(/only legal directly under a row/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the guards and subscribe**

Create `packages/cms/server/src/lib/validate-write.ts`:

```ts
/**
 * Write-path validation backstop (Spec §4): the builder UI makes invalid trees
 * unreachable; these lifecycle guards protect direct API writes. STRICT: any
 * error OR warning rejects — sanitize-and-accept is the READ side's job.
 */
import { validateNodeArray, validatePressTree, type TreeIssue } from '@ogs-tech/press-shared';

const format = (issues: TreeIssue[]): string => issues.map((i) => `  ${i.path}: ${i.message}`).join('\n');

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return Symbol('unparseable'); // guaranteed to fail validation with a clear message
  }
};

export function assertValidPageWrite(data: Record<string, unknown> | undefined): void {
  const body = data?.body;
  if (body === undefined || body === null) return;
  const { errors, warnings } = validatePressTree(parseMaybeJson(body));
  const issues = [...errors, ...warnings];
  if (issues.length > 0) {
    throw new Error(`[press-cms] invalid composition tree in page.body — write rejected:\n${format(issues)}`);
  }
}

export function assertValidSiteSettingWrite(data: Record<string, unknown> | undefined): void {
  const pd = parseMaybeJson(data?.pageDefaults);
  if (pd === undefined || pd === null) return;
  if (typeof pd !== 'object' || Array.isArray(pd)) {
    throw new Error('[press-cms] pageDefaults must be an object of { header, footer } node arrays — write rejected');
  }
  for (const key of ['header', 'footer'] as const) {
    const slot = (pd as Record<string, unknown>)[key];
    if (slot === undefined || slot === null) continue;
    const { errors, warnings } = validateNodeArray(slot);
    const issues = [...errors, ...warnings];
    if (issues.length > 0) {
      throw new Error(`[press-cms] invalid nodes in pageDefaults.${key} — write rejected:\n${format(issues)}`);
    }
  }
}
```

In `packages/cms/server/src/bootstrap.ts`, subscribe BEFORE the seeds run (seeds write valid trees and must pass their own guard):

```ts
import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { seedCookieConsent } from './lib/seed-cookie-consent';
import { assertValidPageWrite, assertValidSiteSettingWrite } from './lib/validate-write';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Write-path backstop (Spec §4): the admin builder can't produce an invalid
  // tree; raw API writes are rejected here with actionable messages.
  strapi.db.lifecycles.subscribe({
    models: ['plugin::press-cms.page', 'plugin::press-cms.site-setting'],
    beforeCreate(event: any) {
      guard(event);
    },
    beforeUpdate(event: any) {
      guard(event);
    },
  } as any);
  const guard = (event: any): void => {
    if (event.model?.uid === 'plugin::press-cms.page') assertValidPageWrite(event.params?.data);
    else assertValidSiteSettingWrite(event.params?.data);
  };

  await seedSiteSetting(strapi);
  // Order matters: seedCookieConsent updates the record seedSiteSetting creates
  // (and self-heals — without marking its flag — if the record is absent).
  await seedCookieConsent(strapi);
};

export default bootstrap;
```

(Hoist `guard` above the subscribe call — `const` before use; the snippet above shows both pieces, order them correctly in the file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/cms
git commit -m "feat(cms): lifecycle validation backstop for composition-tree writes"
```

### Task 8: pageDefaults seeding

**Files:**
- Modify: `packages/cms/server/src/lib/seed-site-setting.ts`
- Test: `packages/cms/server/src/lib/seed-site-setting.test.ts` (rewrite expectations)

**Interfaces:**
- Consumes: `pluginStore` (existing).
- Produces: `buildDefaultPageDefaults(): { header: Node-shaped[]; footer: Node-shaped[] }` (bare navbar/footer BlockNodes, `crypto.randomUUID` ids); plugin-store flag key `pageDefaultsSeeded`. The old `DEFAULT_CHROME` and `chromeSeeded` flag die. Same choreography as before: create-with-defaults on fresh DB; one fill pass for a pre-existing record; editor-emptied slots respected forever; flag NOT set when the record is missing (self-healing, the seedCookieConsent precedent — here the create branch always produces the record, so the flag always follows an actual write).

- [ ] **Step 1: Rewrite the seeder**

Replace the seeding logic in `packages/cms/server/src/lib/seed-site-setting.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import { pluginStore } from './plugin-store';

/** UID of the engine's Site Settings single type (plugin name `press-cms`). */
export const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

const PAGE_DEFAULTS_SEED_KEY = 'pageDefaultsSeeded';

/**
 * Default chrome (Spec §4): a bare navbar and a bare footer BlockNode per slot.
 * BARE on purpose (no items/cta/text) — the CLI's seed.mjs fills demo content;
 * "no defaults duplicated in the CMS". Fresh ids per call: node ids are
 * builder-scoped React keys, never identity.
 */
export const buildDefaultPageDefaults = () => ({
  header: [{ id: randomUUID(), type: 'block', component: 'preset-organism.navbar', data: {} }],
  footer: [{ id: randomUUID(), type: 'block', component: 'preset-organism.footer', data: {} }],
});

/**
 * Seeds Site Settings pageDefaults exactly once (plugin-store flag): Strapi
 * cannot distinguish a never-touched slot from an editor-emptied one (both read
 * back as []), so after the one seeding pass the slots are never written again.
 */
export async function seedSiteSetting(strapi: Core.Strapi): Promise<void> {
  const docs = strapi.documents(SITE_SETTING_UID);
  const store = pluginStore(strapi);

  // pageDefaults is a JSON scalar — visible without populate.
  const existing = (await docs.findFirst()) as any;

  if (!existing) {
    await docs.create({ data: { pageDefaults: buildDefaultPageDefaults() } as any });
  } else if (!(await store.get({ key: PAGE_DEFAULTS_SEED_KEY }))) {
    const pd = (existing.pageDefaults ?? {}) as { header?: unknown[]; footer?: unknown[] };
    const defaults = buildDefaultPageDefaults();
    const next: Record<string, unknown> = { ...pd };
    let changed = false;
    if (!Array.isArray(pd.header) || pd.header.length === 0) { next.header = defaults.header; changed = true; }
    if (!Array.isArray(pd.footer) || pd.footer.length === 0) { next.footer = defaults.footer; changed = true; }
    if (changed) {
      await docs.update({ documentId: existing.documentId, data: { pageDefaults: next } as any });
    }
  } else {
    return; // seeded before — never touch the defaults again
  }

  await store.set({ key: PAGE_DEFAULTS_SEED_KEY, value: true });
}
```

- [ ] **Step 2: Rewrite the seed test**

Replace `packages/cms/server/src/lib/seed-site-setting.test.ts` with (the existing fake-strapi harness, minus the DZ-populate pin — `pageDefaults` is a JSON scalar and `findFirst()` is called bare now):

```ts
import { describe, expect, it } from 'vitest';
import { seedSiteSetting, SITE_SETTING_UID } from './seed-site-setting';

/** Minimal Document-Service + plugin-store fake (pre-tree harness, populate pin dropped). */
function fakeStrapi(record: any = null, flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: any }> = [];
  const updates: Array<{ documentId: string; data: any }> = [];
  let current = record;
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID);
      return {
        findFirst: async () => current,
        create: async (params: { data: any }) => {
          creates.push(params);
          current = { documentId: 'doc-1', ...params.data };
          return current;
        },
        update: async (params: { documentId: string; data: any }) => {
          updates.push(params);
          current = { ...current, ...params.data };
          return current;
        },
      };
    },
    store: ({ type, name }: { type: string; name: string }) => {
      expect(type).toBe('plugin');
      expect(name).toBe('press-cms');
      return {
        get: async ({ key }: { key: string }) => store.get(key),
        set: async ({ key, value }: { key: string; value: unknown }) => void store.set(key, value),
      };
    },
  } as any;
  return { strapi, creates, updates, store };
}

const expectBareChrome = (pd: any) => {
  expect(pd.header).toHaveLength(1);
  expect(pd.header[0]).toMatchObject({ type: 'block', component: 'preset-organism.navbar', data: {} });
  expect(typeof pd.header[0].id).toBe('string');
  expect(pd.footer[0]).toMatchObject({ type: 'block', component: 'preset-organism.footer', data: {} });
};

describe('seedSiteSetting — pageDefaults (composition-builder Spec §4)', () => {
  it('creates the record WITH bare pageDefaults on a fresh DB and marks the seed done', async () => {
    const { strapi, creates, updates, store } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expectBareChrome(creates[0].data.pageDefaults);
    expect(updates).toEqual([]);
    expect(store.get('pageDefaultsSeeded')).toBe(true);
  });

  it('fills still-empty slots on an existing record exactly once', async () => {
    const { strapi, updates, store } = fakeStrapi({ documentId: 'doc-1', pageDefaults: { header: [], footer: [] } });
    await seedSiteSetting(strapi);
    expect(updates).toHaveLength(1);
    expectBareChrome(updates[0].data.pageDefaults);
    expect(store.get('pageDefaultsSeeded')).toBe(true);
  });

  it('never overwrites a composed slot — only the empty sibling is seeded', async () => {
    const composed = [{ id: 'n1', type: 'block', component: 'preset-organism.navbar', data: { items: [{ label: 'Docs' }] } }];
    const { strapi, updates } = fakeStrapi({ documentId: 'doc-1', pageDefaults: { header: composed, footer: [] } });
    await seedSiteSetting(strapi);
    expect(updates).toHaveLength(1);
    const pd = updates[0].data.pageDefaults as any;
    expect(pd.header).toEqual(composed);
    expect(pd.footer[0]).toMatchObject({ component: 'preset-organism.footer' });
  });

  it('respects an editor-emptied slot once the seed has run (flag set → no writes)', async () => {
    const { strapi, creates, updates } = fakeStrapi(
      { documentId: 'doc-1', pageDefaults: { header: [], footer: [] } },
      { pageDefaultsSeeded: true },
    );
    await seedSiteSetting(strapi);
    expect(creates).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates, updates } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expect(updates).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests, verify, commit**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:back`
Expected: PASS.

```bash
git add packages/cms
git commit -m "feat(cms): seed pageDefaults once with bare navbar/footer block nodes"
```

---

## Phase 3 — `@ogs-tech/press-cms` admin: the builder custom field

Admin-phase prerequisites (fold into Task 9's first commit): add to `packages/cms/package.json` devDependencies — `"react": "^18.3.1"`, `"react-dom": "^18.3.1"`, `"@types/react": "^18"`, `"jsdom": "^25.0.1"` — then `pnpm install`. The root `pnpm.overrides` already pin react 18, so no hoist hazard.

### Task 9: Pure tree operations (`tree-ops`)

**Files:**
- Create: `packages/cms/admin/src/lib/tree-ops.ts`
- Test: `packages/cms/admin/src/lib/tree-ops.test.ts`

**Interfaces:**
- Consumes: `Node`/`RowNode`/`ColumnNode`/`BlockNode`/`Ratio` types from `@ogs-tech/press-shared` (type-only — the admin bundle needs no runtime validator).
- Produces (exact — the React editor calls ONLY these; structural invariants live here, enforced by construction):
  - `type Forest = Node[]` and `type NodePath = number[]` (indices through `children` arrays; a path addresses a node in a slot's forest)
  - `RATIO_SLOTS: Record<Ratio, number>` (`50-50`→2, `33-67`→2, `67-33`→2, `33-33-33`→3, `25-25-25-25`→4)
  - `newBlockNode(component: string): BlockNode` / `newRowNode(ratio: Ratio): RowNode` / `newColumnNode(): ColumnNode`
  - `getNode(forest: Forest, path: NodePath): Node | null`
  - `insertNode(forest: Forest, parentPath: NodePath | null, index: number, node: Node): Forest` — parent `null` = forest root; throws on: column node into a non-row parent, non-column into a row, any child into a block, >4 columns in a row
  - `removeNode(forest: Forest, path: NodePath): Forest`
  - `moveNode(forest: Forest, path: NodePath, delta: -1 | 1): Forest` (clamped, sibling-order swap)
  - `setBlockData(forest: Forest, path: NodePath, data: Record<string, unknown>): Forest`
  - `setContainerAttr(forest: Forest, path: NodePath, key: 'width' | 'gap' | 'verticalAlign', value: string | undefined): Forest` (undefined deletes the key; empty group deletes `container`)
  - `setRowRatio(forest: Forest, path: NodePath, ratio: Ratio): Forest` — GROWS children to `RATIO_SLOTS[ratio]`, never shrinks (extra columns are tolerated by the renderer)
  - `addColumn(forest: Forest, rowPath: NodePath): Forest` (throws at 4)
- All operations are immutable (return a new forest, never mutate).

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/admin/src/lib/tree-ops.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addColumn, getNode, insertNode, moveNode, newBlockNode, newColumnNode, newRowNode,
  RATIO_SLOTS, removeNode, setBlockData, setContainerAttr, setRowRatio, type Forest,
} from './tree-ops';

const forest = (): Forest => {
  const row = newRowNode('50-50');
  return [newBlockNode('preset-organism.hero'), row];
};

describe('node factories', () => {
  it('mints unique string ids and ratio-sized rows', () => {
    const a = newBlockNode('preset-atom.paragraph');
    const b = newBlockNode('preset-atom.paragraph');
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ type: 'block', component: 'preset-atom.paragraph', data: {} });
    const row = newRowNode('33-33-33');
    expect(row.children).toHaveLength(RATIO_SLOTS['33-33-33']);
    expect(row.children.every((c) => c.type === 'column')).toBe(true);
  });
});

describe('insertNode invariants (by construction)', () => {
  it('inserts blocks and rows at the root and inside columns', () => {
    const f = forest();
    const out = insertNode(f, null, 0, newBlockNode('preset-atom.spacer'));
    expect(out).toHaveLength(3);
    expect((out[0] as any).component).toBe('preset-atom.spacer');
    expect(f).toHaveLength(2); // immutable

    const intoColumn = insertNode(out, [2, 0], 0, newRowNode('50-50')); // row INSIDE a column: the recursion point
    expect((getNode(intoColumn, [2, 0, 0]) as any).type).toBe('row');
  });

  it('refuses a column outside a row and a non-column inside a row', () => {
    const f = forest();
    expect(() => insertNode(f, null, 0, newColumnNode())).toThrow(/column/i);
    expect(() => insertNode(f, [1], 0, newBlockNode('preset-atom.spacer'))).toThrow(/row/i);
  });

  it('caps a row at 4 columns', () => {
    let f: Forest = [newRowNode('25-25-25-25')];
    expect(() => insertNode(f, [0], 4, newColumnNode())).toThrow(/4/);
    f = [newRowNode('50-50')];
    f = addColumn(f, [0]);
    f = addColumn(f, [0]);
    expect((f[0] as any).children).toHaveLength(4);
    expect(() => addColumn(f, [0])).toThrow(/4/);
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

  it('setRowRatio grows children to the slot count but never shrinks', () => {
    let f: Forest = [newRowNode('25-25-25-25')];
    f = setRowRatio(f, [0], '50-50');
    expect((f[0] as any).children).toHaveLength(4); // never shrinks (renderer tolerance)
    let g: Forest = [newRowNode('50-50')];
    g = setRowRatio(g, [0], '33-33-33');
    expect((g[0] as any).children).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ogs-tech/press-cms test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement tree-ops**

Create `packages/cms/admin/src/lib/tree-ops.ts`:

```ts
/**
 * Pure, immutable operations on a composition forest (a slot's Node[]). The
 * builder UI calls ONLY these — the structural invariants (Spec §4: Column only
 * under Row, Row children are Columns only, 1–4 columns) are enforced here by
 * construction, which is what makes the lifecycle validator "unreachable" from
 * the admin. No React, no Strapi: unit-tested without a DOM.
 */
import type { BlockNode, ColumnNode, Node, Ratio, RowNode } from '@ogs-tech/press-shared';

export type Forest = Node[];
export type NodePath = number[];

export const RATIO_SLOTS: Record<Ratio, number> = {
  '50-50': 2,
  '33-67': 2,
  '67-33': 2,
  '33-33-33': 3,
  '25-25-25-25': 4,
};

export const MAX_COLUMNS = 4;

const uuid = (): string => globalThis.crypto.randomUUID();

export const newBlockNode = (component: string): BlockNode => ({ id: uuid(), type: 'block', component, data: {} });

export const newColumnNode = (): ColumnNode => ({ id: uuid(), type: 'column', children: [] });

export const newRowNode = (ratio: Ratio): RowNode => ({
  id: uuid(),
  type: 'row',
  ratio,
  children: Array.from({ length: RATIO_SLOTS[ratio] }, () => newColumnNode()),
});

const childrenOf = (node: Node): Node[] =>
  node.type === 'block' ? [] : (node.children as Node[]);

export function getNode(forest: Forest, path: NodePath): Node | null {
  let list: Node[] = forest;
  let node: Node | null = null;
  for (const index of path) {
    node = list[index] ?? null;
    if (!node) return null;
    list = childrenOf(node);
  }
  return node;
}

/** Rebuilds the spine along `path`, applying `update` to the addressed sibling list. */
function updateList(forest: Forest, parentPath: NodePath | null, update: (siblings: Node[], parent: Node | null) => Node[]): Forest {
  if (parentPath === null || parentPath.length === 0) {
    if (parentPath === null) return update([...forest], null);
  }
  const walk = (list: Node[], path: NodePath): Node[] => {
    if (path.length === 0) return update([...list], null);
    const [head, ...rest] = path;
    return list.map((node, i) => {
      if (i !== head) return node;
      if (node.type === 'block') throw new Error('[press-cms] a block node has no children');
      if (rest.length === 0) {
        return { ...node, children: update([...(node.children as Node[])], node) } as Node;
      }
      return { ...node, children: walk(node.children as Node[], rest) } as Node;
    });
  };
  return walk(forest, parentPath ?? []);
}

function assertLegalChild(parent: Node | null, child: Node): void {
  if (parent === null || parent.type === 'column') {
    if (child.type === 'column') throw new Error('[press-cms] a column is only legal directly under a row');
    return;
  }
  if (parent.type === 'row') {
    if (child.type !== 'column') throw new Error('[press-cms] row children must be columns');
    return;
  }
  throw new Error('[press-cms] a block node cannot take children');
}

export function insertNode(forest: Forest, parentPath: NodePath | null, index: number, node: Node): Forest {
  const parent = parentPath === null ? null : getNode(forest, parentPath);
  if (parentPath !== null && !parent) throw new Error('[press-cms] insert parent not found');
  assertLegalChild(parent, node);
  if (parent?.type === 'row' && (parent.children as Node[]).length >= MAX_COLUMNS) {
    throw new Error(`[press-cms] a row carries at most ${MAX_COLUMNS} columns`);
  }
  return updateList(forest, parentPath, (siblings) => {
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, node);
    return siblings;
  });
}

export function removeNode(forest: Forest, path: NodePath): Forest {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return updateList(forest, parentPath.length ? parentPath : null, (siblings) => {
    siblings.splice(index, 1);
    return siblings;
  });
}

export function moveNode(forest: Forest, path: NodePath, delta: -1 | 1): Forest {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return updateList(forest, parentPath.length ? parentPath : null, (siblings) => {
    const target = index + delta;
    if (target < 0 || target >= siblings.length) return siblings;
    const [node] = siblings.splice(index, 1);
    siblings.splice(target, 0, node);
    return siblings;
  });
}

function patchNode(forest: Forest, path: NodePath, patch: (node: Node) => Node): Forest {
  const parentPath = path.slice(0, -1);
  const index = path[path.length - 1];
  return updateList(forest, parentPath.length ? parentPath : null, (siblings) => {
    if (!siblings[index]) throw new Error('[press-cms] node not found at path');
    siblings[index] = patch(siblings[index]);
    return siblings;
  });
}

export function setBlockData(forest: Forest, path: NodePath, data: Record<string, unknown>): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type !== 'block') throw new Error('[press-cms] setBlockData targets block nodes');
    return { ...node, data };
  });
}

export function setContainerAttr(
  forest: Forest,
  path: NodePath,
  key: 'width' | 'gap' | 'verticalAlign',
  value: string | undefined,
): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type === 'block') throw new Error('[press-cms] blocks carry no container attrs');
    const container = { ...(node.container ?? {}) } as Record<string, unknown>;
    if (value === undefined) delete container[key];
    else container[key] = value;
    const next = { ...node } as Node & { container?: Record<string, unknown> };
    if (Object.keys(container).length === 0) delete next.container;
    else next.container = container;
    return next as Node;
  });
}

export function setRowRatio(forest: Forest, path: NodePath, ratio: Ratio): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type !== 'row') throw new Error('[press-cms] setRowRatio targets row nodes');
    const children = [...node.children];
    while (children.length < RATIO_SLOTS[ratio]) children.push(newColumnNode());
    return { ...node, ratio, children };
  });
}

export function addColumn(forest: Forest, rowPath: NodePath): Forest {
  const row = getNode(forest, rowPath);
  if (!row || row.type !== 'row') throw new Error('[press-cms] addColumn targets row nodes');
  return insertNode(forest, rowPath, row.children.length, newColumnNode());
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:front`
Expected: PASS / exit 0.

```bash
git add packages/cms pnpm-lock.yaml
git commit -m "feat(cms-admin): pure immutable tree operations with structural invariants"
```

### Task 10: Registry-driven form model

**Files:**
- Create: `packages/cms/admin/src/lib/form-model.ts`
- Test: `packages/cms/admin/src/lib/form-model.test.ts`

**Interfaces:**
- Consumes: `Attr`, `PressSchema` types from `@ogs-tech/press-shared`.
- Produces (exact — `node-form.tsx` renders from these, no other schema knowledge):
  - `type FieldKind = 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'media' | 'pageRef' | 'component' | 'json'`
  - `interface FieldDescriptor { name: string; kind: FieldKind; required: boolean; options?: string[]; component?: string; repeatable?: boolean }`
  - `fieldsFor(attributes: Record<string, Attr>): FieldDescriptor[]`
  - `applicableContainerAttrs(nodeType: 'layout' | 'row' | 'column', topLevel: boolean): Array<'width' | 'gap' | 'verticalAlign'>`
  - `paletteGroups(schema: PressSchema): Array<{ category: string; uids: string[] }>` — placeable BLOCK uids grouped by category, sorted; excludes `preset-config.*`, `preset-layout.*`, `preset-template.*`, `preset-molecule.*` (nested-only, never placed)
- Attr→kind mapping: `string`/`uid`→`text`; `text`→`textarea`; `enumeration`→`select`; `boolean`→`checkbox`; `integer|biginteger|float|decimal`→`number`; `media`→`media`; `relation` with `target: 'plugin::press-cms.page'`→`pageRef`; `component`→`component` (uid + repeatable); `json`→`json`; anything else → skipped.

- [ ] **Step 1: Write the failing tests**

Create `packages/cms/admin/src/lib/form-model.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applicableContainerAttrs, fieldsFor, paletteGroups } from './form-model';

describe('fieldsFor', () => {
  it('maps the contract attribute types to field kinds', () => {
    const fields = fieldsFor({
      title: { type: 'string', required: true },
      content: { type: 'text' },
      align: { type: 'enumeration', enum: ['left', 'center'] },
      newTab: { type: 'boolean' },
      image: { type: 'media', multiple: false },
      page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' } as any,
      cta: { type: 'component', component: 'preset-molecule.link', repeatable: false },
      items: { type: 'component', component: 'preset-molecule.link', repeatable: true },
      blob: { type: 'json' },
      mystery: { type: 'password' },
    });
    expect(fields).toEqual([
      { name: 'title', kind: 'text', required: true },
      { name: 'content', kind: 'textarea', required: false },
      { name: 'align', kind: 'select', required: false, options: ['left', 'center'] },
      { name: 'newTab', kind: 'checkbox', required: false },
      { name: 'image', kind: 'media', required: false },
      { name: 'page', kind: 'pageRef', required: false },
      { name: 'cta', kind: 'component', required: false, component: 'preset-molecule.link', repeatable: false },
      { name: 'items', kind: 'component', required: false, component: 'preset-molecule.link', repeatable: true },
      { name: 'blob', kind: 'json', required: false },
    ]);
  });
});

describe('applicableContainerAttrs', () => {
  it('shows only the attrs that apply per node type (Spec §3)', () => {
    expect(applicableContainerAttrs('layout', true)).toEqual(['gap']);
    expect(applicableContainerAttrs('row', true)).toEqual(['width', 'gap', 'verticalAlign']);
    expect(applicableContainerAttrs('row', false)).toEqual(['gap', 'verticalAlign']); // width is top-level-only
    expect(applicableContainerAttrs('column', false)).toEqual(['gap', 'verticalAlign']);
  });
});

describe('paletteGroups', () => {
  it('groups placeable uids by category, excluding nested-only and config layers', () => {
    const schema = {
      contentTypes: {},
      components: Object.fromEntries([
        'preset-atom.paragraph', 'preset-atom.heading',
        'preset-organism.hero', 'preset-organism.navbar',
        'preset-molecule.link', 'preset-config.seo', 'preset-layout.container',
        'custom-organism.callout',
      ].map((uid) => [uid, { uid, attributes: {} }])),
    } as any;
    expect(paletteGroups(schema)).toEqual([
      { category: 'custom-organism', uids: ['custom-organism.callout'] },
      { category: 'preset-atom', uids: ['preset-atom.heading', 'preset-atom.paragraph'] },
      { category: 'preset-organism', uids: ['preset-organism.hero', 'preset-organism.navbar'] },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Run: `pnpm --filter @ogs-tech/press-cms test` — expected FAIL.

Create `packages/cms/admin/src/lib/form-model.ts`:

```ts
/**
 * Registry schema → form descriptors. This is the whole "forms are generated
 * from the schema catalog" mechanism (Spec §4): node-form.tsx renders from
 * these descriptors and nothing else, so a new block (preset or custom) gets a
 * working form with zero admin code. `preset-molecule.link` needs NO special
 * case — its `page` relation maps to the pageRef dropdown like any other.
 */
import type { Attr, PressSchema } from '@ogs-tech/press-shared';

export type FieldKind =
  | 'text' | 'textarea' | 'select' | 'checkbox' | 'number'
  | 'media' | 'pageRef' | 'component' | 'json';

export interface FieldDescriptor {
  name: string;
  kind: FieldKind;
  required: boolean;
  options?: string[];
  component?: string;
  repeatable?: boolean;
}

const PAGE_TARGET = 'plugin::press-cms.page';
const NUMBERS = new Set(['integer', 'biginteger', 'float', 'decimal']);

export function fieldsFor(attributes: Record<string, Attr>): FieldDescriptor[] {
  const out: FieldDescriptor[] = [];
  for (const [name, attr] of Object.entries(attributes ?? {})) {
    const base = { name, required: attr.required === true };
    switch (attr.type) {
      case 'string':
      case 'uid':
        out.push({ ...base, kind: 'text' });
        break;
      case 'text':
        out.push({ ...base, kind: 'textarea' });
        break;
      case 'enumeration':
        out.push({ ...base, kind: 'select', options: attr.enum ?? [] });
        break;
      case 'boolean':
        out.push({ ...base, kind: 'checkbox' });
        break;
      case 'media':
        out.push({ ...base, kind: 'media' });
        break;
      case 'relation':
        if ((attr as Record<string, unknown>).target === PAGE_TARGET) out.push({ ...base, kind: 'pageRef' });
        break;
      case 'component':
        if (typeof attr.component === 'string') {
          out.push({ ...base, kind: 'component', component: attr.component, repeatable: attr.repeatable === true });
        }
        break;
      case 'json':
        out.push({ ...base, kind: 'json' });
        break;
      default:
        if (attr.type && NUMBERS.has(attr.type)) out.push({ ...base, kind: 'number' });
        // anything else (password, dynamiczone, …) is not form-editable — skipped
    }
  }
  return out;
}

/** Which shared container attrs the form shows per node type (Spec §3: non-applicable attrs are hidden). */
export function applicableContainerAttrs(
  nodeType: 'layout' | 'row' | 'column',
  topLevel: boolean,
): Array<'width' | 'gap' | 'verticalAlign'> {
  if (nodeType === 'layout') return ['gap'];
  if (nodeType === 'row') return topLevel ? ['width', 'gap', 'verticalAlign'] : ['gap', 'verticalAlign'];
  return ['gap', 'verticalAlign'];
}

/** Categories whose components are never PLACED as blocks (nested-only / settings / descriptors). */
const NON_PLACEABLE = /^preset-(molecule|config|layout|template)$/;

export function paletteGroups(schema: PressSchema): Array<{ category: string; uids: string[] }> {
  const byCategory = new Map<string, string[]>();
  for (const uid of Object.keys(schema.components ?? {})) {
    const category = uid.split('.')[0];
    if (NON_PLACEABLE.test(category)) continue;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(uid);
  }
  return [...byCategory.entries()]
    .map(([category, uids]) => ({ category, uids: uids.sort() }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
```

- [ ] **Step 3: Run tests, typecheck, commit**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:front`
Expected: PASS.

```bash
git add packages/cms
git commit -m "feat(cms-admin): registry-driven form model (descriptors, container applicability, palette groups)"
```

### Task 11: Builder Input component + custom-field registration

**Files:**
- Create: `packages/cms/admin/src/lib/press-data.ts`
- Create: `packages/cms/admin/src/components/node-form.tsx`
- Create: `packages/cms/admin/src/components/tree-editor.tsx`
- Create: `packages/cms/admin/src/components/builder-input.tsx`
- Modify: `packages/cms/admin/src/index.ts`
- Test: `packages/cms/admin/src/components/builder-input.test.tsx`

**Interfaces:**
- Consumes: `tree-ops` (Task 9), `form-model` (Task 10), `PressSchema`/`PressTree` types; `GET /api/press/schema` and `GET /api/pages` (public routes).
- Produces: default-exported `BuilderInput` React component receiving Strapi custom-field Input props `{ name, attribute, value, onChange, disabled?, label?, hint?, error? }`; registered as `plugin::press-cms.builder` in the admin. Two modes from `attribute.options?.mode`: default (a full `PressTree` with slot-mode editors) and `'slots'` (the `{ header, footer }` pageDefaults shape). `onChange` always emits `{ target: { name, value: <object>, type: 'json' } }`.
- v1 UI contract (structural, Spec §4): collapsible `<details>` per node; add (palette select + button) / remove / ↑ / ↓; Row form = ratio select + Add column; Container section shows only applicable attrs with an "engine default" empty option; media fields store `{ assetId }` via Strapi's media-library dialog when available (`useStrapiApp` → `components['media-library']`), with a numeric-id input fallback; pageRef fields are a published-pages dropdown storing `{ documentId }`.

- [ ] **Step 1: Data fetching cache**

Create `packages/cms/admin/src/lib/press-data.ts`:

```ts
/**
 * Admin-side data for the builder: the schema catalog (form generation) and the
 * published pages list (pageRef dropdowns). Module-level promise cache — the
 * admin runs same-origin with the API, both routes are public engine routes.
 */
import type { PressSchema } from '@ogs-tech/press-shared';

export interface PageOption {
  documentId: string;
  title: string;
  slug: string;
}

let schemaPromise: Promise<PressSchema> | null = null;
let pagesPromise: Promise<PageOption[]> | null = null;

export function fetchPressSchema(): Promise<PressSchema> {
  schemaPromise ??= fetch('/api/press/schema').then((res) => {
    if (!res.ok) throw new Error(`schema fetch failed: ${res.status}`);
    return res.json() as Promise<PressSchema>;
  });
  return schemaPromise;
}

export function fetchPages(): Promise<PageOption[]> {
  pagesPromise ??= fetch('/api/pages')
    .then((res) => (res.ok ? res.json() : { data: [] }))
    .then((json: { data: Array<{ documentId: string; title?: string; slug?: string }> }) =>
      (json.data ?? []).map((p) => ({ documentId: p.documentId, title: p.title ?? p.slug ?? p.documentId, slug: p.slug ?? '' })),
    );
  return pagesPromise;
}

/** Test seam: reset the module cache between vitest cases. */
export function resetPressDataCache(): void {
  schemaPromise = null;
  pagesPromise = null;
}
```

- [ ] **Step 2: The registry-driven node form**

Create `packages/cms/admin/src/components/node-form.tsx`:

```tsx
/**
 * Per-block form generated from the schema catalog (Spec §4). Renders one input
 * per FieldDescriptor; nested `component` descriptors recurse with the
 * referenced component's own descriptors — so preset-molecule.link, the navbar
 * cta chain (navbar → button → link) and any custom nesting all work with zero
 * per-block code. Plain HTML elements on purpose (no design-system dep).
 */
import { useEffect, useState } from 'react';
import type { PressSchema } from '@ogs-tech/press-shared';
import { fieldsFor, type FieldDescriptor } from '../lib/form-model';
import { fetchPages, type PageOption } from '../lib/press-data';

interface NodeFormProps {
  componentUid: string;
  schema: PressSchema;
  data: Record<string, unknown>;
  disabled?: boolean;
  onChange(data: Record<string, unknown>): void;
  /** Injectable media picker (tests stub it; production wires the media-library dialog). */
  MediaField: (props: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) => JSX.Element;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function PageRefField({ value, disabled, onChange }: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) {
  const [pages, setPages] = useState<PageOption[]>([]);
  useEffect(() => {
    let live = true;
    fetchPages().then((p) => live && setPages(p)).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const current = isRecord(value) && typeof value.documentId === 'string' ? value.documentId : '';
  return (
    <select
      disabled={disabled}
      value={current}
      onChange={(e) => onChange(e.target.value ? { documentId: e.target.value } : undefined)}
    >
      <option value="">— none —</option>
      {pages.map((p) => (
        <option key={p.documentId} value={p.documentId}>{p.title} (/{p.slug})</option>
      ))}
    </select>
  );
}

function Field({ field, schema, value, disabled, onChange, MediaField }: {
  field: FieldDescriptor;
  schema: PressSchema;
  value: unknown;
  disabled?: boolean;
  onChange(v: unknown): void;
  MediaField: NodeFormProps['MediaField'];
}) {
  switch (field.kind) {
    case 'text':
      return <input type="text" disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'textarea':
      return <textarea rows={4} disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'number':
      return <input type="number" disabled={disabled} value={value === undefined || value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'checkbox':
      return <input type="checkbox" disabled={disabled} checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case 'select':
      return (
        <select disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">— default —</option>
          {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case 'media':
      return <MediaField value={value} disabled={disabled} onChange={onChange} />;
    case 'pageRef':
      return <PageRefField value={value} disabled={disabled} onChange={onChange} />;
    case 'json':
      return (
        <textarea
          rows={4}
          disabled={disabled}
          defaultValue={value === undefined ? '' : JSON.stringify(value, null, 2)}
          onBlur={(e) => {
            try { onChange(e.target.value ? JSON.parse(e.target.value) : undefined); } catch { /* keep last valid value */ }
          }}
        />
      );
    case 'component': {
      const nested = field.component ? schema.components[field.component] : undefined;
      if (!nested) return <em>unknown component {field.component}</em>;
      if (field.repeatable) {
        const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        return (
          <div data-press-repeat="">
            {items.map((item, i) => (
              <fieldset key={i}>
                <NodeForm componentUid={field.component!} schema={schema} data={isRecord(item) ? item : {}} disabled={disabled}
                  onChange={(next) => onChange(items.map((it, j) => (j === i ? next : it)))} MediaField={MediaField} />
                <button type="button" disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
              </fieldset>
            ))}
            <button type="button" disabled={disabled} onClick={() => onChange([...items, {}])}>Add {field.name}</button>
          </div>
        );
      }
      return (
        <NodeForm componentUid={field.component!} schema={schema} data={isRecord(value) ? (value as Record<string, unknown>) : {}}
          disabled={disabled} onChange={(next) => onChange(next)} MediaField={MediaField} />
      );
    }
    default:
      return null;
  }
}

export function NodeForm({ componentUid, schema, data, disabled, onChange, MediaField }: NodeFormProps) {
  const component = schema.components[componentUid];
  if (!component) return <em>unknown component {componentUid}</em>;
  const fields = fieldsFor(component.attributes);
  return (
    <div data-press-form={componentUid}>
      {fields.map((field) => (
        <label key={field.name} style={{ display: 'block', marginBottom: 8 }}>
          <span style={{ display: 'block', fontWeight: 600 }}>{field.name}{field.required ? ' *' : ''}</span>
          <Field field={field} schema={schema} value={data[field.name]} disabled={disabled} MediaField={MediaField}
            onChange={(v) => {
              const next = { ...data };
              if (v === undefined) delete next[field.name];
              else next[field.name] = v;
              onChange(next);
            }} />
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: The recursive tree editor**

Create `packages/cms/admin/src/components/tree-editor.tsx`:

```tsx
/**
 * Structural tree editor (Spec §4 v1): collapsible nodes, add/remove/reorder
 * via buttons, per-node forms. All mutations go through tree-ops, so the
 * structural invariants hold by construction.
 */
import { useState } from 'react';
import type { PressSchema, Ratio } from '@ogs-tech/press-shared';
import { applicableContainerAttrs, paletteGroups } from '../lib/form-model';
import {
  addColumn, insertNode, moveNode, newBlockNode, newRowNode, removeNode,
  setBlockData, setContainerAttr, setRowRatio, type Forest, type NodePath,
} from '../lib/tree-ops';
import { NodeForm } from './node-form';

const RATIOS: Ratio[] = ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'];
const CONTAINER_OPTIONS: Record<'width' | 'gap' | 'verticalAlign', string[]> = {
  width: ['prose', 'lg', 'full'],
  gap: ['compact', 'normal', 'spacious'],
  verticalAlign: ['top', 'center', 'bottom'],
};

export interface TreeEditorProps {
  forest: Forest;
  schema: PressSchema;
  disabled?: boolean;
  onChange(forest: Forest): void;
  MediaField: Parameters<typeof NodeForm>[0]['MediaField'];
}

function AddControls({ schema, disabled, onAdd }: { schema: PressSchema; disabled?: boolean; onAdd(kind: string): void }) {
  const [pick, setPick] = useState('');
  const groups = paletteGroups(schema);
  return (
    <div data-press-add="">
      <select aria-label="Add node" disabled={disabled} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">Add…</option>
        <option value="row">Row (columns layout)</option>
        {groups.map((g) => (
          <optgroup key={g.category} label={g.category}>
            {g.uids.map((uid) => <option key={uid} value={uid}>{uid.split('.')[1]}</option>)}
          </optgroup>
        ))}
      </select>
      <button type="button" disabled={disabled || !pick} onClick={() => { onAdd(pick); setPick(''); }}>Add</button>
    </div>
  );
}

function ContainerSection({ nodeType, topLevel, container, disabled, onSet }: {
  nodeType: 'row' | 'column';
  topLevel: boolean;
  container: Record<string, unknown> | undefined;
  disabled?: boolean;
  onSet(key: 'width' | 'gap' | 'verticalAlign', value: string | undefined): void;
}) {
  const attrs = applicableContainerAttrs(nodeType, topLevel);
  return (
    <fieldset data-press-container="">
      <legend>Container</legend>
      {attrs.map((key) => (
        <label key={key}>
          {key}
          <select disabled={disabled} value={(container?.[key] as string) ?? ''} onChange={(e) => onSet(key, e.target.value || undefined)}>
            <option value="">engine default</option>
            {CONTAINER_OPTIONS[key].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

export function TreeEditor({ forest, schema, disabled, onChange, MediaField }: TreeEditorProps) {
  const add = (parentPath: NodePath | null, index: number, kind: string): void => {
    const node = kind === 'row' ? newRowNode('50-50') : newBlockNode(kind);
    onChange(insertNode(forest, parentPath, index, node));
  };

  const renderForest = (nodes: Forest, parentPath: NodePath | null, topLevel: boolean): JSX.Element => (
    <div data-press-forest="">
      {nodes.map((node, i) => {
        const path = [...(parentPath ?? []), i];
        const key = node.id;
        const controls = (
          <span data-press-controls="">
            <button type="button" aria-label={`Move up ${key}`} disabled={disabled} onClick={() => onChange(moveNode(forest, path, -1))}>↑</button>
            <button type="button" aria-label={`Move down ${key}`} disabled={disabled} onClick={() => onChange(moveNode(forest, path, 1))}>↓</button>
            <button type="button" aria-label={`Remove ${key}`} disabled={disabled} onClick={() => onChange(removeNode(forest, path))}>✕</button>
          </span>
        );
        if (node.type === 'block') {
          return (
            <details key={key} data-press-node="block">
              <summary>{node.component} {controls}</summary>
              <NodeForm componentUid={node.component} schema={schema} data={node.data} disabled={disabled}
                onChange={(data) => onChange(setBlockData(forest, path, data))} MediaField={MediaField} />
            </details>
          );
        }
        // node.type === 'row' (columns render inside it; tree-ops never yields a stray column)
        return (
          <details key={key} data-press-node="row" open>
            <summary>Row · {node.ratio} {controls}</summary>
            <label>
              ratio
              <select disabled={disabled} value={node.ratio} onChange={(e) => onChange(setRowRatio(forest, path, e.target.value as Ratio))}>
                {RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <ContainerSection nodeType="row" topLevel={topLevel} container={node.container as Record<string, unknown> | undefined}
              disabled={disabled} onSet={(k, v) => onChange(setContainerAttr(forest, path, k, v))} />
            <div data-press-columns="">
              {node.children.map((column, ci) => {
                const columnPath = [...path, ci];
                return (
                  <fieldset key={column.id} data-press-node="column">
                    <legend>
                      Column {ci + 1}
                      <button type="button" aria-label={`Remove ${column.id}`} disabled={disabled} onClick={() => onChange(removeNode(forest, columnPath))}>✕</button>
                    </legend>
                    <ContainerSection nodeType="column" topLevel={false} container={column.container as Record<string, unknown> | undefined}
                      disabled={disabled} onSet={(k, v) => onChange(setContainerAttr(forest, columnPath, k, v))} />
                    {renderForest(column.children, columnPath, false)}
                    <AddControls schema={schema} disabled={disabled} onAdd={(kind) => add(columnPath, column.children.length, kind)} />
                  </fieldset>
                );
              })}
              <button type="button" disabled={disabled} onClick={() => onChange(addColumn(forest, path))}>Add column</button>
            </div>
          </details>
        );
      })}
      <AddControls schema={schema} disabled={disabled} onAdd={(kind) => add(parentPath, nodes.length, kind)} />
    </div>
  );

  return renderForest(forest, null, true);
}
```

- [ ] **Step 4: The custom-field Input (both modes) + registration**

Create `packages/cms/admin/src/components/builder-input.tsx`:

```tsx
/**
 * The `plugin::press-cms.builder` custom-field Input (Spec §4). Two shapes:
 *  - default: a full PressTree (page body) with header/footer slot-mode editors
 *  - options.mode === 'slots': the Site Settings pageDefaults `{ header, footer }`
 * Value tolerance: Strapi hands the form value as an object (or a JSON string on
 * some paths) — normalize on the way in, always emit an object with type 'json'.
 */
import { useEffect, useState } from 'react';
import { useStrapiApp } from '@strapi/strapi/admin';
import type { Node, PressSchema, PressTree, Slot } from '@ogs-tech/press-shared';
import { fetchPressSchema } from '../lib/press-data';
import type { Forest } from '../lib/tree-ops';
import { TreeEditor } from './tree-editor';

interface BuilderInputProps {
  name: string;
  attribute: { options?: { mode?: string } };
  value?: unknown;
  disabled?: boolean;
  label?: string;
  hint?: string;
  error?: string;
  onChange(event: { target: { name: string; value: unknown; type: string } }): void;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const parseValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return undefined; }
};

const emptyTree = (): PressTree => ({
  version: 1,
  root: { type: 'layout', header: { mode: 'inherit' }, footer: { mode: 'inherit' }, children: [] },
});

/** Media field: Strapi's media-library dialog when registered, else a bare asset-id input. Stores { assetId }. */
function MediaField({ value, disabled, onChange }: { value: unknown; disabled?: boolean; onChange(v: unknown): void }) {
  const components = useStrapiApp('PressBuilderMediaField', (state: any) => state.components);
  const MediaLibraryDialog = components?.['media-library'];
  const [open, setOpen] = useState(false);
  const assetId = isRecord(value) && typeof value.assetId === 'number' ? value.assetId : undefined;
  if (!MediaLibraryDialog) {
    return (
      <input
        type="number"
        placeholder="asset id"
        disabled={disabled}
        value={assetId ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : { assetId: Number(e.target.value) })}
      />
    );
  }
  return (
    <span>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}>
        {assetId ? `Asset #${assetId} — change` : 'Pick media'}
      </button>
      {assetId ? <button type="button" disabled={disabled} onClick={() => onChange(undefined)}>Clear</button> : null}
      {open ? (
        <MediaLibraryDialog
          allowedTypes={['images']}
          onClose={() => setOpen(false)}
          onSelectAssets={(assets: Array<{ id: number }>) => {
            if (assets[0]) onChange({ assetId: assets[0].id });
            setOpen(false);
          }}
        />
      ) : null}
    </span>
  );
}

function SlotEditor({ title, slot, schema, disabled, onChange }: {
  title: string;
  slot: Slot;
  schema: PressSchema;
  disabled?: boolean;
  onChange(slot: Slot): void;
}) {
  return (
    <fieldset data-press-slot={title}>
      <legend>{title}</legend>
      <select
        aria-label={`${title} mode`}
        disabled={disabled}
        value={slot.mode}
        onChange={(e) => {
          const mode = e.target.value as Slot['mode'];
          onChange(mode === 'custom' ? { mode, children: slot.mode === 'custom' ? slot.children : [] } : { mode });
        }}
      >
        <option value="inherit">inherit site defaults</option>
        <option value="none">none (bare page)</option>
        <option value="custom">custom</option>
      </select>
      {slot.mode === 'custom' ? (
        <TreeEditor forest={slot.children as Forest} schema={schema} disabled={disabled}
          onChange={(children) => onChange({ mode: 'custom', children: children as Node[] })} MediaField={MediaField} />
      ) : null}
    </fieldset>
  );
}

export default function BuilderInput({ name, attribute, value, disabled, label, hint, error, onChange }: BuilderInputProps) {
  const [schema, setSchema] = useState<PressSchema | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetchPressSchema()
      .then((s) => live && setSchema(s))
      .catch((e) => live && setLoadError(String(e)));
    return () => { live = false; };
  }, []);

  const emit = (next: unknown): void => onChange({ target: { name, value: next, type: 'json' } });
  const parsed = parseValue(value);

  if (loadError) return <p role="alert">press builder: schema unavailable ({loadError})</p>;
  if (!schema) return <p>Loading press schema…</p>;

  const slotsMode = attribute.options?.mode === 'slots';

  if (slotsMode) {
    const pd = isRecord(parsed) ? parsed : {};
    const header = Array.isArray(pd.header) ? (pd.header as Forest) : [];
    const footer = Array.isArray(pd.footer) ? (pd.footer as Forest) : [];
    return (
      <div data-press-builder="slots">
        {label ? <strong>{label}</strong> : null}
        <fieldset><legend>header</legend>
          <TreeEditor forest={header} schema={schema} disabled={disabled}
            onChange={(next) => emit({ ...pd, header: next })} MediaField={MediaField} />
        </fieldset>
        <fieldset><legend>footer</legend>
          <TreeEditor forest={footer} schema={schema} disabled={disabled}
            onChange={(next) => emit({ ...pd, footer: next })} MediaField={MediaField} />
        </fieldset>
        {hint ? <small>{hint}</small> : null}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    );
  }

  const tree: PressTree = isRecord(parsed) && isRecord(parsed.root) ? (parsed as unknown as PressTree) : emptyTree();
  const setRoot = (patch: Partial<PressTree['root']>): void => emit({ ...tree, root: { ...tree.root, ...patch } });

  return (
    <div data-press-builder="tree">
      {label ? <strong>{label}</strong> : null}
      <SlotEditor title="header" slot={tree.root.header} schema={schema} disabled={disabled} onChange={(header) => setRoot({ header })} />
      <fieldset data-press-slot="body">
        <legend>body</legend>
        <TreeEditor forest={tree.root.children as Forest} schema={schema} disabled={disabled}
          onChange={(children) => setRoot({ children: children as Node[] })} MediaField={MediaField} />
      </fieldset>
      <SlotEditor title="footer" slot={tree.root.footer} schema={schema} disabled={disabled} onChange={(footer) => setRoot({ footer })} />
      {hint ? <small>{hint}</small> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
```

In `packages/cms/admin/src/index.ts`, replace the `register()` no-op with the custom-field registration (keep `registerTrads` and `CATEGORY_LABELS` — drop only the `preset-molecule`-specific wording if any comment mentions nav-item):

```ts
export default {
  register(app: any): void {
    app.customFields.register({
      name: 'builder',
      pluginId: 'press-cms',
      type: 'json',
      intlLabel: { id: 'press-cms.builder.label', defaultMessage: 'Composition' },
      intlDescription: { id: 'press-cms.builder.description', defaultMessage: 'The press composition tree (layout + blocks)' },
      components: {
        Input: async () => import('./components/builder-input'),
      },
      options: { base: [], advanced: [] },
    });
  },
  async registerTrads({ locales }: { locales: string[] }): Promise<TradEntry[]> {
    return locales.map((locale) => ({ locale, data: CATEGORY_LABELS[locale] ?? {} }));
  },
};
```

- [ ] **Step 5: Smoke tests (jsdom, hand-rolled harness — the repo's react-19 RTL constraint)**

Create `packages/cms/admin/src/components/builder-input.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import BuilderInput from './builder-input';
import { resetPressDataCache } from '../lib/press-data';

vi.mock('@strapi/strapi/admin', () => ({
  useStrapiApp: () => undefined, // no media-library in tests → assetId input fallback
}));

const SCHEMA = {
  tree: { version: 1 },
  contentTypes: {},
  components: {
    'preset-atom.paragraph': { uid: 'preset-atom.paragraph', attributes: { content: { type: 'text', required: true } } },
    'preset-organism.navbar': { uid: 'preset-organism.navbar', attributes: { items: { type: 'component', component: 'preset-molecule.link', repeatable: true } } },
    'preset-molecule.link': { uid: 'preset-molecule.link', attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean' } } },
  },
};

let container: HTMLDivElement;
let root: Root;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  resetPressDataCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/api/press/schema') ? SCHEMA : { data: [{ documentId: 'home-doc', title: 'Home', slug: 'home' }] }),
  })));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const flush = async () => act(async () => { await Promise.resolve(); });

describe('BuilderInput (tree mode)', () => {
  it('renders slot editors + body forest from an empty value and emits a tree on add', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <BuilderInput name="body" attribute={{}} value={undefined} onChange={onChange} />,
      );
    });
    await flush();
    expect(container.textContent).toContain('header');
    expect(container.textContent).toContain('body');

    const select = container.querySelector('[data-press-slot="body"] select[aria-label="Add node"]') as HTMLSelectElement;
    const addButton = select.parentElement!.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      select.value = 'preset-atom.paragraph';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { addButton.click(); });

    const emitted = onChange.mock.calls.at(-1)![0].target;
    expect(emitted.type).toBe('json');
    expect(emitted.value.version).toBe(1);
    expect(emitted.value.root.children).toHaveLength(1);
    expect(emitted.value.root.children[0]).toMatchObject({ type: 'block', component: 'preset-atom.paragraph', data: {} });
    expect(typeof emitted.value.root.children[0].id).toBe('string');
  });
});

describe('BuilderInput (slots mode)', () => {
  it('edits { header, footer } node arrays', async () => {
    const onChange = vi.fn();
    const value = { header: [{ id: 'n1', type: 'block', component: 'preset-organism.navbar', data: {} }], footer: [] };
    await act(async () => {
      root.render(
        <BuilderInput name="pageDefaults" attribute={{ options: { mode: 'slots' } }} value={value} onChange={onChange} />,
      );
    });
    await flush();
    expect(container.textContent).toContain('preset-organism.navbar');
  });
});
```

- [ ] **Step 6: Run tests + both typechecks + a real build**

Run: `pnpm --filter @ogs-tech/press-cms test && pnpm --filter @ogs-tech/press-cms test:ts:front && pnpm --filter @ogs-tech/press-cms test:ts:back && pnpm --filter @ogs-tech/press-cms build`
Expected: PASS everywhere; the strapi-plugin build compiles the admin bundle with the new components.

- [ ] **Step 7: Manual verification note (deferred to Task 21's playground boot)**

The media-library dialog wiring (`useStrapiApp` → `components['media-library']`) and the custom field's value round-trip through the content-manager CANNOT be proven by unit tests — Task 21 verifies them in the running playground admin (add a hero with an image via the picker; save; confirm `{ assetId }` in the DB and a hydrated URL on `/api/pages/home`). If the dialog component key differs in the installed Strapi 5.48 build, the fallback assetId input keeps the builder usable; fix the key there.

- [ ] **Step 8: Commit**

```bash
git add packages/cms
git commit -m "feat(cms-admin): structural composition-builder custom field (tree + slots modes, registry-driven forms)"
```

---

## Phase 4 — `@ogs-tech/press-web`: link, atoms, tree renderer, host, type-sync

Phase-4 prerequisite (fold into Task 12's commit): in `packages/web/package.json`, MOVE `"@ogs-tech/press-shared": "workspace:*"` from `devDependencies` to `dependencies` (Decision 3 — adopters need the validator at runtime; pnpm rewrites `workspace:*` to the exact version at publish), then `pnpm install`.

### Task 12: Link primitives (`resolveLink` + `<PressLink>`)

**Files:**
- Create: `packages/web/src/link.ts`
- Create: `packages/web/src/press-link.tsx`
- Test: `packages/web/src/link.test.ts`

**Interfaces:**
- Consumes: nothing engine-internal.
- Produces (exact — every linking component and the hydrator use these):
  - `interface PressLinkData { label?: string; page?: { documentId?: string; slug?: string } | null; url?: string; newTab?: boolean }` (the hydrated wire shape of `preset-molecule.link`)
  - `interface ResolvedLink { label: string; href: string; external: boolean; newTab: boolean }`
  - `resolveLink(link: PressLinkData | null | undefined, homeSlug?: string): ResolvedLink | null` — precedence `page > url`; `page.slug === homeSlug` → `'/'`; page without slug (unpublished) falls back to `url`, else null; `external` true only for http(s); dangerous protocols (`javascript:`/`data:`/`vbscript:`) neutralized to `'#'` (the `safeHref` precedent)
  - `coerceLink(value: unknown, homeSlug?: string): ResolvedLink | null` — passes an already-resolved link through (`href` string present), else treats the value as `PressLinkData`; tolerant of garbage (null)
  - `<PressLink link={unknown} homeSlug?: string, ...anchor data-attrs>` — renders `<a href target rel>` with the resolved label as content (or `children` when given); null when unresolvable

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/link.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { coerceLink, resolveLink } from './link';

describe('resolveLink', () => {
  it('prefers page over url and collapses the home slug to /', () => {
    expect(resolveLink({ label: 'About', page: { documentId: 'd1', slug: 'about' }, url: 'https://ignored' }, 'home'))
      .toEqual({ label: 'About', href: '/about', external: false, newTab: false });
    expect(resolveLink({ label: 'Home', page: { documentId: 'd2', slug: 'home' } }, 'home'))
      .toEqual({ label: 'Home', href: '/', external: false, newTab: false });
  });

  it('falls back to url when the page ref has no slug (unpublished), then drops the link', () => {
    expect(resolveLink({ label: 'X', page: { documentId: 'gone' }, url: '/fallback' }))
      .toEqual({ label: 'X', href: '/fallback', external: false, newTab: false });
    expect(resolveLink({ label: 'X', page: { documentId: 'gone' } })).toBeNull();
    expect(resolveLink({ label: 'X' })).toBeNull();
    expect(resolveLink(null)).toBeNull();
  });

  it('flags external http(s) urls and honors newTab', () => {
    expect(resolveLink({ label: 'GH', url: 'https://github.com', newTab: true }))
      .toEqual({ label: 'GH', href: 'https://github.com', external: true, newTab: true });
    expect(resolveLink({ label: 'mail', url: 'mailto:x@y.z' })!.external).toBe(false);
  });

  it('neutralizes executable protocols', () => {
    expect(resolveLink({ label: 'evil', url: 'javascript:alert(1)' })!.href).toBe('#');
  });
});

describe('coerceLink', () => {
  it('passes resolved links through and resolves raw link data', () => {
    const resolved = { label: 'A', href: '/a', external: false, newTab: false };
    expect(coerceLink(resolved)).toEqual(resolved);
    expect(coerceLink({ label: 'B', url: '/b' })).toEqual({ label: 'B', href: '/b', external: false, newTab: false });
    expect(coerceLink('garbage')).toBeNull();
    expect(coerceLink(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

Run: `pnpm --filter @ogs-tech/press-web test src/link.test.ts` — expected FAIL.

Create `packages/web/src/link.ts`:

```ts
/**
 * The engine's ONE link concept (locked decision 2026-07-20): the hydrated wire
 * shape of `preset-molecule.link` and its pure resolver. Precedence page > url;
 * an internal page collapses to '/' when its slug is the home slug (the same
 * routes.home anchor as the /home → / redirect); a page ref without a slug
 * (unpublished/deleted) falls back to url, else the link drops. Everything that
 * links — nav items, button atom, hero/cta, adopter blocks via <PressLink> —
 * resolves through here, nowhere else.
 */

export interface PressLinkData {
  label?: string;
  page?: { documentId?: string; slug?: string } | null;
  url?: string;
  newTab?: boolean;
}

export interface ResolvedLink {
  label: string;
  href: string;
  external: boolean;
  newTab: boolean;
}

/** Neutralizes executable protocols an editor could type (blocks-content safeHref precedent). */
function safeHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '#';
  return /^(?:javascript|data|vbscript):/i.test(trimmed) ? '#' : trimmed;
}

export function resolveLink(link: PressLinkData | null | undefined, homeSlug?: string): ResolvedLink | null {
  if (!link || typeof link !== 'object') return null;
  const label = link.label ?? '';
  const newTab = link.newTab ?? false;
  const slug = link.page?.slug;
  if (slug) {
    return { label, href: homeSlug !== undefined && slug === homeSlug ? '/' : `/${slug}`, external: false, newTab };
  }
  if (link.url) {
    const href = safeHref(link.url);
    return { label, href, external: /^https?:/i.test(href), newTab };
  }
  return null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Accepts either an already-resolved link (hydrated engine block) or raw PressLinkData. */
export function coerceLink(value: unknown, homeSlug?: string): ResolvedLink | null {
  if (!isRecord(value)) return null;
  if (typeof value.href === 'string') {
    return {
      label: typeof value.label === 'string' ? value.label : '',
      href: value.href,
      external: value.external === true,
      newTab: value.newTab === true,
    };
  }
  return resolveLink(value as PressLinkData, homeSlug);
}
```

Create `packages/web/src/press-link.tsx`:

```tsx
import type { ReactNode } from 'react';
import { coerceLink } from './link';

interface PressLinkProps {
  /** Raw PressLinkData (block prop) or an already-resolved link (hydrated). */
  link: unknown;
  homeSlug?: string;
  children?: ReactNode;
  [dataAttr: `data-${string}`]: unknown;
}

/**
 * The one anchor renderer for CMS links. Server component, zero JS: resolves
 * via coerceLink and emits a plain <a>. Unresolvable → renders nothing (the
 * hero/cta "CTA renders only when complete" tolerance, generalized).
 */
export function PressLink({ link, homeSlug, children, ...rest }: PressLinkProps) {
  const resolved = coerceLink(link, homeSlug);
  // Unresolvable → nothing; a neutralized '#' href still renders (safe no-op).
  if (!resolved || !resolved.href) return null;
  return (
    <a
      {...rest}
      href={resolved.href}
      target={resolved.newTab ? '_blank' : undefined}
      rel={resolved.newTab ? 'noreferrer' : undefined}
    >
      {children ?? resolved.label}
    </a>
  );
}
```

- [ ] **Step 3: Run tests, commit**

Run: `pnpm --filter @ogs-tech/press-web test src/link.test.ts && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS. (Full-suite runs stay red until Task 17 finishes the renderer swap — run file-scoped tests through Phase 4.)

```bash
git add packages/web pnpm-lock.yaml
git commit -m "feat(web): PressLink + resolveLink — the engine's one link resolver"
```

### Task 13: Plain-text atoms + base wire types

**Files:**
- Modify: `packages/web/src/types/base.ts`
- Modify: `packages/web/src/blocks/paragraph.tsx`, `blocks/list.tsx`, `blocks/quote.tsx`, `blocks/button.tsx`
- Delete: `packages/web/src/blocks/blocks-content.tsx`, `blocks/blocks-content.test.ts`
- Test: rewrite `packages/web/src/blocks/paragraph.test.ts`, `blocks/list.test.ts`, `blocks/quote.test.ts`, `blocks/button.test.ts`

**Interfaces:**
- Consumes: `PressLink`/`PressLinkData` (Task 12), `PressTree` from `@ogs-tech/press-shared`.
- Produces — `types/base.ts` after this task (exact, later tasks import these):
  - `PressMedia` unchanged; `BlocksText`/`BlocksNode`/`BlocksContent` DELETED; `Block`/`PageBody`(old) DELETED
  - `PresetAtomParagraph { content: string }` · `PresetAtomList { content?: string; format?: 'unordered' | 'ordered' }` · `PresetAtomQuote { content?: string; citation?: string }` · `PresetAtomButton { link?: PressLinkData; variant?: 'primary' | 'secondary' }` · `PresetAtomHeading/Image/Separator/Spacer` keep their fields — ALL WITHOUT `__component`/`id` (tree `data` objects, not DZ rows)
  - `PresetOrganismHero { eyebrow?; title: string; subtitle?; image?: PressMedia; cta?: PressLinkData; align? }` · `PresetOrganismCta { title: string; subtitle?; button?: PressLinkData; align? }` · `PresetOrganismColumns`/`PresetMoleculeColumn` DELETED
  - `export type PageBody = PressTree;` and `Page { id: number; documentId: string; title: string; slug?: string; body: PageBody }` (still `extends Canonical<'page'>`)
  - Shared paragraph splitting helper exported from `paragraph.tsx`: `splitParagraphs(content: string | undefined): string[]` (split on blank lines, trim, drop empties)

- [ ] **Step 1: Rewrite the atom tests (failing)**

`packages/web/src/blocks/paragraph.test.ts` becomes:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Paragraph, splitParagraphs } from './paragraph';

describe('splitParagraphs', () => {
  it('splits on blank lines and drops empties', () => {
    expect(splitParagraphs('One.\n\nTwo.\n\n\n')).toEqual(['One.', 'Two.']);
    expect(splitParagraphs(undefined)).toEqual([]);
    expect(splitParagraphs('  \n ')).toEqual([]);
  });
});

describe('Paragraph', () => {
  it('renders one <p> per blank-line-separated paragraph inside the data-block wrapper', () => {
    const html = renderToStaticMarkup(createElement(Paragraph, { content: 'First.\n\nSecond.' }));
    expect(html).toContain('data-block="preset-atom.paragraph"');
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).toContain('First.');
  });

  it('renders nothing for empty content (tolerance)', () => {
    expect(renderToStaticMarkup(createElement(Paragraph, { content: '' }))).toBe('');
  });
});
```

`packages/web/src/blocks/list.test.ts` becomes:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { List } from './list';

describe('List', () => {
  it('renders one <li> per non-empty line, unordered by default', () => {
    const html = renderToStaticMarkup(createElement(List, { content: 'a\nb\n\nc' }));
    expect(html).toContain('data-block="preset-atom.list"');
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)).toHaveLength(3);
  });

  it('renders <ol> for format ordered and nothing when empty', () => {
    expect(renderToStaticMarkup(createElement(List, { content: '1st', format: 'ordered' }))).toContain('<ol>');
    expect(renderToStaticMarkup(createElement(List, { content: '' }))).toBe('');
  });
});
```

`packages/web/src/blocks/quote.test.ts` becomes:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Quote } from './quote';

describe('Quote', () => {
  it('renders paragraphs inside blockquote with optional cite', () => {
    const html = renderToStaticMarkup(createElement(Quote, { content: 'Wise words.', citation: 'Someone' }));
    expect(html).toContain('data-block="preset-atom.quote"');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Wise words.');
    expect(html).toContain('<cite>Someone</cite>');
  });

  it('renders nothing when empty and omits cite when absent', () => {
    expect(renderToStaticMarkup(createElement(Quote, { content: '' }))).toBe('');
    expect(renderToStaticMarkup(createElement(Quote, { content: 'x' }))).not.toContain('<cite>');
  });
});
```

`packages/web/src/blocks/button.test.ts` becomes:

```ts
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Button } from './button';

describe('Button', () => {
  it('renders the resolved link with the variant hook', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { link: { label: 'Go', url: '/go' }, variant: 'secondary' }),
    );
    expect(html).toContain('data-block="preset-atom.button"');
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('href="/go"');
    expect(html).toContain('Go');
  });

  it('renders a hydrated (already-resolved) link and nothing when unresolvable', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { link: { label: 'Home', href: '/', external: false, newTab: false } as any }),
    );
    expect(html).toContain('href="/"');
    expect(renderToStaticMarkup(createElement(Button, {}))).toBe('');
  });
});
```

Run: `pnpm --filter @ogs-tech/press-web test src/blocks` — expected FAIL.

- [ ] **Step 2: Rewrite the atoms**

`packages/web/src/blocks/paragraph.tsx`:

```tsx
import type { PresetAtomParagraph } from '../types/base';

/** Curated plain-text splitting (locked decision 2026-07-20): a blank line starts a new paragraph. */
export function splitParagraphs(content: string | undefined): string[] {
  return (content ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Atom `preset-atom.paragraph` — editorial prose from a curated plain-text
 * string. Server-rendered, zero JS; the blocks AST left the wire with the
 * composition-builder refactor.
 */
export function Paragraph({ content }: PresetAtomParagraph) {
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length === 0) return null;
  return (
    <div data-block="preset-atom.paragraph">
      {paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </div>
  );
}
```

`packages/web/src/blocks/list.tsx`:

```tsx
import type { PresetAtomList } from '../types/base';

/** Atom `preset-atom.list` — one item per non-empty line of the curated text. */
export function List({ content, format }: PresetAtomList) {
  const items = (content ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (items.length === 0) return null;
  const Tag = format === 'ordered' ? 'ol' : 'ul';
  return (
    <div data-block="preset-atom.list">
      <Tag>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}
```

`packages/web/src/blocks/quote.tsx`:

```tsx
import type { PresetAtomQuote } from '../types/base';
import { splitParagraphs } from './paragraph';

/** Atom `preset-atom.quote` — blockquote paragraphs + optional citation. */
export function Quote({ content, citation }: PresetAtomQuote) {
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length === 0) return null;
  return (
    <figure data-block="preset-atom.quote">
      <blockquote>
        {paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </blockquote>
      {citation ? <cite>{citation}</cite> : null}
    </figure>
  );
}
```

(Match the CURRENT quote.tsx root element — if it renders a different wrapper today, keep that wrapper and only swap the content source; theme.css targets `[data-block="preset-atom.quote"] blockquote` and `cite`.)

`packages/web/src/blocks/button.tsx`:

```tsx
import type { PresetAtomButton } from '../types/base';
import { coerceLink } from '../link';
import { PressLink } from '../press-link';

/** Atom `preset-atom.button` — a call-to-action anchor resolved through the one link concept. */
export function Button({ link, variant }: PresetAtomButton) {
  if (!coerceLink(link)) return null;
  return (
    <div data-block="preset-atom.button">
      <PressLink link={link} data-variant={variant ?? 'primary'} />
    </div>
  );
}
```

Delete the blocks-AST renderer:

```bash
git rm packages/web/src/blocks/blocks-content.tsx packages/web/src/blocks/blocks-content.test.ts
```

- [ ] **Step 3: Rewrite `types/base.ts`**

Apply the exact type surface from this task's **Interfaces** block: delete `BlocksText`/`BlocksNode`/`BlocksContent`, `PresetOrganismColumns`, `PresetMoleculeColumn`, the old `Block`/`PageBody`; strip `__component`/`id` from every `PresetAtom*`/`PresetOrganism*` interface; change content fields to `string`; change link fields to `PressLinkData` (import from `../link`); add:

```ts
import type { PressTree } from '@ogs-tech/press-shared';

/** The page body IS the composition tree now (Spec §5 type-sync). */
export type PageBody = PressTree;

export interface Page extends Canonical<'page'> {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: PageBody;
}
```

Remove the now-dangling exports from `packages/web/src/index.ts`: `renderBlocks`, `Block`, `BlocksContent`, `BlocksNode`, `BlocksText`, `PresetOrganismColumns`, `PresetMoleculeColumn`. (The remaining index cleanup — BlockRenderer/Columns — happens in Task 17; if typecheck complains earlier because deleted symbols are still referenced by `sections/columns.tsx` or `block-renderer.tsx`, defer the FULL `pnpm typecheck` to Task 17 and rely on file-scoped tests here.)

- [ ] **Step 4: Run the atom tests**

Run: `pnpm --filter @ogs-tech/press-web test src/blocks src/link.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A packages/web
git commit -m "feat(web)!: plain-text atoms + link-descriptor button; blocks AST leaves the wire"
```

### Task 14: Organisms on the link descriptor (hero, cta, navbar)

**Files:**
- Modify: `packages/web/src/sections/hero.tsx`, `sections/cta.tsx`, `chrome/navbar.tsx`
- Modify: `packages/web/src/config/types.ts` (ResolvedChromeNavbar cta shape + ResolvedLink re-home)
- Test: update `packages/web/src/sections/hero.test.ts`, `sections/cta.test.ts`, `chrome/navbar.test.ts`

**Interfaces:**
- Consumes: `PressLink`/`coerceLink`/`ResolvedLink` (Task 12), base types (Task 13).
- Produces:
  - `Hero({ eyebrow, title, subtitle, image, cta, align })` — `cta` rendered via `<PressLink data-hero="cta">` (raw or hydrated)
  - `Cta({ title, subtitle, button, align })` — same pattern, `data-cta="button"` hook preserved as today
  - `config/types.ts`: `ResolvedNavLink` becomes `export type ResolvedNavLink = ResolvedLink;` (import from `../link`); `ResolvedChromeNavbar` becomes `{ brand: { name: string; logo?: string }; links: ResolvedLink[]; cta?: (ResolvedLink & { variant?: 'primary' | 'secondary' }) | null }` (no `__component`/`id`)
  - `Navbar({ brand, links, cta })` renders the cta through `<PressLink data-navbar="cta" data-variant>`; `MobileNav` keeps receiving `{ links, cta: { label, href, variant } }` — build that view-model inline in navbar.tsx.

- [ ] **Step 1: Update the organism tests (failing)**

In `hero.test.ts`, replace every `ctaLabel: 'X', ctaHref: '/y'` fixture with `cta: { label: 'X', url: '/y' }` and keep the assertions (`data-hero="cta"`, href, label rendered; CTA omitted when `cta` absent or unresolvable). In `cta.test.ts`, same swap for `buttonLabel`/`buttonHref` → `button: { label, url }`. In `navbar.test.ts`, the `cta` fixture becomes the RESOLVED shape `{ label: 'Get started', href: 'https://x', external: true, newTab: false, variant: 'primary' }` and assertions stay (label + href + `data-variant` present, `data-navbar-desktop` row intact).

Run: `pnpm --filter @ogs-tech/press-web test src/sections src/chrome` — expected FAIL.

- [ ] **Step 2: Update the components**

In `hero.tsx`: replace `ctaLabel`/`ctaHref` destructuring with `cta`; `const hasCta = Boolean(coerceLink(cta));` and render:

```tsx
{hasCta ? <PressLink data-hero="cta" link={cta} /> : null}
```

In `cta.tsx`: same mechanical swap for `button` (keep the existing wrapper markup and `data-*` hooks exactly as the file has them today, only the anchor source changes).

In `navbar.tsx`: `cta` is now `(ResolvedLink & { variant?: ... }) | null | undefined`:

```tsx
const resolvedCta = coerceLink(cta);
const hasCta = Boolean(resolvedCta?.label && resolvedCta?.href);
// desktop:
{hasCta ? <PressLink data-navbar="cta" data-variant={(cta as any)?.variant ?? 'primary'} link={cta} /> : null}
// mobile view-model (MobileNav's prop contract is untouched):
<MobileNav links={links ?? []} cta={hasCta ? { label: resolvedCta!.label, href: resolvedCta!.href, variant: (cta as any)?.variant } : undefined} />
```

In `config/types.ts`: apply the exact type changes from the Interfaces block above (`import type { ResolvedLink } from '../link';`).

- [ ] **Step 3: Run, then commit**

Run: `pnpm --filter @ogs-tech/press-web test src/sections src/chrome src/blocks`
Expected: PASS.

```bash
git add packages/web
git commit -m "refactor(web)!: hero/cta/navbar consume the shared link descriptor via PressLink"
```

### Task 15: Container-attr mappings (`tree/container-attrs.ts`)

**Files:**
- Create: `packages/web/src/tree/container-attrs.ts`
- Test: `packages/web/src/tree/container-attrs.test.ts`

**Interfaces:**
- Consumes: `ContainerAttrs`, `Gap`, `Ratio`, `VerticalAlign` types from `@ogs-tech/press-shared`; `Responsive`/`Span`/`GridGap`/`GridAlignItems`/`ContainerMaxWidth` from the layout primitives.
- Produces (exact — TreeRenderer consumes only these):
  - `RATIO_SPANS: Record<Ratio, Responsive<Span>[]>` — moved VERBATIM from `sections/columns.tsx` (including the `25-25-25-25` two-stage `{ base: 12, md: 6, lg: 3 }` behavior)
  - `spanFor(ratio: Ratio | undefined, index: number): Responsive<Span>` — unknown/absent ratio → `50-50`; index beyond the ratio's slots reuses the last span (tolerance carried over)
  - `rowGap(attrs?: ContainerAttrs): Responsive<GridGap>` — `GAP_TIERS` moved verbatim (`compact`→`'sm'`, `normal`→`'md'`, `spacious`→`{ base: 'md', lg: 'lg' }`); absent → `normal`
  - `rowAlign(attrs?: ContainerAttrs): GridAlignItems` — `top`→`start`, `center`→`center`, `bottom`→`end`; absent → `start`
  - `rowWidth(attrs?: ContainerAttrs): ContainerMaxWidth` — `attrs?.width ?? 'lg'`
  - `STACK_GAPS: Record<Gap, string>` = `{ compact: 'var(--press-space-3)', normal: 'var(--press-space-5)', spacious: 'var(--press-space-7)' }` and `stackGap(attrs?: ContainerAttrs): string | undefined` (absent gap → `undefined` → no data-attr, legacy block margins apply)
  - `cellAlign(attrs?: ContainerAttrs): 'center' | 'end' | undefined` (`top`/absent → undefined)

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/tree/container-attrs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cellAlign, RATIO_SPANS, rowAlign, rowGap, rowWidth, spanFor, stackGap } from './container-attrs';

describe('spanFor', () => {
  it('keeps the columns-organism ratio scale, including 25-25-25-25 two-stage md/lg', () => {
    expect(RATIO_SPANS['25-25-25-25'][0]).toEqual({ base: 12, md: 6, lg: 3 });
    expect(spanFor('33-67', 1)).toEqual({ base: 12, md: 8 });
  });

  it('defaults to 50-50 and reuses the last span past the ratio slots (tolerance)', () => {
    expect(spanFor(undefined, 0)).toEqual({ base: 12, md: 6 });
    expect(spanFor('50-50', 5)).toEqual({ base: 12, md: 6 });
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

- [ ] **Step 2: Run (FAIL), implement**

Create `packages/web/src/tree/container-attrs.ts`:

```ts
/**
 * Curated container attrs → layout-primitive props (Spec §5). This module is
 * where editorial intent meets the responsive system: the JSON never carries
 * breakpoints — RATIO_SPANS/GAP_TIERS (inherited verbatim from the retired
 * columns organism) own the base/md/lg mapping, so the 11-gap floor and the
 * 25-25-25-25 two-stage md/lg behavior stay engine-owned and untouchable.
 * Every picker treats an ABSENT attr as the engine default (Spec §3).
 */
import type { ContainerAttrs, Gap, Ratio } from '@ogs-tech/press-shared';
import type { Responsive } from '../layout/breakpoints';
import type { Span } from '../layout/column';
import type { ContainerMaxWidth } from '../layout/container';
import type { GridAlignItems, GridGap } from '../layout/grid';

export const RATIO_SPANS: Record<Ratio, Responsive<Span>[]> = {
  '50-50': [{ base: 12, md: 6 }, { base: 12, md: 6 }],
  '33-67': [{ base: 12, md: 4 }, { base: 12, md: 8 }],
  '67-33': [{ base: 12, md: 8 }, { base: 12, md: 4 }],
  '33-33-33': [{ base: 12, md: 4 }, { base: 12, md: 4 }, { base: 12, md: 4 }],
  '25-25-25-25': [
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
  ],
};

/** Column i of a row: extra columns beyond the ratio's slots reuse the last span (columns tolerance). */
export function spanFor(ratio: Ratio | undefined, index: number): Responsive<Span> {
  const spans = (ratio && RATIO_SPANS[ratio]) || RATIO_SPANS['50-50'];
  return spans[Math.min(index, spans.length - 1)];
}

/** Semantic gap → GridGap tiers: a 12-track grid carries 11 interior gaps, so 'spacious' tier-scales. */
const GAP_TIERS: Record<Gap, Responsive<GridGap>> = {
  compact: 'sm',
  normal: 'md',
  spacious: { base: 'md', lg: 'lg' },
};

export const rowGap = (attrs?: ContainerAttrs): Responsive<GridGap> => GAP_TIERS[attrs?.gap ?? 'normal'];

const ALIGN_ITEMS: Record<NonNullable<ContainerAttrs['verticalAlign']>, GridAlignItems> = {
  top: 'start',
  center: 'center',
  bottom: 'end',
};

export const rowAlign = (attrs?: ContainerAttrs): GridAlignItems => ALIGN_ITEMS[attrs?.verticalAlign ?? 'top'];

export const rowWidth = (attrs?: ContainerAttrs): ContainerMaxWidth => attrs?.width ?? 'lg';

/** Stack rhythm (layout root / column cells): a CSS space token consumed by theme.css stack rules. */
export const STACK_GAPS: Record<Gap, string> = {
  compact: 'var(--press-space-3)',
  normal: 'var(--press-space-5)',
  spacious: 'var(--press-space-7)',
};

/** undefined when undeclared — the renderer then emits NO stack attr and legacy per-block margins apply. */
export const stackGap = (attrs?: ContainerAttrs): string | undefined =>
  attrs?.gap ? STACK_GAPS[attrs.gap] : undefined;

/** Cell content placement; 'top' is the flex default so it emits nothing. */
export const cellAlign = (attrs?: ContainerAttrs): 'center' | 'end' | undefined =>
  attrs?.verticalAlign === 'center' ? 'center' : attrs?.verticalAlign === 'bottom' ? 'end' : undefined;
```

- [ ] **Step 3: Run tests, commit**

Run: `pnpm --filter @ogs-tech/press-web test src/tree`
Expected: PASS.

```bash
git add packages/web
git commit -m "feat(web): curated container-attr → layout-primitive mappings for the tree renderer"
```

### Task 16: Slot resolution + engine-block hydration (`tree/resolve-slots.ts`, map-site-settings rewrite)

**Files:**
- Create: `packages/web/src/tree/resolve-slots.ts`
- Test: `packages/web/src/tree/resolve-slots.test.ts`
- Modify: `packages/web/src/map-site-settings.ts`, `packages/web/src/config/types.ts`
- Test: update `packages/web/src/map-site-settings.test.ts`

**Interfaces:**
- Consumes: `validateNodeArray`, tree types (shared); `resolveLink` (Task 12); `ResolvedPressConfig` (modified here).
- Produces (exact):
  - `interface ResolvedTree { header: Node[]; children: Node[]; footer: Node[]; rootContainer?: ContainerAttrs }`
  - `resolveTree(tree: PressTree, site: ResolvedPressConfig): ResolvedTree` — slot matrix: `inherit`→`site.pageDefaults.<slot>`, `none`→`[]`, `custom`→its children; ALL three lists then pass through `hydrateEngineBlocks`
  - `hydrateEngineBlocks(nodes: Node[], brand: { name: string; logo?: string }, homeSlug: string): Node[]` — recursive over rows/columns; per engine BlockNode: `preset-organism.navbar` data gains `brand` + `links: ResolvedLink[]` (from `items`) + resolved `cta` (`{ ...resolveLink(cta.link), variant }`); `preset-organism.footer` data gains `brand`; `preset-atom.button` data.link, `preset-organism.hero` data.cta, `preset-organism.cta` data.button are REPLACED by their `ResolvedLink` (homeSlug collapse applied). Adopter blocks pass through untouched (they use `<PressLink>` raw). Never mutates input.
  - `config/types.ts`: `SiteSettingsData` — `header`/`footer` REPLACED by `pageDefaults?: { header?: unknown; footer?: unknown } | null`; `ResolvedPressConfig` — `chrome` REPLACED by `pageDefaults: { header: Node[]; footer: Node[] }` (RAW nodes — hydration happens at resolveTree, ONE hydration point); `ChromeBlock`/`ResolvedChromeFooter` deleted, `ResolvedChromeNavbar` kept (Task 14 shape — it types the navbar component's hydrated data)
  - `mapSiteSettings`: validates each `pageDefaults` slot with `validateNodeArray` (fail-to-empty per slot + dev-only warn), stores raw nodes; everything else (identity/seo/theme/cookie) untouched.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/tree/resolve-slots.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Node, PressTree } from '@ogs-tech/press-shared';
import { hydrateEngineBlocks, resolveTree } from './resolve-slots';

const brand = { name: 'Press', logo: 'http://cms/logo.png' };

const navbarNode = (): Node => ({
  id: 'nav', type: 'block', component: 'preset-organism.navbar',
  data: {
    items: [
      { label: 'Home', page: { documentId: 'd1', slug: 'home' } },
      { label: 'GH', url: 'https://github.com', newTab: true },
      { label: 'dead' }, // unresolvable → dropped from links
    ],
    cta: { link: { label: 'Go', url: '/go' }, variant: 'secondary' },
  },
});

const site = (defaults: { header?: Node[]; footer?: Node[] }) =>
  ({
    brand: { ...brand, favicon: '' },
    routes: { home: 'home' },
    pageDefaults: { header: defaults.header ?? [], footer: defaults.footer ?? [] },
  }) as any;

const tree = (header: any, footer: any, children: Node[] = []): PressTree => ({
  version: 1,
  root: { type: 'layout', header, footer, children },
});

describe('hydrateEngineBlocks', () => {
  it('hydrates navbar brand/links/cta with home-slug collapse, at any depth', () => {
    const nested: Node[] = [{
      id: 'r', type: 'row', ratio: '50-50', children: [
        { id: 'c', type: 'column', children: [navbarNode()] },
        { id: 'c2', type: 'column', children: [] },
      ],
    }];
    const [row] = hydrateEngineBlocks(nested, brand, 'home') as any[];
    const nav = row.children[0].children[0].data;
    expect(nav.brand).toEqual(brand);
    expect(nav.links).toEqual([
      { label: 'Home', href: '/', external: false, newTab: false },
      { label: 'GH', href: 'https://github.com', external: true, newTab: true },
    ]);
    expect(nav.cta).toMatchObject({ label: 'Go', href: '/go', variant: 'secondary' });
  });

  it('resolves button/hero/cta link fields and injects the footer brand', () => {
    const nodes: Node[] = [
      { id: 'b', type: 'block', component: 'preset-atom.button', data: { link: { label: 'Docs', page: { documentId: 'd9', slug: 'docs' } }, variant: 'primary' } },
      { id: 'h', type: 'block', component: 'preset-organism.hero', data: { title: 'T', cta: { label: 'Read', url: '/read' } } },
      { id: 'f', type: 'block', component: 'preset-organism.footer', data: {} },
      { id: 'x', type: 'block', component: 'custom-organism.callout', data: { message: 'untouched' } },
    ];
    const out = hydrateEngineBlocks(nodes, brand, 'home') as any[];
    expect(out[0].data.link).toEqual({ label: 'Docs', href: '/docs', external: false, newTab: false });
    expect(out[1].data.cta.href).toBe('/read');
    expect(out[2].data.brand).toEqual({ name: 'Press' });
    expect(out[3].data).toEqual({ message: 'untouched' }); // adopter data is never touched
    expect(nodes[0].type === 'block' && (nodes[0].data as any).link.page.slug).toBe('docs'); // input not mutated
  });
});

describe('resolveTree slot matrix', () => {
  const defaults = { header: [navbarNode()], footer: [{ id: 'f', type: 'block', component: 'preset-organism.footer', data: {} } as Node] };

  it('inherit pulls (and hydrates) pageDefaults; none is empty; custom wins', () => {
    const inherited = resolveTree(tree({ mode: 'inherit' }, { mode: 'inherit' }), site(defaults));
    expect((inherited.header[0] as any).data.brand).toEqual(brand);
    expect((inherited.footer[0] as any).data.brand).toEqual({ name: 'Press' });

    const bare = resolveTree(tree({ mode: 'none' }, { mode: 'none' }), site(defaults));
    expect(bare.header).toEqual([]);
    expect(bare.footer).toEqual([]);

    const custom = resolveTree(
      tree({ mode: 'custom', children: [{ id: 'p', type: 'block', component: 'preset-atom.paragraph', data: { content: 'x' } }] }, { mode: 'none' }),
      site(defaults),
    );
    expect((custom.header[0] as any).component).toBe('preset-atom.paragraph');
  });

  it('inherit against absent defaults renders bare (fail-to-empty)', () => {
    const out = resolveTree(tree({ mode: 'inherit' }, { mode: 'inherit' }), site({}));
    expect(out.header).toEqual([]);
  });

  it('carries the root container and hydrates body children too', () => {
    const t = tree({ mode: 'none' }, { mode: 'none' }, [
      { id: 'b', type: 'block', component: 'preset-atom.button', data: { link: { label: 'Go', url: '/g' } } },
    ]);
    t.root.container = { gap: 'spacious' };
    const out = resolveTree(t, site({}));
    expect(out.rootContainer).toEqual({ gap: 'spacious' });
    expect((out.children[0] as any).data.link.href).toBe('/g');
  });
});
```

- [ ] **Step 2: Run (FAIL), implement**

Create `packages/web/src/tree/resolve-slots.ts`:

```ts
/**
 * Slot resolution + engine-block hydration — the ONE hydration point (Spec §5/§6).
 * `inherit` resolves against Site Settings pageDefaults at render (ISR ~60s:
 * editing the default header updates every inheriting page, no redeploy);
 * `none` is a bare page; `custom` is page-owned chrome. All three lists — and
 * the body — then get engine blocks hydrated WHEREVER they sit: navbar/footer
 * gain brand (identity is never stored on a block), and every engine link
 * field resolves with the homeSlug collapse. The engine names only its OWN
 * blocks here — adopter data passes through untouched (custom blocks render
 * links via <PressLink> themselves).
 */
import type { ContainerAttrs, Node, PressTree, Slot } from '@ogs-tech/press-shared';
import type { ResolvedPressConfig } from '../config/types';
import { resolveLink, type PressLinkData, type ResolvedLink } from '../link';

export interface ResolvedTree {
  header: Node[];
  children: Node[];
  footer: Node[];
  rootContainer?: ContainerAttrs;
}

type Brand = { name: string; logo?: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Engine blocks whose data carries ONE link field to resolve in place. */
const LINK_FIELDS: Record<string, string> = {
  'preset-atom.button': 'link',
  'preset-organism.hero': 'cta',
  'preset-organism.cta': 'button',
};

function hydrateBlockData(component: string, data: Record<string, unknown>, brand: Brand, homeSlug: string): Record<string, unknown> {
  if (component === 'preset-organism.navbar') {
    const items = Array.isArray(data.items) ? (data.items as PressLinkData[]) : [];
    const links = items
      .map((item) => resolveLink(item, homeSlug))
      .filter((link): link is ResolvedLink => link !== null);
    const rawCta = isRecord(data.cta) ? data.cta : undefined;
    const ctaLink = rawCta ? resolveLink(rawCta.link as PressLinkData, homeSlug) : null;
    return {
      ...data,
      brand: { name: brand.name, logo: brand.logo },
      links,
      cta: ctaLink ? { ...ctaLink, variant: rawCta?.variant } : null,
    };
  }
  if (component === 'preset-organism.footer') {
    return { ...data, brand: { name: brand.name } };
  }
  const linkField = LINK_FIELDS[component];
  if (linkField && data[linkField] !== undefined && data[linkField] !== null) {
    return { ...data, [linkField]: resolveLink(data[linkField] as PressLinkData, homeSlug) };
  }
  return data;
}

export function hydrateEngineBlocks(nodes: Node[], brand: Brand, homeSlug: string): Node[] {
  return nodes.map((node) => {
    if (node.type === 'block') {
      return { ...node, data: hydrateBlockData(node.component, node.data, brand, homeSlug) };
    }
    return { ...node, children: hydrateEngineBlocks(node.children as Node[], brand, homeSlug) } as Node;
  });
}

function slotNodes(slot: Slot, defaults: Node[]): Node[] {
  if (slot.mode === 'inherit') return defaults;
  if (slot.mode === 'custom') return slot.children;
  return [];
}

export function resolveTree(tree: PressTree, site: ResolvedPressConfig): ResolvedTree {
  const brand: Brand = { name: site.brand.name, logo: site.brand.logo };
  const homeSlug = site.routes.home;
  const hydrate = (nodes: Node[]): Node[] => hydrateEngineBlocks(nodes, brand, homeSlug);
  return {
    header: hydrate(slotNodes(tree.root.header, site.pageDefaults.header)),
    children: hydrate(tree.root.children),
    footer: hydrate(slotNodes(tree.root.footer, site.pageDefaults.footer)),
    rootContainer: tree.root.container,
  };
}
```

- [ ] **Step 3: Rewrite map-site-settings + config types**

In `packages/web/src/config/types.ts` apply the Interfaces block above. In `packages/web/src/map-site-settings.ts`: delete `hydrateChromeBlocks`, `resolveNavItem`, `RawNavItem` (superseded by resolve-slots/link); replace the `chrome:` section of the return with:

```ts
import { validateNodeArray, type Node } from '@ogs-tech/press-shared';

/** One pageDefaults slot: fail-to-empty on invalid nodes (Spec §6.3), dev-only warning. */
function mapSlot(input: unknown, slot: string): Node[] {
  if (input === undefined || input === null) return [];
  const { value, errors } = validateNodeArray(input);
  if (!value) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[press/web] invalid pageDefaults.${slot} — rendering empty`, errors);
    }
    return [];
  }
  return value;
}
```

and in the returned object:

```ts
pageDefaults: {
  header: mapSlot(c.pageDefaults?.header, 'header'),
  footer: mapSlot(c.pageDefaults?.footer, 'footer'),
},
```

Update `map-site-settings.test.ts`: delete the chrome-hydration describe blocks (navbar links/brand assertions — that behavior now lives in `resolve-slots.test.ts`); add:

```ts
it('maps valid pageDefaults slots through and fails invalid slots to empty', () => {
  const nodes = [{ id: 'n', type: 'block', component: 'preset-organism.navbar', data: {} }];
  const ok = mapSiteSettings(buildTime, { pageDefaults: { header: nodes, footer: [] } } as any);
  expect(ok.pageDefaults.header).toEqual(nodes);
  const bad = mapSiteSettings(buildTime, { pageDefaults: { header: [{ id: 'c', type: 'column', children: [] }] } } as any);
  expect(bad.pageDefaults.header).toEqual([]);
});

it('maps an absent/unreachable CMS to empty pageDefaults', () => {
  expect(mapSiteSettings(buildTime, null).pageDefaults).toEqual({ header: [], footer: [] });
});
```

(Keep every identity/SEO/theme/cookie test unchanged — that surface is untouched.)

- [ ] **Step 4: Run, commit**

Run: `pnpm --filter @ogs-tech/press-web test src/tree src/map-site-settings.test.ts`
Expected: PASS.

```bash
git add packages/web
git commit -m "feat(web)!: pageDefaults slots + one-point engine-block hydration (resolve-slots)"
```

### Task 17: TreeRenderer + kill list (BlockRenderer, blockKey, Columns)

**Files:**
- Create: `packages/web/src/tree/tree-renderer.tsx`
- Test: `packages/web/src/tree/tree-renderer.test.tsx`
- Delete: `packages/web/src/block-renderer.tsx`, `block-renderer.test.tsx`, `block-key.ts`, `block-key.test.ts`, `sections/columns.tsx`, `sections/columns.test.ts`
- Modify: `packages/web/src/organism-blocks.ts`, `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `validatePressTree` (shared), `resolveTree` (Task 16), container-attr pickers (Task 15), `atomBlocks`/`organismBlocks`, layout primitives.
- Produces (exact):
  - `TreeRenderer({ body, site, components }: { body: unknown; site: ResolvedPressConfig; components?: Record<string, ComponentType<any>> })` — validates (`value` null → dev warn + EMPTY body but chrome still resolves from pageDefaults, Spec §7), resolves, renders `<header>…</header><main>…</main><footer>…</footer>`
  - Registry merge UNCHANGED: `{ ...atomBlocks, ...organismBlocks, ...components }`; unknown `component` → skip + dev-only `componentUrn` warning (BlockRenderer precedent); `node.id` is the React key
  - Row top-level → `<Container as="section" maxWidth={rowWidth(...)}><Grid gap={rowGap(...)} alignItems={rowAlign(...)}>…`; nested → bare `<Grid>` (width ignored)
  - Column → `<Column span={spanFor(parentRatio, i)}><div data-press-cell data-cell-align={cellAlign(...)} style={{ '--press-cell-gap': stackGap(...) }}>…</div></Column>` (attr/style omitted when undefined)
  - `<main>`: when `rootContainer.gap` is set → `data-press-stack=""` + `style={{ '--press-tree-gap': stackGap(rootContainer) }}`; otherwise a plain `<main>` (legacy per-block margins)
  - `organism-blocks.ts` loses `'preset-organism.columns'`; `index.ts`: remove `BlockRenderer`, `Columns`, `blockKey`-related exports; add `TreeRenderer`, `PressLink`, `resolveLink`, `coerceLink`, and type re-exports `PressTree`, `Node`, `RowNode`, `ColumnNode`, `BlockNode`, `Slot`, `ContainerAttrs`, `PressLinkData`, `ResolvedLink` (from `@ogs-tech/press-shared` / `./link`)

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/tree/tree-renderer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Node, PressTree } from '@ogs-tech/press-shared';
import { TreeRenderer } from './tree-renderer';

const site = (overrides: Partial<{ header: Node[]; footer: Node[] }> = {}) =>
  ({
    brand: { name: 'Press', favicon: '' },
    routes: { home: 'home' },
    pageDefaults: { header: overrides.header ?? [], footer: overrides.footer ?? [] },
  }) as any;

const tree = (children: Node[], extra: Partial<PressTree['root']> = {}): PressTree => ({
  version: 1,
  root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children, ...extra },
});

const paragraph = (id: string, content: string): Node => ({
  id, type: 'block', component: 'preset-atom.paragraph', data: { content },
});

describe('TreeRenderer', () => {
  it('renders header/main/footer with top-level blocks as DIRECT main children (prose rail)', () => {
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, { body: tree([paragraph('p1', 'Hello')]), site: site() }),
    );
    expect(html).toContain('<header></header>');
    expect(html).toMatch(/<main[^>]*><div data-block="preset-atom.paragraph">/);
    expect(html).toContain('<footer></footer>');
  });

  it('renders a top-level row as Container>Grid>Column and a NESTED row as bare Grid (recursion)', () => {
    const body = tree([{
      id: 'r1', type: 'row', ratio: '33-67', container: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      children: [
        { id: 'c1', type: 'column', children: [paragraph('p2', 'left')] },
        { id: 'c2', type: 'column', container: { verticalAlign: 'bottom', gap: 'spacious' }, children: [{
          id: 'r2', type: 'row', ratio: '50-50', children: [
            { id: 'c3', type: 'column', children: [paragraph('p3', 'deep')] },
            { id: 'c4', type: 'column', children: [] },
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
    expect(html).toContain('deep');
  });

  it('resolves inherit slots against pageDefaults and hydrates the navbar there', () => {
    const navbar: Node = { id: 'n', type: 'block', component: 'preset-organism.navbar', data: { items: [{ label: 'Home', url: '/' }] } };
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, {
        body: tree([], { header: { mode: 'inherit' } }),
        site: site({ header: [navbar] }),
      }),
    );
    expect(html).toContain('data-block="preset-organism.navbar"');
    expect(html).toContain('Press'); // hydrated brand
  });

  it('applies the root gap as a main stack and omits it when undeclared', () => {
    const withGap = tree([paragraph('p', 'x')], { container: { gap: 'compact' } });
    expect(renderToStaticMarkup(createElement(TreeRenderer, { body: withGap, site: site() })))
      .toMatch(/<main[^>]*data-press-stack[^>]*style="--press-tree-gap:var\(--press-space-3\)"/);
    expect(renderToStaticMarkup(createElement(TreeRenderer, { body: tree([]), site: site() })))
      .not.toContain('data-press-stack');
  });

  it('fails an invalid body to empty but KEEPS the inherited chrome (Spec §7)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const navbar: Node = { id: 'n', type: 'block', component: 'preset-organism.navbar', data: {} };
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, { body: { version: 99 }, site: site({ header: [navbar] }) }),
    );
    expect(html).toContain('data-block="preset-organism.navbar"');
    expect(html).toMatch(/<main[^>]*><\/main>/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips unknown components with a dev warning and honors adopter overrides', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = tree([
      { id: 'u', type: 'block', component: 'custom-organism.mystery', data: {} },
      { id: 'h', type: 'block', component: 'preset-organism.hero', data: { title: 'T' } },
    ]);
    const MyHero = () => createElement('div', { 'data-my-hero': '' }, 'override');
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, { body, site: site(), components: { 'preset-organism.hero': MyHero } }),
    );
    expect(html).toContain('data-my-hero');
    expect(html).not.toContain('mystery');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('custom-organism.mystery'));
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run (FAIL), implement**

Create `packages/web/src/tree/tree-renderer.tsx`:

```tsx
/**
 * TreeRenderer — renders a PressTree as <header>/<main>/<footer> (Spec §5).
 * Layout-by-components: the App Router `children` slot is the outlet; the tree
 * owns the page shell. Read-side tolerance (Spec §7): a malformed body renders
 * EMPTY (dev warning) but chrome still resolves from pageDefaults; unknown
 * block components are skipped (BlockRenderer precedent); container attrs were
 * already sanitized by the shared validator.
 */
import type { ComponentType, CSSProperties } from 'react';
import type { ColumnNode, Node, Ratio, RowNode } from '@ogs-tech/press-shared';
import { validatePressTree } from '@ogs-tech/press-shared';
import { atomBlocks } from '../atom-blocks';
import { organismBlocks } from '../organism-blocks';
import { componentUrn } from '../urn';
import type { ResolvedPressConfig } from '../config/types';
import { Column } from '../layout/column';
import { Container } from '../layout/container';
import { Grid } from '../layout/grid';
import { cellAlign, rowAlign, rowGap, rowWidth, spanFor, stackGap } from './container-attrs';
import { hydrateEngineBlocks, resolveTree, type ResolvedTree } from './resolve-slots';

type Registry = Record<string, ComponentType<any>>;

interface TreeRendererProps {
  /** The raw page body (PressTree on the wire) — validated here, never trusted. */
  body: unknown;
  site: ResolvedPressConfig;
  /** Adopter custom blocks, passed EXPLICITLY (no global registry — BlockRenderer contract kept). */
  components?: Registry;
}

function BlockView({ node, registry }: { node: Node & { type: 'block' }; registry: Registry }) {
  const Component = registry[node.component];
  if (!Component) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[press/web] no component registered for ${componentUrn(node.component)} — skipping`);
    }
    return null;
  }
  return <Component {...node.data} />;
}

function ColumnView({ column, ratio, index, registry }: { column: ColumnNode; ratio: Ratio; index: number; registry: Registry }) {
  const gap = stackGap(column.container);
  const align = cellAlign(column.container);
  const style = gap ? ({ ['--press-cell-gap' as string]: gap } as CSSProperties) : undefined;
  return (
    <Column span={spanFor(ratio, index)}>
      <div data-press-cell="" data-cell-align={align} style={style}>
        <NodeList nodes={column.children} registry={registry} top={false} />
      </div>
    </Column>
  );
}

function RowView({ row, registry, top }: { row: RowNode; registry: Registry; top: boolean }) {
  const grid = (
    <Grid gap={rowGap(row.container)} alignItems={rowAlign(row.container)}>
      {row.children.map((column, i) => (
        <ColumnView key={column.id} column={column} ratio={row.ratio} index={i} registry={registry} />
      ))}
    </Grid>
  );
  // width applies to top-level rows only (Spec §3); nested rows fill their cell.
  if (!top) return grid;
  return (
    <Container as="section" maxWidth={rowWidth(row.container)}>
      {grid}
    </Container>
  );
}

function NodeList({ nodes, registry, top }: { nodes: Node[]; registry: Registry; top: boolean }) {
  return (
    <>
      {nodes.map((node) => {
        if (node.type === 'block') return <BlockView key={node.id} node={node} registry={registry} />;
        if (node.type === 'row') return <RowView key={node.id} row={node} registry={registry} top={top} />;
        // A stray column never survives the validator; belt-and-braces skip.
        return null;
      })}
    </>
  );
}

export function TreeRenderer({ body, site, components = {} }: TreeRendererProps) {
  const registry: Registry = { ...atomBlocks, ...organismBlocks, ...components };
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
  const gap = stackGap(resolved.rootContainer);
  return (
    <>
      <header>
        <NodeList nodes={resolved.header} registry={registry} top />
      </header>
      <main
        data-press-stack={gap ? '' : undefined}
        style={gap ? ({ ['--press-tree-gap' as string]: gap } as CSSProperties) : undefined}
      >
        <NodeList nodes={resolved.children} registry={registry} top />
      </main>
      <footer>
        <NodeList nodes={resolved.footer} registry={registry} top />
      </footer>
    </>
  );
}
```

- [ ] **Step 3: Kill list + export surface**

```bash
git rm packages/web/src/block-renderer.tsx packages/web/src/block-renderer.test.tsx \
       packages/web/src/block-key.ts packages/web/src/block-key.test.ts \
       packages/web/src/sections/columns.tsx packages/web/src/sections/columns.test.ts
```

- `organism-blocks.ts`: delete the `Columns` import and the `'preset-organism.columns'` entry.
- `index.ts`: remove `export { BlockRenderer } …`, `export { Columns } …`, `renderBlocks` (already gone in Task 13); add:

```ts
export { TreeRenderer } from './tree/tree-renderer';
export { resolveTree, hydrateEngineBlocks } from './tree/resolve-slots';
export { PressLink } from './press-link';
export { resolveLink, coerceLink } from './link';
export type { PressLinkData, ResolvedLink } from './link';
export type {
  PressTree, LayoutNode, Node, RowNode, ColumnNode, BlockNode, Slot,
  ContainerAttrs, Ratio, Gap, VerticalAlign, ContainerWidth,
} from '@ogs-tech/press-shared';
```

and drop the dead type re-exports (`Block`, `PresetOrganismColumns`, `PresetMoleculeColumn`, `ChromeBlock`, `ResolvedChromeFooter`; keep `ResolvedNavLink` as the alias). `urn.ts` and its `blockKey`-adjacent comment: `blockKey` was the COMPUTED identity class — delete any dangling reference in comments.

- [ ] **Step 4: Full web suite now runs green**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: ALL web tests PASS (this is the first full-suite green since Task 12), typecheck exit 0. Remaining failures here mean a missed call site of a deleted symbol — fix before committing.

- [ ] **Step 5: Commit**

```bash
git add -A packages/web
git commit -m "feat(web)!: TreeRenderer replaces BlockRenderer; columns organism and blockKey retired"
```

### Task 18: Host template + theme.css (prose rescope, stack/cell rules)

**Files:**
- Modify: `packages/web/templates/host/app/layout.tsx`
- Modify: `packages/web/templates/host/app/[[...slug]]/page.tsx`
- Modify: `packages/web/templates/host/next.config.ts`
- Modify: `packages/web/theme.css`

**Interfaces:**
- Consumes: `TreeRenderer` (Task 17), `getSiteConfig`/`getPage` (unchanged).
- Produces: the running host. ISR semantics unchanged (`revalidate = 60`, `generateStaticParams`, `/home → /` 308).

- [ ] **Step 1: RootLayout drops the chrome**

In `packages/web/templates/host/app/layout.tsx`: remove the `BlockRenderer` import and the `<header>…</header>` / `<main>{children}</main>` / `<footer>…</footer>` block. The `<body>` becomes:

```tsx
<body>
  {/* The page shell (header/main/footer) is rendered by TreeRenderer inside the
      route — the layout cannot see the slug, so it cannot resolve per-page
      slots (Spec §5). It keeps html/head, theme injection, consent bootstrap
      and the cookie banner. */}
  {children}
  <CookieConsentBanner key={site.plugins.cookieConsent.urn} plugin={site.plugins.cookieConsent} />
</body>
```

(Keep `const site = await getSiteConfig(buildTime);`, the theme `<style>`, the consent script, fonts — all untouched. Remove the now-unused `customBlocks` import.)

- [ ] **Step 2: The route renders the tree**

In `packages/web/templates/host/app/[[...slug]]/page.tsx`, replace the imports (`BlockRenderer` → `TreeRenderer`) and the page component body:

```tsx
export default async function CatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  // The home page is canonical at the root only. A direct hit on its slug
  // (e.g. /home) 308-redirects to '/', so home has no public slug URL.
  if (path && path === buildTime.routes.home) permanentRedirect('/');

  const [site, page] = await Promise.all([
    getSiteConfig(buildTime),
    getPage(path || buildTime.routes.home),
  ]);
  if (!page) notFound();
  return <TreeRenderer body={page.body} site={site} components={customBlocks} />;
}
```

- [ ] **Step 3: Transpile press-shared**

In `packages/web/templates/host/next.config.ts`:

```ts
transpilePackages: ['@ogs-tech/press-web', '@ogs-tech/press-shared'],
```

(with the comment extended: press-shared also ships TS source and is now a runtime dep of press-web.)

- [ ] **Step 4: theme.css changes (four edits)**

1. **Prose rescope (Spec §5 "Load-bearing CSS change")** — the selector at ~line 106 becomes DIRECT children only, so atoms inside Column cells fill their cell:

```css
main > [data-block^="preset-atom."],
main > [data-block^="custom-atom."] {
  max-width: var(--press-container-prose);
  margin-inline-start: calc(max(100% - var(--press-container-lg), 0px) / 2 + var(--press-container-padding-x));
  margin-inline-end: var(--press-container-padding-x);
}
```

(Update the comment above it: "top-level BlockNodes render as direct `<main>` children, so the editorial prose column survives exactly where it applies; cell-nested atoms are excluded on purpose — the cell owns their width.")

2. **Main stack rhythm** (only when the layout root declares a gap — flex gap replaces per-block margins, which do NOT collapse in flex, hence the margin reset):

```css
/* Tree root rhythm: the LayoutNode's container.gap. Flex gap replaces the
   blocks' own vertical margins (margins never collapse inside flex — without
   the reset every gap would double). Absent gap → no attr → legacy margins. */
main[data-press-stack] {
  display: flex;
  flex-direction: column;
  gap: var(--press-tree-gap, var(--press-space-5));
}
main[data-press-stack] > * {
  margin-block: 0;
}
```

3. **Column cells**:

```css
/* Tree column cells: stack rhythm + vertical placement within the row height.
   height:100% makes verticalAlign meaningful when siblings are taller. */
[data-press-cell] {
  display: flex;
  flex-direction: column;
  gap: var(--press-cell-gap, var(--press-space-4));
  height: 100%;
}
[data-press-cell] > * {
  margin-block: 0;
}
[data-press-cell][data-cell-align="center"] { justify-content: center; }
[data-press-cell][data-cell-align="end"] { justify-content: flex-end; }
```

4. **Delete every `preset-organism.columns` rule** — all selectors containing `[data-block="preset-organism.columns"]` (the `data-column="cell"/"content"/"image"/"button"` family, ~lines 229–395): the tree world renders REAL atom components inside cells.

- [ ] **Step 5: Verify materialization still passes + commit**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: PASS (materialize tests copy the templates verbatim; breakpoints test still asserts theme.css media literals — untouched).

```bash
git add packages/web
git commit -m "feat(web)!: host renders the tree shell; prose rail rescoped to direct main children; cell/stack CSS"
```

### Task 19: Generator rewrite (type-sync for trees)

**Files:**
- Modify: `packages/web/src/generator/generate.ts`
- Test: rewrite `packages/web/src/generator/generate.test.ts` (the `generateTypes` describe; keep `pascalForUid`/`tsTypeForAttribute` describes, extended)

**Interfaces:**
- Consumes: `PressSchema` (with `tree` version), `Attr`.
- Produces — generated file contract (exact):
  - Header comment unchanged + `import type { PressTree } from '@ogs-tech/press-web';`
  - `PressMedia` interface (unchanged) + NEW `export interface PressPageRef { documentId: string; slug?: string }`
  - One interface per component in `schema.components` — NO `__component`, NO `id` (tree `data` objects, not DZ rows)
  - `tsTypeForAttribute` new mapping: `relation` with `target: 'plugin::press-cms.page'` → `'PressPageRef'` (other relations still skipped by `emitInterfaceBody`)
  - `export type PageBody = PressTree;` — the `HeaderBlocks`/`FooterBlocks` unions DIE
  - `Page` interface: `body: PageBody`; `pageDefaults`-bearing site-setting stays un-emitted (as today)

- [ ] **Step 1: Update the tests (failing)**

In `generate.test.ts`:
- Extend `tsTypeForAttribute`: `expect(tsTypeForAttribute({ type: 'relation', target: 'plugin::press-cms.page' } as any)).toBe('PressPageRef');` and keep `expect(tsTypeForAttribute({ type: 'relation' })).toBe('unknown');` (non-page relations remain skipped at emit).
- Rewrite the `generateTypes` describe fixture: page `body` attr becomes `{ type: 'customField', customField: 'plugin::press-cms.builder' }`; components map includes `preset-molecule.link` with the `page` relation attr. New assertions:

```ts
const out = generateTypes(schema as any);
expect(out).toContain("import type { PressTree } from '@ogs-tech/press-web';");
expect(out).toContain('export interface PressPageRef {');
expect(out).toContain('export type PageBody = PressTree;');
expect(out).not.toContain('__component');
expect(out).not.toContain('HeaderBlocks');
expect(out).toContain('export interface PresetMoleculeLink {');
expect(out).toContain('page?: PressPageRef;');
expect(out).toMatch(/export interface Page \{[\s\S]*body: PageBody;/);
expect(out).not.toMatch(/interface \w+ \{\n  id: number;/); // data shapes carry no row id
```

Run: `pnpm --filter @ogs-tech/press-web test src/generator` — expected FAIL.

- [ ] **Step 2: Rewrite generate.ts**

Changes to `packages/web/src/generator/generate.ts`:

```ts
const PAGE_REF = `export interface PressPageRef {
  documentId: string;
  slug?: string;
}`;

// in tsTypeForAttribute, BEFORE the final fallback:
  if (attr.type === 'relation') {
    return (attr as Record<string, unknown>).target === 'plugin::press-cms.page' ? 'PressPageRef' : 'unknown';
  }

// in emitInterfaceBody: change the relation skip to skip only NON-page relations:
      if (attr.type === 'relation' && (attr as Record<string, unknown>).target !== 'plugin::press-cms.page') return null;

// in generateTypes:
  const blocks: string[] = [
    '// AUTO-GENERATED by @ogs-tech/press-web sync-types — DO NOT EDIT.',
    '// Regenerate with: pnpm --filter @ogs-tech/press-web sync-types',
    '',
    "import type { PressTree } from '@ogs-tech/press-web';",
    '',
    PRESS_MEDIA,
    '',
    PAGE_REF,
    '',
  ];
  // component emission loses the dzMembers logic and the id line:
  for (const [uid, comp] of Object.entries(schema.components)) {
    const name = pascalForUid(uid);
    componentTypeNames[uid] = name;
    blocks.push(`export interface ${name} {`, emitInterfaceBody(comp.attributes), `}`, '');
  }
  blocks.push('/** The page body IS the composition tree (composition-builder spec §5). */');
  blocks.push(`export type PageBody = PressTree;`, '');
  // Page interface: body maps to PageBody exactly as before; delete the union() helper
  // and the HeaderBlocks/FooterBlocks block entirely.
```

(Also delete the now-unused `dzMembers` computation and `union` helper; empty-interface guard: when a component has zero emitted fields, `emitInterfaceBody` returns `''` — keep pushing it; an empty interface is valid TS.)

- [ ] **Step 3: Run, commit**

Run: `pnpm --filter @ogs-tech/press-web test && pnpm --filter @ogs-tech/press-web typecheck`
Expected: full suite PASS.

```bash
git add packages/web
git commit -m "feat(web)!: generator emits tree-world types (PageBody = PressTree, PressPageRef, no DZ unions)"
```

---

## Phase 5 — CLI seed, scaffold baseline, integration & docs

### Task 20: Tree seed + the seed-shape regression guard

**Files:**
- Create: `packages/cli/templates/cms/scripts/seed-content.mjs`
- Modify: `packages/cli/templates/cms/scripts/seed.mjs`
- Modify: `packages/cli/templates/project/packages/shared/types/generated.ts`
- Modify: `packages/cli/package.json` (devDependency `"@ogs-tech/press-shared": "workspace:*"`)
- Test: `packages/cli/src/create/seed-content.test.ts`

**Interfaces:**
- Consumes: `validatePressTree` (shared) in the test; the tree/link/plain-text contracts.
- Produces: `seed-content.mjs` exports `SITE_SETTINGS` (unchanged values), `buildHomeBody({ heroAssetId })` → a `PressTree`, and `buildPageDefaults({ homeDocumentId, repoUrl, npmCreateUrl })` → `{ header, footer }`. Extracted as a pure data module precisely so the CLI test can validate the seeded shape — the missing seed-regression guard named in Spec §8.

- [ ] **Step 1: Write the seed content module**

Create `packages/cli/templates/cms/scripts/seed-content.mjs`:

```js
// cms/scripts/seed-content.mjs — the demo content as PURE DATA, importable by
// both seed.mjs (to write it) and the engine's CLI test suite (to validate the
// tree shape against the shared validator — the seed-regression guard).
// Plain-text content throughout (curated `content: text` decision 2026-07-20).
import { randomUUID } from 'node:crypto';

export const REPO_URL = 'https://github.com/ogs-tech/press';
export const PRESS_SITE_URL = 'https://useogs.com/press';
export const NPM_CREATE_URL = 'https://www.npmjs.com/package/@ogs-tech/create-press';

export const SITE_SETTINGS = {
  name: 'Press',
  url: 'http://localhost:3000',
  locale: 'en',
  seo: {
    titleTemplate: '%s · Press',
    title: 'Press',
    description: 'A press-powered site, server-rendered end-to-end.',
  },
  themeColors: {
    primary: '#119350',
    accent: '#D9A12C',
    secondary: '#3D5CC2',
    ink: '#142036',
    surface: '#FAF8F3',
    muted: '#7A7E89',
    danger: '#C0392B',
    onPrimary: '#FFFFFF',
    border: 'rgba(20,32,54,0.12)',
  },
  themeRadius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
};

const block = (component, data = {}) => ({ id: randomUUID(), type: 'block', component, data });
const column = (children, container) => ({ id: randomUUID(), type: 'column', children, ...(container ? { container } : {}) });
const row = (ratio, children, container) => ({ id: randomUUID(), type: 'row', ratio, children, ...(container ? { container } : {}) });

/**
 * The demo home as a PressTree (Spec §4 seeds): hero → prose atoms → a 50-50
 * row whose right column nests ANOTHER row (the recursion demo) → separator/
 * button/spacer → cta banner → adopter callout. Chrome inherits pageDefaults.
 */
export const buildHomeBody = ({ heroAssetId }) => ({
  version: 1,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [
      block('preset-organism.hero', {
        eyebrow: 'Press engine',
        title: 'Hello from press',
        subtitle: 'A press-powered site, server-rendered end-to-end.',
        image: { assetId: heroAssetId },
        cta: { label: 'Read the docs', url: REPO_URL },
        align: 'left',
      }),
      block('preset-atom.heading', { text: 'What ships in the box', level: '2' }),
      block('preset-atom.paragraph', {
        content: 'This prose lives in the CMS and renders as static HTML — no client hydration.',
      }),
      block('preset-atom.list', {
        format: 'unordered',
        content: [
          'Atomic text blocks — paragraph, heading, list and quote.',
          'Media & structure — image, button, separator and spacer.',
          'Rows and columns — recursive layout composed in the admin.',
          'Your own custom-* blocks, usable anywhere in the tree.',
        ].join('\n'),
      }),
      block('preset-atom.quote', {
        content: 'The contract is HTML on the server.',
        citation: 'The press engine',
      }),
      // The composition mechanism itself: a 50-50 row whose RIGHT column nests
      // another 50-50 row — full recursion on the demo page.
      row('50-50', [
        column([
          block('preset-atom.paragraph', {
            content: 'Editor-composed layout — rows and columns arranged in the admin, rendered on the engine grid.',
          }),
        ]),
        column([
          row('50-50', [
            column([block('preset-atom.paragraph', { content: 'Columns nest rows.' })]),
            column([block('preset-atom.paragraph', { content: 'Rows nest columns.' })]),
          ]),
        ], { verticalAlign: 'center' }),
      ], { gap: 'normal' }),
      block('preset-atom.separator', { variant: 'line' }),
      block('preset-atom.button', {
        link: { label: 'Star on GitHub', url: REPO_URL, newTab: true },
        variant: 'secondary',
      }),
      block('preset-atom.spacer', { size: 'md' }),
      block('preset-organism.cta', {
        title: 'Ready to press publish?',
        subtitle: 'Scaffold a site, open the admin, and ship your first page in minutes.',
        button: { label: 'Scaffold your site', url: PRESS_SITE_URL },
        align: 'center',
      }),
      block('custom-organism.callout', {
        message: 'Adopter callout renders via the Project-zone block map',
        variant: 'success',
      }),
    ],
  },
});

/**
 * Demo navigation for Site Settings pageDefaults: the Home item is a PAGE REF
 * ({ documentId }) — exercising the reference-hydration path end-to-end — plus
 * an external link and a CTA button. The footer keeps the bare seeded node.
 */
export const buildPageDefaults = ({ homeDocumentId }) => ({
  header: [
    block('preset-organism.navbar', {
      items: [
        { label: 'Home', page: { documentId: homeDocumentId } },
        { label: 'GitHub', url: REPO_URL, newTab: true },
      ],
      cta: { link: { label: 'Get started', url: NPM_CREATE_URL }, variant: 'primary' },
    }),
  ],
  footer: [block('preset-organism.footer', {})],
});
```

- [ ] **Step 2: Rewrite seed.mjs around it**

In `packages/cli/templates/cms/scripts/seed.mjs`: keep the boot scaffolding (createRequire/compileStrapi/createStrapi, PNG constant, uploadImage, teardown) VERBATIM; replace the content section with this flow (ORDER inverted vs today — the page must exist before pageDefaults can reference its documentId):

```js
import { buildHomeBody, buildPageDefaults, SITE_SETTINGS } from './seed-content.mjs';

// … inside main(), after app load:

// 1. The published home page (skip-if-any-published-page-exists, unchanged rule).
let homeDocumentId;
const existing = await app.documents(PAGE_UID).findMany({ status: 'published' });
if (existing.length > 0) {
  console.log(`[seed] ${existing.length} published page(s) exist — skipping page seed (delete cms/.tmp to reset).`);
  homeDocumentId = existing.find((p) => p.slug === SLUG)?.documentId;
} else {
  const heroImageId = await uploadImage('press-hero.png');
  console.log(`[seed] uploaded hero image id=${heroImageId}`);
  const page = await app.documents(PAGE_UID).create({
    data: { title: 'Hello from press', slug: SLUG, body: buildHomeBody({ heroAssetId: heroImageId }) },
    status: 'published',
  });
  homeDocumentId = page.documentId;
  console.log(`[seed] created published page documentId=${page.documentId} slug=${SLUG}`);
}

// 2. Site Settings: identity + theme + demo pageDefaults (idempotent: skip once named).
const settings = await app.documents(SITE_SETTING_UID).findFirst();
if (settings?.name) {
  console.log('[seed] site settings already filled — skipping.');
} else {
  const data = { ...SITE_SETTINGS };
  if (homeDocumentId) data.pageDefaults = buildPageDefaults({ homeDocumentId });
  if (settings) {
    await app.documents(SITE_SETTING_UID).update({ documentId: settings.documentId, data });
    console.log('[seed] site settings filled (pageDefaults navigation seeded).');
  } else {
    await app.documents(SITE_SETTING_UID).create({ data });
    console.log('[seed] site settings created (pageDefaults navigation seeded).');
  }
}
```

(Delete the old `header` navbar array and the old DZ `body` array wholesale. `REPO_URL`/`NPM_CREATE_URL`/`PRESS_SITE_URL` now come from seed-content.mjs — remove the local constants.)

- [ ] **Step 3: The seed-regression guard (failing first)**

Add `"@ogs-tech/press-shared": "workspace:*"` to `packages/cli/package.json` devDependencies; `pnpm install`.

Create `packages/cli/src/create/seed-content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validatePressTree, validateNodeArray } from '@ogs-tech/press-shared';
// The template ships as plain .mjs data — imported across the package boundary on purpose:
// this test IS the guard that the scaffold seeds a valid tree (spec §8, CLI).
// eslint-not-applicable: repo has no eslint.
import { buildHomeBody, buildPageDefaults } from '../../templates/cms/scripts/seed-content.mjs';

describe('seeded home body', () => {
  const tree = buildHomeBody({ heroAssetId: 7 }) as any;

  it('is a valid PressTree with inherited chrome', () => {
    const { value, errors, warnings } = validatePressTree(tree);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(value!.root.header).toEqual({ mode: 'inherit' });
  });

  it('opens with the hero (assetId media ref) and closes with cta + adopter callout', () => {
    const children = tree.root.children;
    expect(children[0]).toMatchObject({ type: 'block', component: 'preset-organism.hero' });
    expect(children[0].data.image).toEqual({ assetId: 7 });
    expect(children.at(-2)).toMatchObject({ component: 'preset-organism.cta' });
    expect(children.at(-1)).toMatchObject({ component: 'custom-organism.callout' });
  });

  it('demonstrates recursion: a 50-50 row whose column nests another row', () => {
    const rowNode = tree.root.children.find((n: any) => n.type === 'row');
    expect(rowNode.ratio).toBe('50-50');
    const nested = rowNode.children[1].children.find((n: any) => n.type === 'row');
    expect(nested).toBeDefined();
    expect(nested.children).toHaveLength(2);
  });

  it('uses plain-text content and link descriptors (no blocks AST, no href strings)', () => {
    const json = JSON.stringify(tree);
    expect(json).not.toContain('"type":"paragraph"');   // no blocks AST nodes
    expect(json).not.toContain('ctaHref');
    const button = tree.root.children.find((n: any) => n.component === 'preset-atom.button');
    expect(button.data.link).toMatchObject({ label: 'Star on GitHub' });
  });
});

describe('seeded pageDefaults', () => {
  const pd = buildPageDefaults({ homeDocumentId: 'home-doc' }) as any;

  it('slots validate as Node[] and the Home item is a page ref', () => {
    expect(validateNodeArray(pd.header).errors).toEqual([]);
    expect(validateNodeArray(pd.footer).errors).toEqual([]);
    const navbar = pd.header[0];
    expect(navbar.data.items[0].page).toEqual({ documentId: 'home-doc' });
    expect(navbar.data.cta.link.label).toBe('Get started');
  });
});
```

Run: `pnpm --filter @ogs-tech/create-press test` — expected: PASS once Steps 1–2 exist (write the test BEFORE seed-content.mjs if strict test-first ordering is wanted; the module is data, so either order is acceptable — the guard's value is permanent regression protection).

- [ ] **Step 4: Refresh the scaffold's committed type baseline**

Replace `packages/cli/templates/project/packages/shared/types/generated.ts` with a baseline matching the NEW generator output (Task 19 contract — no `__component`/`id`, PressPageRef, `PageBody = PressTree`). Content:

```ts
// AUTO-GENERATED by @ogs-tech/press-web sync-types — DO NOT EDIT.
// Regenerate with: pnpm --filter @ogs-tech/press-web sync-types

import type { PressTree } from '@ogs-tech/press-web';

export interface PressMedia {
  url: string;
  width?: number;
  height?: number;
  alternativeText?: string | null;
  name?: string;
  mime?: string;
}

export interface PressPageRef {
  documentId: string;
  slug?: string;
}

export interface PresetAtomParagraph {
  content: string;
}

export interface PresetAtomHeading {
  text: string;
  level: '1' | '2' | '3' | '4' | '5' | '6';
}

export interface PresetAtomList {
  content: string;
  format?: 'unordered' | 'ordered';
}

export interface PresetAtomQuote {
  content: string;
  citation?: string;
}

export interface PresetAtomImage {
  image: PressMedia;
  caption?: string;
}

export interface PresetAtomButton {
  link?: PresetMoleculeLink;
  variant?: 'primary' | 'secondary';
}

export interface PresetAtomSeparator {
  variant?: 'line' | 'dots';
}

export interface PresetAtomSpacer {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface PresetMoleculeLink {
  label?: string;
  page?: PressPageRef;
  url?: string;
  newTab?: boolean;
}

export interface PresetLayoutContainer {
  width?: 'prose' | 'lg' | 'full';
  gap?: 'compact' | 'normal' | 'spacious';
  verticalAlign?: 'top' | 'center' | 'bottom';
}

export interface PresetLayoutRow {
  ratio?: '50-50' | '33-67' | '67-33' | '33-33-33' | '25-25-25-25';
  container?: PresetLayoutContainer;
}

export interface PresetLayoutColumn {
  container?: PresetLayoutContainer;
}

export interface PresetOrganismHero {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: PressMedia;
  cta?: PresetMoleculeLink;
  align?: 'left' | 'center';
}

export interface PresetOrganismCta {
  title: string;
  subtitle?: string;
  button?: PresetMoleculeLink;
  align?: 'left' | 'center';
}

export interface PresetOrganismNavbar {
  items?: PresetMoleculeLink[];
  cta?: PresetAtomButton;
}

export interface PresetOrganismFooter {
  text?: string;
}

export interface CustomOrganismCallout {
  message: string;
  variant?: 'info' | 'warning' | 'success';
}

/** The page body IS the composition tree (composition-builder spec §5). */
export type PageBody = PressTree;

export interface Page {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: PageBody;
}
```

(The preset-config interfaces the live generator will also emit are OMITTED from the baseline on purpose — nothing in a fresh scaffold imports them, and the first `press dev` overwrites the file with the exact live output. Note this in the file only if the current baseline carries a similar note.)

Check `packages/cli/templates/project/packages/web/blocks/custom/Callout.tsx`: it types props via the generated `CustomOrganismCallout` — the interface lost `__component`/`id` but kept `message`/`variant`, so it compiles unchanged. If it destructures `id` or `__component`, remove that.

- [ ] **Step 5: Run the CLI suite + commit**

Run: `pnpm --filter @ogs-tech/create-press test && pnpm --filter @ogs-tech/create-press typecheck` (if the package has no typecheck script, `pnpm -r --if-present typecheck` covers it in Task 21)
Expected: PASS — including the existing scaffold/compute-versions suites (untouched).

```bash
git add -A packages/cli pnpm-lock.yaml
git commit -m "feat(cli)!: seed the demo home as a PressTree + pageDefaults navigation; seed-shape regression guard"
```

### Task 21: Playground regeneration, end-to-end verification, changesets, CLAUDE.md

**Files:**
- Regenerate: `apps/playground` (whole tree, via script)
- Create: `.changeset/composition-builder.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Regenerate the dogfood playground**

```bash
pnpm exec tsx scripts/create-playground.ts && pnpm install
```

Expected: `apps/playground` recreated from the live scaffold (workspace-rewired). Inspect `git status` — the diff should show the new seed scripts, generated.ts baseline, next.config transpile line; the cms Strapi uuid is preserved by the script.

- [ ] **Step 2: Full monorepo verification**

```bash
pnpm build && pnpm -r test && pnpm -r --if-present typecheck && pnpm pack:check
```

Expected: every step exit 0. `pack:check` now dry-run-publishes **@ogs-tech/press-shared too** (it matches `./packages/*` and is no longer private) — confirm its tarball lists `src/tree.ts`/`src/validate-tree.ts` and NO `*.test.ts`.

- [ ] **Step 3: Boot the playground and verify the loop end-to-end (manual, from the "playground loads cms dist" rule: `pnpm build` already ran)**

```bash
pnpm dev
```

Verify, in order:
1. cms boots; seed runs; web boots. `curl -s localhost:1337/api/press/schema | grep '"tree"'` → `{"version":1}` present.
2. `curl -s localhost:1337/api/pages/home` → `body.version === 1`; the hero's `image` carries a hydrated `url` (not a bare assetId); the navbar item in `/api/site-setting` `pageDefaults.header` carries `page: { documentId, slug: "home" }`.
3. `localhost:3000` renders: navbar (brand + Home + GitHub + CTA), hero with image, prose atoms at the ~72ch rail, the recursive 50-50 row, cta banner, adopter callout, footer.
4. Admin (`localhost:1337/admin`): open the home page — the Composition field renders the tree; add a paragraph inside a column; Save; reload `localhost:3000` (or wait ≤60s ISR) — the change appears. Pick an image via the media dialog on a hero (Task 11 Step 7 verification); if the dialog key mismatches, the assetId fallback input must appear — fix the key then.
5. Site Settings: pageDefaults renders the slots editor; emptying the header and saving renders inheriting pages bare.

Any failure here is a bug in the corresponding task — apply superpowers:systematic-debugging, fix at root cause, re-run this step.

- [ ] **Step 4: Changeset**

Create `.changeset/composition-builder.md` (major across the board — the atomic-design/chrome-blocks precedent for wire-breaking changes):

```md
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
```

- [ ] **Step 5: Rewrite the affected CLAUDE.md sections**

Update `CLAUDE.md` (this file is the living architectural reference — Spec §10 phase 5). Precise edits:

1. **"Architecture — the moving parts" → new first subsection "Composition trees (`PressTree`)"** replacing the DZ-centric framing: page `body` and Site Settings `pageDefaults` are JSON trees stored by the `plugin::press-cms.builder` custom field; node kinds (layout root with `inherit|none|custom` slots, row/ratio, column-recursion, block/`data`); the ONE `container` attr surface; responsiveness never in the JSON; ids are builder-minted, never URNs; version-gated readers; strict-write/tolerant-read validator split (shared validator, cms lifecycles reject warnings, web sanitizes); serve-time hydration of `{ assetId }`/`{ documentId }` refs (kills the populate bug class — `dz-populate` is gone).
2. **"The contract + type-sync loop"**: serialize-schema serves the FULL palette + `tree.version`; generator emits data-shaped interfaces (no `__component`/`id`), `PressPageRef`, `PageBody = PressTree`; `HeaderBlocks`/`FooterBlocks` unions are gone.
3. **"Component palette"**: components are a pure schema catalog (nothing is "admitted" — `admitCustomBlocks` is gone; the `custom-*` prefix remains the whole extension contract, discovered from the registry); `preset-molecule.link` is the one link concept (page ref > url, hydrated slug); text atoms are curated plain text (blank line = paragraph; one list item per line); `preset-layout.{container,row,column}` are registry descriptors for builder forms (the category is no longer reserved-empty); columns/nav-item/molecule.column retired; picker-labels section: note the builder has its own palette select (categories still labelled for the admin).
4. **"Build-time anchors vs. runtime Site Settings"**: `header`/`footer` DZs → `pageDefaults` JSON slots; inheritance semantics (edit-once-update-everywhere via ISR; emptied-is-respected; failure → bare pages); `chrome` key in `ResolvedPressConfig` → `pageDefaults` raw `Node[]` + one hydration point in `resolveTree`.
5. **Layout primitives section**: add that `TreeRenderer` is now the primitives' first consumer (top-level row = Container+Grid, nested row = bare Grid, cells = `[data-press-cell]` stacks); the prose rule is DIRECT-children-scoped now — update the load-bearing-CSS paragraph.
6. **packages/shared bullet in "Layout"**: no longer "type-only"; it is a PUBLISHED runtime dep (wire types + pure validators; zero Strapi/Next imports); cms bundles it into dist (devDependency), web depends on it (adopter-installed, transpiled by the host).
7. **Mobile nav / navbar hydration bullets**: navbar `items` are `preset-molecule.link[]`; hydration happens in `resolveTree` for engine blocks wherever they sit.
8. Remove every stale mention: `preset-organism.columns`, `preset-molecule.column`, `nav-item`, `buildBodyPopulate`/`dz-populate`, `renderBlocks`/blocks AST, `BlockRenderer` (now `TreeRenderer` — note override contract `components={{ 'preset-organism.hero': MyHero }}` is unchanged), `blockKey` (the COMPUTED URN class: state that tree node `id`s replaced it as React keys and remain outside the URN system).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "docs+chore!: playground regenerated for the composition builder; changeset + CLAUDE.md architecture rewrite"
```

---

## Self-review record (plan-time)

**Spec coverage check** (spec section → task): §3 data model + validator → Tasks 1–2; §4 storage → Task 4; §4 schema catalog + preset-layout + serialize → Tasks 3, 5; §4 admin field → Tasks 9–11; §4 validation & seeds → Tasks 7–8, 20; §5 TreeRenderer → Tasks 15–17; §5 host template → Task 18; §5 type-sync → Task 19; §5 CSS rescope → Task 18; §6 settings behavior → Tasks 8, 16, 21(step 3.5); §7 error handling → Tasks 2 (sanitize/version gate), 16 (slot failure→none, defaults fail-to-empty), 17 (malformed body, unknown component/type skips); §8 testing → every task's test steps + Task 20 (CLI guard); §10 changesets/docs → Task 21.

**Deviations from the spec text (all user-approved 2026-07-20, recorded in "Decisions locked" above):** curated plain-text `content` replaces blocks AST; `preset-molecule.link` everywhere (nav-item deleted — it was exactly a link; the spec's "nav-item nesting pattern" references map to link nesting); press-shared becomes published (forced by the spec's own runtime-validator requirement); page refs hydrate `{ documentId } → slug` (extends the spec's media-only hydration sentence to links, same mechanism).

**Known risk points, each with an in-plan verification step:** press-shared bundling into cms dist (Task 5 Step 5 grep); custom-field value round-trip + media-library dialog key in Strapi 5.48 admin (Task 11 Step 7 + Task 21 Step 3, with the assetId-input fallback as the safety net); flex-gap vs block-margin doubling (Task 18 margin resets, asserted visually in Task 21 Step 3).





