import { describe, expect, it } from 'vitest';
import { mapSiteSettings } from './map-site-settings';
import type { BuildTimeConfig } from './config/types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';
import { DEFAULT_EXAMPLE_PLUGIN } from './plugins/example/default-example-plugin';
import { DEFAULT_SEO_PLUGIN } from './plugins/seo/default-seo-plugin';

const buildTime: BuildTimeConfig = {
  routes: { home: 'home' },
  theme: { name: 'default', fonts: { body: 'Inter' } },
};

describe('mapSiteSettings', () => {
  it('maps a null CMS to engine-default theme + empty identity + build-time anchors', () => {
    const r = mapSiteSettings(buildTime, null);
    // identity empty — no inheritance, no fallback (AC2/AC3)
    expect(r.brand.name).toBe('');
    expect(r.brand.logo).toBeUndefined();
    expect(r.brand.favicon).toBe('');
    expect(r.site.url).toBe('');
    expect(r.site.locale).toBe('');
    // theme over DEFAULT_THEME (AC4)
    expect(r.theme.colors.primary).toBe('#119350');
    expect(r.theme.radius.md).toBe('14px');
    // anchors from buildTime (AC8)
    expect(r.routes.home).toBe('home');
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({ body: 'Inter' });
    // pageDefaults: empty slots when the CMS is empty (Spec §4)
    expect(r.pageDefaults).toEqual({ header: [], footer: [] });
  });

  it('maps an empty {} CMS identically to null', () => {
    expect(mapSiteSettings(buildTime, {})).toEqual(mapSiteSettings(buildTime, null));
  });

  it('maps an empty basicSettings identically to an absent one', () => {
    expect(mapSiteSettings(buildTime, { basicSettings: {} })).toEqual(mapSiteSettings(buildTime, null));
  });

  it('attaches the synthetic site-setting urn regardless of the CMS payload (canonical-urn Spec §3)', () => {
    expect(mapSiteSettings(buildTime, null).urn).toBe('urn:site-setting:default');
    expect(mapSiteSettings(buildTime, { basicSettings: { name: 'Acme' } }).urn).toBe('urn:site-setting:default');
  });

  it('resolves plugins.example to DEFAULT_EXAMPLE_PLUGIN (disabled) when the CMS is null (base-plugin Spec §3)', () => {
    const r = mapSiteSettings(buildTime, null);
    expect(r.plugins.example).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('resolves plugins.example from a present examplePlugin component', () => {
    const r = mapSiteSettings(buildTime, { examplePlugin: { enabled: true, message: 'On' } });
    expect(r.plugins.example).toEqual({ enabled: true, message: 'On' });
  });

  it('resolves plugins.seo to DEFAULT_SEO_PLUGIN (enabled) when the CMS is null (plugin-seo Spec §2)', () => {
    const r = mapSiteSettings(buildTime, null);
    expect(r.plugins.seo).toEqual(DEFAULT_SEO_PLUGIN);
  });

  it('resolves plugins.seo from a present seo component', () => {
    const r = mapSiteSettings(buildTime, { seo: { enabled: false, metaDescription: 'Custom' } });
    expect(r.plugins.seo.enabled).toBe(false);
    expect(r.plugins.seo.metaDescription).toBe('Custom');
  });

  it('maps a full CMS payload verbatim and lets theme overrides win per key (Ajustes básicos + Tema avançado)', () => {
    const r = mapSiteSettings(buildTime, {
      basicSettings: {
        name: 'Acme',
        url: 'https://acme.test',
        locale: 'en',
        primary: '#ff5500',
        themeAdvanced: { border: '#000000' },
      },
    });
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe('https://acme.test');
    expect(r.site.locale).toBe('en');
    expect(r.theme.colors.primary).toBe('#ff5500'); // basic override wins
    expect(r.theme.colors.accent).toBe('#D9A12C'); // sibling keeps DEFAULT_THEME
    expect(r.theme.colors.border).toBe('#000000'); // advanced override wins
  });

  it('maps the basic radius token to ThemeRadius.md and the advanced tokens to xs/sm/lg', () => {
    const r = mapSiteSettings(buildTime, {
      basicSettings: { radius: '2px', themeAdvanced: { radiusXs: '1px', radiusLg: '99px' } },
    });
    expect(r.theme.radius.md).toBe('2px');
    expect(r.theme.radius.xs).toBe('1px');
    expect(r.theme.radius.lg).toBe('99px');
    expect(r.theme.radius.sm).toBe('10px'); // sibling keeps DEFAULT_THEME
  });

  it('normalizes a trailing slash off site.url; a URL with no trailing slash is unchanged', () => {
    expect(mapSiteSettings(buildTime, { basicSettings: { url: 'https://acme.test/' } }).site.url).toBe(
      'https://acme.test',
    );
    expect(mapSiteSettings(buildTime, { basicSettings: { url: 'https://acme.test' } }).site.url).toBe(
      'https://acme.test',
    );
  });

  it('keeps an empty CMS field empty — never backfills (the core anti-drift case)', () => {
    const r = mapSiteSettings(buildTime, { basicSettings: { name: 'Acme' } }); // url/locale absent
    expect(r.brand.name).toBe('Acme');
    expect(r.site.url).toBe(''); // NOT backfilled
  });

  it('resolves media URLs absolute against CMS_URL; missing media → undefined', () => {
    const r = mapSiteSettings(buildTime, {
      basicSettings: {
        logo: { url: '/uploads/logo.png' },
        favicon: { url: 'https://cdn.test/fav.ico' },
      },
    });
    expect(r.brand.logo).toBe('http://localhost:1337/uploads/logo.png');
    expect(r.brand.favicon).toBe('https://cdn.test/fav.ico'); // already absolute → kept
    const empty = mapSiteSettings(buildTime, {});
    expect(empty.brand.logo).toBeUndefined();
  });

  it('always takes theme.name / theme.fonts / routes from buildTime, never the CMS payload', () => {
    const r = mapSiteSettings(buildTime, { basicSettings: { primary: '#000000' } } as any);
    expect(r.theme.name).toBe(buildTime.theme.name);
    expect(r.theme.fonts).toEqual(buildTime.theme.fonts);
    expect(r.routes).toEqual(buildTime.routes);
  });

  it('maps valid pageDefaults slots through and fails invalid slots to empty', () => {
    const nodes = [{ id: 'n', type: 'block', component: 'preset-organism.navbar', data: {} }];
    const ok = mapSiteSettings(buildTime, { pageDefaults: { header: nodes, footer: [] } } as any);
    expect(ok.pageDefaults.header).toEqual(nodes);
    const bad = mapSiteSettings(buildTime, { pageDefaults: { header: [{ id: 'c', type: 'column', children: [] }] } } as any);
    expect(bad.pageDefaults.header).toEqual([]);
  });

  it('maps an absent/unreachable CMS to empty pageDefaults', () => {
    expect(mapSiteSettings(buildTime, null).pageDefaults).toEqual({ header: [], footer: [] });
  });

  it('resolves layout to DEFAULT_LAYOUT for a null/empty CMS (fail-to-DEFAULT, not fail-to-empty)', () => {
    expect(mapSiteSettings(buildTime, null).layout).toEqual(DEFAULT_LAYOUT);
    expect(mapSiteSettings(buildTime, {}).layout).toEqual(DEFAULT_LAYOUT);
  });

  it('lets a CMS layout value win per key while siblings keep the engine default', () => {
    const r = mapSiteSettings(buildTime, { layout: { row: { width: 'full' }, column: { gap: 'compact' } } } as any);
    expect(r.layout.row).toEqual({ width: 'full', gap: 'normal', verticalAlign: 'top' });
    expect(r.layout.column).toEqual({ verticalAlign: 'top', gap: 'compact' });
    expect(r.layout.page).toEqual({});
  });

  it('keeps an unrecognized layout value from breaking the document', () => {
    const r = mapSiteSettings(buildTime, { layout: { row: { gap: 'huge' } } } as any);
    expect(r.layout.row.gap).toBe('normal');
  });
});
