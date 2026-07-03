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
    // chrome: empty zones when the CMS is empty (Spec §4)
    expect(r.chrome).toEqual({ header: [], footer: [] });
  });

  it('maps an empty {} CMS identically to null', () => {
    expect(mapSiteSettings(buildTime, {})).toEqual(mapSiteSettings(buildTime, null));
  });

  it('maps a full CMS payload verbatim and lets theme overrides win per key', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      url: 'https://acme.test',
      locale: 'en',
      seo: { titleTemplate: '%s | Acme', title: 'Acme', description: 'An Acme site.' },
      themeColors: { primary: '#ff5500' },
      themeRadius: { md: '2px' },
    });
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe('https://acme.test');
    expect(r.site.locale).toBe('en');
    expect(r.seo.titleTemplate).toBe('%s | Acme');
    expect(r.seo.defaultTitle).toBe('Acme'); // CMS `title` → internal `defaultTitle`
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
      seo: { image: { url: '/uploads/og.png' } },
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

describe('mapSiteSettings — chrome hydration (Spec §3)', () => {
  const navbar = (extra: Record<string, unknown> = {}) =>
    ({ __component: 'chrome.navbar', id: 1, ...extra });

  const headerWith = (items: unknown[]) =>
    mapSiteSettings(buildTime, { name: 'Acme', header: [navbar({ items })] });

  const linksOf = (r: ReturnType<typeof mapSiteSettings>) =>
    (r.chrome.header[0] as any).links;

  it('injects the resolved brand (name + logo) into chrome.navbar — never stored on the block', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      logo: { url: '/uploads/logo.png' },
      header: [navbar()],
    });
    expect((r.chrome.header[0] as any).brand).toEqual({
      name: 'Acme',
      logo: 'http://localhost:1337/uploads/logo.png',
    });
  });

  it('resolves an internal page item to /slug, external false', () => {
    const r = headerWith([{ label: 'About', page: { slug: 'about' }, newTab: false }]);
    expect(linksOf(r)).toEqual([{ label: 'About', href: '/about', external: false, newTab: false }]);
  });

  it('collapses the home slug to /', () => {
    const r = headerWith([{ label: 'Home', page: { slug: 'home' } }]); // buildTime.routes.home === 'home'
    expect(linksOf(r)[0].href).toBe('/');
  });

  it('resolves an external url with external:true and honors newTab', () => {
    const r = headerWith([{ label: 'Docs', url: 'https://docs.test', newTab: true }]);
    expect(linksOf(r)).toEqual([{ label: 'Docs', href: 'https://docs.test', external: true, newTab: true }]);
  });

  it('lets page win over url when both are set (precedence)', () => {
    const r = headerWith([{ label: 'Both', page: { slug: 'about' }, url: 'https://ignored.test' }]);
    expect(linksOf(r)[0]).toEqual({ label: 'Both', href: '/about', external: false, newTab: false });
  });

  it('drops an item with neither page nor url', () => {
    const r = headerWith([
      { label: 'Keep', url: '/keep' },
      { label: 'Drop' },
      { label: 'DropToo', page: null, url: '' },
    ]);
    expect(linksOf(r).map((l: any) => l.label)).toEqual(['Keep']);
  });

  it('hydrates a navbar with no items to empty links (the seeded default renders brand-only)', () => {
    const r = mapSiteSettings(buildTime, { name: 'Acme', header: [navbar()] });
    expect(linksOf(r)).toEqual([]);
  });

  it('keeps the navbar cta untouched (renderer consumes it as-is)', () => {
    const cta = { label: 'Sign up', href: '/signup', variant: 'primary' };
    const r = mapSiteSettings(buildTime, { header: [navbar({ cta })] });
    expect((r.chrome.header[0] as any).cta).toEqual(cta);
  });

  it('injects the brand into chrome.footer for the copyright fallback', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      footer: [{ __component: 'chrome.footer', id: 2, text: '' }],
    });
    expect((r.chrome.footer[0] as any).brand).toEqual({ name: 'Acme' });
  });

  it('passes non-chrome blocks through untouched (BlockRenderer stays dumb)', () => {
    const hero = { __component: 'section.hero', id: 3, title: 'Big' };
    const r = mapSiteSettings(buildTime, { header: [hero] });
    expect(r.chrome.header).toEqual([hero]);
  });

  it('hydrates the footer zone with the same rules as the header (a navbar works in either zone)', () => {
    const r = mapSiteSettings(buildTime, {
      name: 'Acme',
      footer: [navbar({ items: [{ label: 'About', page: { slug: 'about' } }] })],
    });
    expect((r.chrome.footer[0] as any).links).toEqual([
      { label: 'About', href: '/about', external: false, newTab: false },
    ]);
  });

  it('maps absent / empty zones and a null CMS to empty arrays', () => {
    expect(mapSiteSettings(buildTime, { header: [], footer: [] }).chrome).toEqual({ header: [], footer: [] });
    expect(mapSiteSettings(buildTime, {}).chrome).toEqual({ header: [], footer: [] });
    expect(mapSiteSettings(buildTime, null).chrome).toEqual({ header: [], footer: [] });
  });
});
