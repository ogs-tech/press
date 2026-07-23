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
