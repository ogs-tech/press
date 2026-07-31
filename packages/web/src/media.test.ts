import { describe, expect, it } from 'vitest';
import { mediaUrl } from './media';

describe('mediaUrl', () => {
  it('resolves a relative Strapi url absolute against CMS_URL', () => {
    expect(mediaUrl({ url: '/uploads/logo.png' })).toBe('http://localhost:1337/uploads/logo.png');
  });

  it('keeps an already-absolute url unchanged', () => {
    expect(mediaUrl({ url: 'https://cdn.test/logo.png' })).toBe('https://cdn.test/logo.png');
  });

  it('returns undefined for null/undefined media', () => {
    expect(mediaUrl(null)).toBeUndefined();
    expect(mediaUrl(undefined)).toBeUndefined();
  });

  it('returns undefined when the media object has no url', () => {
    expect(mediaUrl({})).toBeUndefined();
  });
});
