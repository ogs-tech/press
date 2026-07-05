import { describe, expect, it } from 'vitest';
import { blockKey } from './block-key';
import { buildUrn } from './urn';

describe('blockKey', () => {
  it('qualifies the id by __component so cross-type id collisions stay unique', () => {
    // Strapi DZ ids are unique only per component table: an image and a callout can
    // both be id 5. Keying by id alone would collide (the real "duplicate key 5" bug).
    const image = { __component: 'preset-atom.image', id: 5 };
    const callout = { __component: 'custom-organism.callout', id: 5 };
    expect(blockKey(image, 0)).not.toBe(blockKey(callout, 1));
    expect(blockKey(image, 0)).toBe('urn:preset-atom.image:5');
  });

  it('formats through the canonical urn primitive — one identity format, single-sourced', () => {
    expect(blockKey({ __component: 'preset-atom.image', id: 5 }, 0)).toBe(buildUrn('preset-atom.image', 5));
  });

  it('falls back to the array index when id is absent', () => {
    expect(blockKey({ __component: 'preset-atom.paragraph' }, 3)).toBe('urn:preset-atom.paragraph:3');
  });
});
