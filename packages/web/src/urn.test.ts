import { describe, expect, it } from 'vitest';
import { buildUrn } from './urn';

describe('buildUrn', () => {
  it('formats urn:{entity}:{id} for a string id', () => {
    expect(buildUrn('page', 'abc123')).toBe('urn:page:abc123');
  });

  it('formats urn:{entity}:{id} for a numeric id', () => {
    expect(buildUrn('press.image', 5)).toBe('urn:press.image:5');
  });

  it('keeps equal ids under different entities distinct (the entity segment qualifies the id)', () => {
    expect(buildUrn('page', '1')).not.toBe(buildUrn('site-setting', '1'));
  });
});
