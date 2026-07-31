import { describe, expect, it } from 'vitest';
import { mapSeoPlugin } from './map-seo-plugin';
import { DEFAULT_SEO_PLUGIN } from './default-seo-plugin';

describe('mapSeoPlugin', () => {
  it('resolves DEFAULT_SEO_PLUGIN (enabled) when the CMS component is null', () => {
    expect(mapSeoPlugin(null)).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('resolves DEFAULT_SEO_PLUGIN when the CMS component is absent (undefined)', () => {
    expect(mapSeoPlugin(undefined)).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('resolves DEFAULT_SEO_PLUGIN when the CMS component is an empty object', () => {
    expect(mapSeoPlugin({})).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('lets a present enabled/titleTemplate/metaDescription win over the default', () => {
    expect(
      mapSeoPlugin({ enabled: false, titleTemplate: '%s | {site}', metaDescription: 'Default desc' }),
    ).toEqual({
      enabled: false,
      titleTemplate: '%s | {site}',
      metaDescription: 'Default desc',
      ogImage: undefined,
      social: { sameAs: [] },
    });
  });

  it('resolves ogImage to an absolute URL; missing media stays undefined', () => {
    expect(mapSeoPlugin({ ogImage: { url: '/uploads/og.png' } }).ogImage).toBe(
      'http://localhost:1337/uploads/og.png',
    );
    expect(mapSeoPlugin({}).ogImage).toBeUndefined();
  });

  it('resolves social.twitterHandle through and filters sameAs to non-empty URLs only', () => {
    const r = mapSeoPlugin({
      social: {
        twitterHandle: '@acme',
        twitterUrl: 'https://twitter.com/acme',
        linkedinUrl: '',
        instagramUrl: undefined,
        facebookUrl: 'https://facebook.com/acme',
      },
    });
    expect(r.social).toEqual({
      twitterHandle: '@acme',
      sameAs: ['https://twitter.com/acme', 'https://facebook.com/acme'],
    });
  });

  it('resolves an empty/absent social component to { sameAs: [] }', () => {
    expect(mapSeoPlugin({}).social).toEqual({ sameAs: [] });
    expect(mapSeoPlugin({ social: null }).social).toEqual({ sameAs: [] });
  });
});
