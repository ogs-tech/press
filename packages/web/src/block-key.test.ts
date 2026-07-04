import { describe, expect, it } from 'vitest';
import { blockKey } from './block-key';
import { buildUrn } from './urn';

describe('blockKey', () => {
  it('qualifies the id by __component so cross-type id collisions stay unique', () => {
    // Strapi DZ ids are unique only per component table: an image and a callout can
    // both be id 5. Keying by id alone would collide (the real "duplicate key 5" bug).
    const image = { __component: 'press.image', id: 5 };
    const callout = { __component: 'custom.callout', id: 5 };
    expect(blockKey(image, 0)).not.toBe(blockKey(callout, 1));
    expect(blockKey(image, 0)).toBe('urn:press.image:5');
  });

  it('formats through the canonical urn primitive — one identity format, single-sourced', () => {
    expect(blockKey({ __component: 'press.image', id: 5 }, 0)).toBe(buildUrn('press.image', 5));
  });

  it('falls back to the array index when id is absent', () => {
    expect(blockKey({ __component: 'press.paragraph' }, 3)).toBe('urn:press.paragraph:3');
  });
});
