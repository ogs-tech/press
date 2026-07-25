import { describe, expect, it } from 'vitest';
import {
  addColumn, effectiveSpan, getNode, insertNode, MAX_COLUMNS, moveNode, newBlockNode, newColumnNode,
  newRowNode, patchContainer, removeNode, setBlockData, setColumnSpan, setContainerAttr, type Forest,
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
