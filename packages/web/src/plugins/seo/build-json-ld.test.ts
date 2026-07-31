import { describe, expect, it } from 'vitest';
import { buildJsonLd } from './build-json-ld';
import type { ResolvedPressConfig } from '../../config/types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { DEFAULT_EXAMPLE_PLUGIN } from '../example/default-example-plugin';
import { DEFAULT_SEO_PLUGIN } from './default-seo-plugin';

const baseResolved: ResolvedPressConfig = {
  urn: 'urn:site-setting:default',
  brand: { name: 'Acme', logo: 'https://cdn.test/logo.png', favicon: '/favicon.ico' },
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
  plugins: { example: DEFAULT_EXAMPLE_PLUGIN, seo: DEFAULT_SEO_PLUGIN },
};

describe('buildJsonLd', () => {
  it('returns [] when the plugin is disabled', () => {
    const resolved = { ...baseResolved, plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, enabled: false } } };
    expect(buildJsonLd(resolved, { title: 'About' }, '/about')).toEqual([]);
  });

  it('builds an Organization node from brand/site identity', () => {
    const [organization] = buildJsonLd(baseResolved, null);
    expect(organization).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Acme',
      logo: 'https://cdn.test/logo.png',
      url: 'https://acme.test',
    });
    expect(organization.sameAs).toBeUndefined();
  });

  it('includes sameAs only when social links are present', () => {
    const resolved = {
      ...baseResolved,
      plugins: { ...baseResolved.plugins, seo: { ...DEFAULT_SEO_PLUGIN, social: { sameAs: ['https://twitter.com/acme'] } } },
    };
    const [organization] = buildJsonLd(resolved, null);
    expect(organization.sameAs).toEqual(['https://twitter.com/acme']);
  });

  it('builds a WebPage node with the page title/url/description and an isPartOf WebSite', () => {
    const [, webPage] = buildJsonLd(baseResolved, { title: 'About us', seo: { metaDescription: 'The about page' } }, '/about');
    expect(webPage).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'About us',
      url: 'https://acme.test/about',
      description: 'The about page',
      isPartOf: { '@type': 'WebSite', name: 'Acme', url: 'https://acme.test' },
    });
  });

  it('falls back to page.title then brand.name for the WebPage name, and omits url when path is absent', () => {
    const [, webPageNoOverride] = buildJsonLd(baseResolved, { title: 'About us' }, '/about');
    expect(webPageNoOverride.name).toBe('About us');
    const [, webPageNoPage] = buildJsonLd(baseResolved, null);
    expect(webPageNoPage.name).toBe('Acme');
    expect(webPageNoPage.url).toBeUndefined();
  });
});
