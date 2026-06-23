import { describe, expect, it } from 'vitest';
import { blockKey } from './block-key';

describe('blockKey', () => {
  it('qualifies the id by __component so cross-type id collisions stay unique', () => {
    // Strapi DZ ids are unique only per component table: a gallery and a callout can
    // both be id 5. Keying by id alone would collide (the real "duplicate key 5" bug).
    const gallery = { __component: 'press.gallery', id: 5 };
    const callout = { __component: 'custom.callout', id: 5 };
    expect(blockKey(gallery, 0)).not.toBe(blockKey(callout, 1));
    expect(blockKey(gallery, 0)).toBe('press.gallery:5');
  });

  it('falls back to the array index when id is absent', () => {
    expect(blockKey({ __component: 'press.paragraph' }, 3)).toBe('press.paragraph:3');
  });
});
