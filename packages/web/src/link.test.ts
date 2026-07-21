import { describe, expect, it } from 'vitest';
import { coerceLink, resolveLink } from './link';

describe('resolveLink', () => {
  it('prefers page over url and collapses the home slug to /', () => {
    expect(resolveLink({ label: 'About', page: { documentId: 'd1', slug: 'about' }, url: 'https://ignored' }, 'home'))
      .toEqual({ label: 'About', href: '/about', external: false, newTab: false });
    expect(resolveLink({ label: 'Home', page: { documentId: 'd2', slug: 'home' } }, 'home'))
      .toEqual({ label: 'Home', href: '/', external: false, newTab: false });
  });

  it('falls back to url when the page ref has no slug (unpublished), then drops the link', () => {
    expect(resolveLink({ label: 'X', page: { documentId: 'gone' }, url: '/fallback' }))
      .toEqual({ label: 'X', href: '/fallback', external: false, newTab: false });
    expect(resolveLink({ label: 'X', page: { documentId: 'gone' } })).toBeNull();
    expect(resolveLink({ label: 'X' })).toBeNull();
    expect(resolveLink(null)).toBeNull();
  });

  it('flags external http(s) urls and honors newTab', () => {
    expect(resolveLink({ label: 'GH', url: 'https://github.com', newTab: true }))
      .toEqual({ label: 'GH', href: 'https://github.com', external: true, newTab: true });
    expect(resolveLink({ label: 'mail', url: 'mailto:x@y.z' })!.external).toBe(false);
  });

  it('neutralizes executable protocols', () => {
    expect(resolveLink({ label: 'evil', url: 'javascript:alert(1)' })!.href).toBe('#');
  });
});

describe('coerceLink', () => {
  it('passes resolved links through and resolves raw link data', () => {
    const resolved = { label: 'A', href: '/a', external: false, newTab: false };
    expect(coerceLink(resolved)).toEqual(resolved);
    expect(coerceLink({ label: 'B', url: '/b' })).toEqual({ label: 'B', href: '/b', external: false, newTab: false });
    expect(coerceLink('garbage')).toBeNull();
    expect(coerceLink(undefined)).toBeNull();
  });
});
