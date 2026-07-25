import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, type ColumnNode, type LayoutDefaults } from '@ogs-tech/press-shared';
import { cellAlign, rowAlign, rowGap, rowWidth, spanFor, stackGap } from './container-attrs';

const col = (span: ColumnNode['span']): ColumnNode => ({ id: 'c', type: 'column', span, children: [] });

describe('spanFor', () => {
  it('returns the column span unchanged (base plus any declared tiers)', () => {
    expect(spanFor(col({ base: 12 }))).toEqual({ base: 12 });
    expect(spanFor(col({ base: 12, md: 6 }))).toEqual({ base: 12, md: 6 });
    expect(spanFor(col({ base: 12, md: 6, lg: 3 }))).toEqual({ base: 12, md: 6, lg: 3 });
  });
});

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
