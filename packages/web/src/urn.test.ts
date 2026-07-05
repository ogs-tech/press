import { describe, expect, it } from 'vitest';
import { buildUrn, componentUrn } from './urn';

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

  it('formats the synthetic plugin identity (cookie-consent Spec §1)', () => {
    expect(buildUrn('plugin', 'cookie-consent')).toBe('urn:plugin:cookie-consent');
  });
});

describe('componentUrn', () => {
  it('formats a palette registration uid as urn:component:{uid} (type-level identity)', () => {
    expect(componentUrn('press.image')).toBe('urn:component:press.image');
    expect(componentUrn('section.hero')).toBe('urn:component:section.hero');
    expect(componentUrn('custom.callout')).toBe('urn:component:custom.callout');
  });

  it('is a distinct axis from blockKey: the uid is the id segment here, the entity segment there', () => {
    // component TYPE identity vs computed per-instance identity
    expect(componentUrn('press.image')).not.toBe(buildUrn('press.image', 5));
    expect(componentUrn('press.image')).toBe('urn:component:press.image');
  });
});
