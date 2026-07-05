import { describe, expect, it } from 'vitest';
import { buildUrn, componentUrn } from './urn';

describe('buildUrn', () => {
  it('formats urn:{entity}:{id} for a string id', () => {
    expect(buildUrn('page', 'abc123')).toBe('urn:page:abc123');
  });

  it('formats urn:{entity}:{id} for a numeric id', () => {
    expect(buildUrn('preset-atom.image', 5)).toBe('urn:preset-atom.image:5');
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
    expect(componentUrn('preset-atom.image')).toBe('urn:component:preset-atom.image');
    expect(componentUrn('preset-organism.hero')).toBe('urn:component:preset-organism.hero');
    expect(componentUrn('custom-organism.callout')).toBe('urn:component:custom-organism.callout');
  });

  it('is a distinct axis from blockKey: the uid is the id segment here, the entity segment there', () => {
    // component TYPE identity vs computed per-instance identity
    expect(componentUrn('preset-atom.image')).not.toBe(buildUrn('preset-atom.image', 5));
    expect(componentUrn('preset-atom.image')).toBe('urn:component:preset-atom.image');
  });
});
