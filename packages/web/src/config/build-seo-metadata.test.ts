import { describe, expect, it } from 'vitest';
import { buildSeoMetadata } from './build-seo-metadata';
import type { BuildTimeConfig, ResolvedPressConfig } from './types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { DEFAULT_EXAMPLE_PLUGIN } from '../plugins/example/default-example-plugin';
import { DEFAULT_SEO_PLUGIN } from '../plugins/seo/default-seo-plugin';
import { DEFAULT_LEGAL_PAGES } from '../plugins/legal/default-legal-pages';
import { DEFAULT_COOKIE_CONSENT } from '../plugins/legal/default-cookie-consent';
import { mapSiteSettings } from '../map-site-settings';
import { buildJsonLd } from '../plugins/seo/build-json-ld';

const baseResolved: ResolvedPressConfig = {
  urn: 'urn:site-setting:default',
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  routes: { home: 'home' },
  theme: {
    name: 'default',
    colors: {
      primary: '#119350', accent: '#D9A12C', secondary: '#3D5CC2', ink: '#142036',
      surface: '#FAF8F3', muted: '#7A7E89', danger: '#C0392B', onPrimary: '#FFFFFF',
      border: 'rgba(20,32,54,0.12)',
    },
    fonts: {},
    radius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
  },
  pageDefaults: { header: [], footer: [] },
  layout: DEFAULT_LAYOUT,
  plugins: {
    example: DEFAULT_EXAMPLE_PLUGIN,
    seo: DEFAULT_SEO_PLUGIN,
    legal: { pages: { privacyPolicy: DEFAULT_LEGAL_PAGES }, consent: DEFAULT_COOKIE_CONSENT },
  },
};

const disabled: ResolvedPressConfig = {
  ...baseResolved,
  plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, enabled: false } },
};

describe('buildSeoMetadata — plugin disabled', () => {
  it('uses the page title when there is a page', () => {
    const m = buildSeoMetadata(disabled, { title: 'E2E Home' });
    expect(m.title).toBe('E2E Home');
  });

  it('falls back to the site name when there is no page (layout base)', () => {
    const m = buildSeoMetadata(disabled, null);
    expect(m.title).toBe('Acme');
  });

  it('derives the favicon icon from brand.favicon', () => {
    const m = buildSeoMetadata(disabled, null);
    expect(m.icons).toEqual({ icon: '/favicon.ico' });
  });

  it('omits the favicon when brand.favicon is empty', () => {
    const noFavicon = { ...disabled, brand: { ...disabled.brand, favicon: '' } };
    const m = buildSeoMetadata(noFavicon, null);
    expect(m.icons).toBeUndefined();
  });

  it('emits no SEO/social metadata at all — exactly the pre-plugin shape', () => {
    const m = buildSeoMetadata(disabled, { title: 'E2E Home', seo: { metaDescription: 'ignored', noindex: true } });
    expect(m.description).toBeUndefined();
    expect(m.openGraph).toBeUndefined();
    expect(m.twitter).toBeUndefined();
    expect(m.alternates).toBeUndefined();
    expect(m.robots).toBeUndefined();
    expect(m.metadataBase).toBeUndefined();
  });
});

describe('buildSeoMetadata — plugin enabled, layout fallback (page: null)', () => {
  it('returns a title.template built from titleTemplate with {site} substituted, and a default', () => {
    const m = buildSeoMetadata(baseResolved, null);
    expect(m.title).toEqual({ template: '%s · Acme', default: 'Acme' });
  });

  it('sets metadataBase from site.url', () => {
    const m = buildSeoMetadata(baseResolved, null);
    expect(m.metadataBase).toEqual(new URL('https://acme.test'));
  });

  it('never sets canonical/alternates or openGraph.url — no page context', () => {
    const m = buildSeoMetadata(baseResolved, null);
    expect(m.alternates).toBeUndefined();
    expect(m.openGraph?.url).toBeUndefined();
  });

  it('never throws on a malformed Site URL, and omits metadataBase', () => {
    const bad = { ...baseResolved, site: { ...baseResolved.site, url: 'not-a-url' } };
    expect(() => buildSeoMetadata(bad, null)).not.toThrow();
    expect(buildSeoMetadata(bad, null).metadataBase).toBeUndefined();
  });

  it('omits metadataBase/canonical when site.url is empty', () => {
    const empty = { ...baseResolved, site: { ...baseResolved.site, url: '' } };
    const m = buildSeoMetadata(empty, { title: 'About' }, '/about');
    expect(m.metadataBase).toBeUndefined();
    expect(m.alternates).toBeUndefined();
  });
});

describe('buildSeoMetadata — plugin enabled, with a page (description/canonical/robots)', () => {
  const page = { title: 'About us', seo: { metaDescription: 'The about page' } };

  it('uses the page title as a plain string (Next applies the ancestor template)', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.title).toBe('About us');
  });

  it('lets page.seo.metaTitle override page.title', () => {
    const m = buildSeoMetadata(baseResolved, { ...page, seo: { ...page.seo, metaTitle: 'Override title' } }, '/about');
    expect(m.title).toBe('Override title');
  });

  it('uses page.seo.metaDescription, falling back to the site default', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.description).toBe('The about page');
    const withSiteDefault: ResolvedPressConfig = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, metaDescription: 'Site default desc' } },
    };
    const noOverride = buildSeoMetadata(withSiteDefault, { title: 'About us' }, '/about');
    expect(noOverride.description).toBe('Site default desc');
  });

  it('builds a self-referencing canonical from site.url + path, and a single-locale hreflang stub', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.alternates).toEqual({
      canonical: 'https://acme.test/about',
      languages: { en: 'https://acme.test/about' },
    });
  });

  it('omits alternates.languages when site.locale is empty', () => {
    const noLocale = { ...baseResolved, site: { ...baseResolved.site, locale: '' } };
    const m = buildSeoMetadata(noLocale, page, '/about');
    expect(m.alternates).toEqual({ canonical: 'https://acme.test/about' });
  });

  it('sets robots.index=false only when page.seo.noindex is true; omits the tag otherwise', () => {
    const noindexed = buildSeoMetadata(baseResolved, { ...page, seo: { ...page.seo, noindex: true } }, '/about');
    expect(noindexed.robots).toEqual({ index: false });
    const indexed = buildSeoMetadata(baseResolved, page, '/about');
    expect(indexed.robots).toBeUndefined();
  });
});

describe('buildSeoMetadata — plugin enabled, with a page (openGraph/twitter)', () => {
  const page = { title: 'About us', seo: { metaDescription: 'The about page' } };

  it('builds openGraph with title/description/url/siteName, type "website", and an image when one resolves', () => {
    const withImage: ResolvedPressConfig = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, ogImage: 'https://acme.test/og-default.png' } },
    };
    const m = buildSeoMetadata(withImage, page, '/about');
    expect(m.openGraph).toEqual({
      title: 'About us',
      description: 'The about page',
      url: 'https://acme.test/about',
      siteName: 'Acme',
      type: 'website',
      images: [{ url: 'https://acme.test/og-default.png' }],
    });
  });

  it('OG image fallback chain: page override wins over the site default', () => {
    const withSiteImage: ResolvedPressConfig = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, ogImage: 'https://acme.test/site-og.png' } },
    };
    const m = buildSeoMetadata(
      withSiteImage,
      { ...page, seo: { ...page.seo, ogImage: 'https://acme.test/page-og.png' } },
      '/about',
    );
    expect(m.openGraph?.images).toEqual([{ url: 'https://acme.test/page-og.png' }]);
  });

  it('omits openGraph.images when no OG image resolves anywhere', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.openGraph?.images).toBeUndefined();
  });

  it('builds a twitter summary_large_image card with the same title/description/image, plus site when a handle is set', () => {
    const withHandle: ResolvedPressConfig = {
      ...baseResolved,
      plugins: {
        ...baseResolved.plugins,
        seo: { ...DEFAULT_SEO_PLUGIN, ogImage: 'https://acme.test/og.png', social: { sameAs: [], twitterHandle: '@acme' } },
      },
    };
    const m = buildSeoMetadata(withHandle, page, '/about');
    expect(m.twitter).toEqual({
      card: 'summary_large_image',
      site: '@acme',
      title: 'About us',
      description: 'The about page',
      images: ['https://acme.test/og.png'],
    });
  });

  it('omits twitter.site when no handle is configured', () => {
    const m = buildSeoMetadata(baseResolved, page, '/about');
    expect(m.twitter?.site).toBeUndefined();
  });
});

describe('buildSeoMetadata + buildJsonLd — integration through mapSiteSettings (mapper output as builder input)', () => {
  // Nothing else exercises the FULL pipeline (raw CMS shape → mapSiteSettings →
  // ResolvedPressConfig → buildSeoMetadata/buildJsonLd) in one pass — every
  // other test hand-builds a ResolvedPressConfig fixture. A regression in
  // mapSeoPlugin (e.g. social.sameAs resolving to undefined instead of []) would
  // otherwise crash buildJsonLd's `sameAs.length` check at render time with zero
  // coverage catching it.
  const buildTimeConfig: BuildTimeConfig = {
    routes: { home: 'home' },
    theme: { name: 'default', fonts: {} },
  };

  const resolved = mapSiteSettings(buildTimeConfig, {
    basicSettings: { name: 'Acme', url: 'https://acme.test', locale: 'en' },
    seo: {
      enabled: true,
      titleTemplate: '%s · {site}',
      metaDescription: 'Acme site default description',
      social: { twitterHandle: '@acme', twitterUrl: 'https://twitter.com/acme' },
    },
  });

  const page = { title: 'About', seo: { metaDescription: 'About page description' } };

  it('resolves title/canonical/openGraph together from a realistic mapped payload', () => {
    const m = buildSeoMetadata(resolved, page, '/about');
    expect(m.title).toBe('About');
    expect(m.alternates).toEqual({
      canonical: 'https://acme.test/about',
      languages: { en: 'https://acme.test/about' },
    });
    expect(m.openGraph).toEqual({
      title: 'About',
      description: 'About page description',
      url: 'https://acme.test/about',
      siteName: 'Acme',
      type: 'website',
    });
  });

  it('resolves JSON-LD Organization.sameAs from the same mapped payload without throwing', () => {
    const nodes = buildJsonLd(resolved, page, '/about');
    const organization = nodes.find((n) => n['@type'] === 'Organization') as Record<string, unknown>;
    expect(organization.sameAs).toEqual(['https://twitter.com/acme']);
  });
});
