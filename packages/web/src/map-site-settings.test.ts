import { describe, expect, it } from 'vitest';
import { mapSiteSettings } from './map-site-settings';
import type { BuildTimeConfig } from './config/types';

const buildTime: BuildTimeConfig = {
  routes: { home: 'home' },
  theme: { name: 'default', fonts: { body: 'Inter' } },
};

describe('mapSiteSettings', () => {
  it('maps a null CMS to engine-default theme + empty identity/SEO + build-time anchors', () => {
    const r = mapSiteSettings(buildTime, null);
    // identity/SEO empty — no inheritance, no fallback (AC2/AC3)
    expect(r.brand.name).toBe('');
    expect(r.brand.logo).toBeUndefined();
    expect(r.brand.favicon).toBe('');
    expect(r.site.url).toBe('');
    expect(r.site.locale).toBe('');
    expect(r.seo.titleTemplate).toBe('');
    expect(r.seo.defaultTitle).toBe('');
    expect(r.seo.defaultDescription).toBe('');
    expect(r.seo.defaultOgImage).toBeUndefined();
    // theme over DEFAULT_THEME (AC4)
    expect(r.theme.colors.primary).toBe('#119350');
    expect(r.theme.radius.md).toBe('14px');
    // anchors from buildTime (AC8)
    expect(r.routes.home).toBe('home');
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({ body: 'Inter' });
  });

  it('maps an empty {} CMS identically to null', () => {
    expect(mapSiteSettings(buildTime, {})).toEqual(mapSiteSettings(buildTime, null));
  });

  it('maps a full CMS payload verbatim and lets theme overrides win per key', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      url: 'https://acme.test',
      locale: 'en',
      seo: { titleTemplate: '%s | Acme', defaultTitle: 'Acme', defaultDescription: 'An Acme site.' },
      themeColors: { primary: '#ff5500' },
      themeRadius: { md: '2px' },
    });
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe('https://acme.test');
    expect(r.site.locale).toBe('en');
    expect(r.seo.titleTemplate).toBe('%s | Acme');
    expect(r.seo.defaultDescription).toBe('An Acme site.');
    expect(r.theme.colors.primary).toBe('#ff5500'); // override wins
    expect(r.theme.colors.accent).toBe('#D9A12C'); // sibling keeps DEFAULT_THEME
    expect(r.theme.radius.md).toBe('2px');
    expect(r.theme.radius.lg).toBe('20px'); // sibling keeps DEFAULT_THEME
  });

  it('keeps an empty CMS field empty — never backfills (the core anti-drift case)', () => {
    const r = mapSiteSettings(buildTime, { name: 'Acme' }); // url/locale/seo absent
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe('');         // NOT backfilled
    expect(r.seo.defaultTitle).toBe(''); // NOT backfilled from name (unlike old resolveConfig)
  });

  it('resolves media URLs absolute against CMS_URL; missing media → undefined', () => {
    const r = mapSiteSettings(buildTime, {
      logo: { url: '/uploads/logo.png' },
      favicon: { url: 'https://cdn.test/fav.ico' },
      seo: { defaultOgImage: { url: '/uploads/og.png' } },
    });
    expect(r.brand.logo).toBe('http://localhost:1337/uploads/logo.png');
    expect(r.brand.favicon).toBe('https://cdn.test/fav.ico'); // already absolute → kept
    expect(r.seo.defaultOgImage).toBe('http://localhost:1337/uploads/og.png');
    const empty = mapSiteSettings(buildTime, {});
    expect(empty.brand.logo).toBeUndefined();
    expect(empty.seo.defaultOgImage).toBeUndefined();
  });

  it('always takes theme.name / theme.fonts / routes from buildTime, never the CMS payload', () => {
    const r = mapSiteSettings(buildTime, { themeColors: { primary: '#000000' } } as any);
    expect(r.theme.name).toBe(buildTime.theme.name);
    expect(r.theme.fonts).toEqual(buildTime.theme.fonts);
    expect(r.routes).toEqual(buildTime.routes);
  });
});
