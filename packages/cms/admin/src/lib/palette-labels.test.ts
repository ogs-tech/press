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
