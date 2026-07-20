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
