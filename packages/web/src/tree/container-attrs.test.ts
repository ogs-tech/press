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
