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
