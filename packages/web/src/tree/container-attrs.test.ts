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
