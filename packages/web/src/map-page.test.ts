import { describe, expect, it } from 'vitest';
import { mapPage, type RawPage } from './map-page';

const raw: RawPage = {
  id: 1,
  documentId: 'doc-abc',
  title: 'Home',
  slug: 'home',
  body: {
    version: 2,
    root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [] },
  },
};

describe('mapPage', () => {
  it('attaches the canonical stored identity urn:page:{documentId}', () => {
    expect(mapPage(raw).urn).toBe('urn:page:doc-abc');
  });

  it('passes every wire field through unchanged', () => {
    expect(mapPage(raw)).toEqual({ ...raw, urn: 'urn:page:doc-abc' });
  });

  it('resolves seo.ogImage to an absolute URL, keeping the other seo fields unchanged', () => {
    const withSeo: RawPage = {
      ...raw,
      seo: { metaTitle: 'Override', metaDescription: 'Desc', ogImage: { url: '/uploads/og.png' }, noindex: true },
    };
    expect(mapPage(withSeo).seo).toEqual({
      metaTitle: 'Override',
      metaDescription: 'Desc',
      ogImage: 'http://localhost:1337/uploads/og.png',
      noindex: true,
    });
  });

  it('leaves seo undefined when the page has no seo component', () => {
    expect(mapPage(raw).seo).toBeUndefined();
  });
});
