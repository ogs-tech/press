import { describe, expect, it } from 'vitest';
import { defineConfig } from './define-config';

describe('defineConfig', () => {
  it('returns the same config object (identity at runtime)', () => {
    const cfg = { brand: { name: 'Acme' } };
    expect(defineConfig(cfg)).toBe(cfg);
  });
});
