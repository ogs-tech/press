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
