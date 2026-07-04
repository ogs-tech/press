import { describe, expect, it } from 'vitest';
import { admitCustomBlocks, injectComponents } from './inject-components';
import pageSchema from '../content-types/page/schema.json';
import siteSettingSchema from '../content-types/site-setting/schema.json';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * Minimal Strapi double exposing only what admitCustomBlocks touches: the
 * content-types + components registries (`strapi.get`) and a no-op logger.
 */
const makeStrapi = (opts: { page?: any; siteSetting?: any; componentUids?: string[] }) => {
  const contentTypes = new Map<string, any>();
  if (opts.page) contentTypes.set(PAGE_UID, opts.page);
  if (opts.siteSetting) contentTypes.set(SITE_SETTING_UID, opts.siteSetting);
  const components = new Map<string, any>((opts.componentUids ?? []).map((uid) => [uid, { uid }]));
  return {
    get: (key: string) =>
      key === 'content-types' ? contentTypes : key === 'components' ? components : undefined,
    log: { warn() {}, info() {}, debug() {}, error() {} },
  } as any;
};

const pageWithBody = (components: string[]) => ({
  uid: PAGE_UID,
  attributes: { body: { type: 'dynamiczone', components } },
});

const siteSettingWithChrome = (header: string[] = ['chrome.navbar'], footer: string[] = ['chrome.footer']) => ({
  uid: SITE_SETTING_UID,
  attributes: {
    header: { type: 'dynamiczone', components: header },
    footer: { type: 'dynamiczone', components: footer },
  },
});

describe('admitCustomBlocks', () => {
  it('admits every custom.* component into the page body AND both chrome DZs', () => {
    const page = pageWithBody(['press.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['press.paragraph', 'custom.callout', 'custom.banner'],
    });

    admitCustomBlocks({ strapi });

    // The adopter contract is unchanged: only the custom CATEGORY is stable, now
    // flowing into all three engine DZs (Spec §1).
    expect(page.attributes.body.components).toEqual(['press.paragraph', 'custom.callout', 'custom.banner']);
    expect(siteSetting.attributes.header.components).toEqual(['chrome.navbar', 'custom.callout', 'custom.banner']);
    expect(siteSetting.attributes.footer.components).toEqual(['chrome.footer', 'custom.callout', 'custom.banner']);
  });

  it('is idempotent: an already-admitted custom.* block is not duplicated in any DZ', () => {
    const page = pageWithBody(['press.paragraph', 'custom.callout']);
    const siteSetting = siteSettingWithChrome(['chrome.navbar', 'custom.callout'], ['chrome.footer', 'custom.callout']);
    const strapi = makeStrapi({ page, siteSetting, componentUids: ['press.paragraph', 'custom.callout'] });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['press.paragraph', 'custom.callout']);
    expect(siteSetting.attributes.header.components).toEqual(['chrome.navbar', 'custom.callout']);
    expect(siteSetting.attributes.footer.components).toEqual(['chrome.footer', 'custom.callout']);
  });

  it('never pushes chrome.* into the page body (chrome is not a custom category)', () => {
    const page = pageWithBody(['press.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['press.paragraph', 'chrome.navbar', 'chrome.footer'],
    });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['press.paragraph']);
  });

  it('throws (aborts boot) when the page content-type is absent from the registry', () => {
    const strapi = makeStrapi({ siteSetting: siteSettingWithChrome(), componentUids: ['custom.callout'] });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.page.*absent/);
  });

  it('throws (aborts boot) when the site-setting content-type is absent from the registry', () => {
    const strapi = makeStrapi({ page: pageWithBody(['press.paragraph']), componentUids: ['custom.callout'] });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.site-setting.*absent/);
  });

  it('throws (aborts boot) when page.body is not a dynamic zone', () => {
    const strapi = makeStrapi({
      page: { uid: PAGE_UID, attributes: { body: { type: 'string' } } },
      siteSetting: siteSettingWithChrome(),
      componentUids: ['custom.callout'],
    });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/no 'body' dynamic zone/);
  });

  it('throws (aborts boot) when a chrome DZ is missing or malformed', () => {
    const strapi = makeStrapi({
      page: pageWithBody(['press.paragraph']),
      siteSetting: { uid: SITE_SETTING_UID, attributes: { header: { type: 'string' } } },
      componentUids: ['custom.callout'],
    });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/no 'header' dynamic zone/);
  });
});

describe('injectComponents', () => {
  const makeStrapi = () => {
    const components = new Map<string, any>();
    const strapi = {
      get: (key: string) => (key === 'components' ? components : undefined),
      log: { warn() {}, info() {}, debug() {}, error() {} },
    } as any;
    return { strapi, components };
  };

  it('registers every engine press.* component as a component model', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const expected = [
      'press.paragraph', 'press.heading', 'press.list', 'press.quote',
      'press.image', 'press.button', 'press.separator', 'press.spacer',
      'press.seo', 'press.theme-colors', 'press.theme-radius', 'press.nav-item',
    ];
    for (const uid of expected) {
      expect(components.get(uid)?.modelType).toBe('component');
      expect(components.get(uid)?.uid).toBe(uid);
    }
  });

  it('no longer injects the removed press.hero / press.rich-text blocks', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    expect(components.get('press.hero')).toBeUndefined();
    expect(components.get('press.rich-text')).toBeUndefined();
  });

  it('skips a component already present in the registry (idempotent injection)', () => {
    const { strapi, components } = makeStrapi();
    components.set('press.paragraph', { uid: 'press.paragraph', preexisting: true });
    injectComponents({ strapi });
    expect(components.get('press.paragraph')).toEqual({ uid: 'press.paragraph', preexisting: true });
    expect(components.get('press.seo')?.modelType).toBe('component'); // others still injected
  });

  it('injects press.nav-item but never admits it into the page Dynamic Zone', () => {
    // nav-item is a Site-Settings config component (like press.seo). Injecting it
    // registers the component, but it must NOT leak into the page block palette —
    // only custom.* is admitted into the page body Dynamic Zone.
    const components = new Map<string, any>();
    const page = pageWithBody(['press.paragraph']);
    const contentTypes = new Map<string, any>([
      [PAGE_UID, page],
      [SITE_SETTING_UID, siteSettingWithChrome()],
    ]);
    const strapi = {
      get: (key: string) =>
        key === 'components' ? components : key === 'content-types' ? contentTypes : undefined,
      log: { warn() {}, info() {}, debug() {}, error() {} },
    } as any;

    injectComponents({ strapi });
    components.set('custom.callout', { uid: 'custom.callout' }); // a real custom block
    admitCustomBlocks({ strapi });

    expect(components.get('press.nav-item')?.modelType).toBe('component'); // injected
    expect(page.attributes.body.components).toContain('custom.callout');   // custom admitted
    expect(page.attributes.body.components).not.toContain('press.nav-item'); // never admitted
  });

  it('injects section.hero and section.cta under category "section" with a derived globalId', () => {
    // Sections mirror the press.* injection mechanism but under a SEPARATE category
    // so the atomic press.* boundary stays intact (Spec §5.1).
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('section.hero')?.modelType).toBe('component');
    expect(components.get('section.hero')?.category).toBe('section');
    expect(components.get('section.hero')?.globalId).toBe('ComponentSectionHero');

    expect(components.get('section.cta')?.modelType).toBe('component');
    expect(components.get('section.cta')?.category).toBe('section');
    expect(components.get('section.cta')?.globalId).toBe('ComponentSectionCta');

    // Sections are NOT press.hero — the removed atom stays removed (Spec §3).
    expect(components.get('press.hero')).toBeUndefined();
  });

  it('injects chrome.navbar and chrome.footer under category "chrome" with a derived globalId', () => {
    // Chrome blocks mirror the section.* injection mechanism under their own
    // category: composite bars admitted only into the site-setting chrome DZs,
    // never the page body (Spec §1).
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('chrome.navbar')?.modelType).toBe('component');
    expect(components.get('chrome.navbar')?.category).toBe('chrome');
    expect(components.get('chrome.navbar')?.globalId).toBe('ComponentChromeNavbar');
    // Composite shape (Spec §1): nested nav items + optional CTA, no brand fields.
    expect(components.get('chrome.navbar')?.attributes).toMatchObject({
      items: { type: 'component', repeatable: true, component: 'press.nav-item' },
      cta: { type: 'component', repeatable: false, component: 'press.button' },
    });

    expect(components.get('chrome.footer')?.modelType).toBe('component');
    expect(components.get('chrome.footer')?.category).toBe('chrome');
    expect(components.get('chrome.footer')?.globalId).toBe('ComponentChromeFooter');
    expect(components.get('chrome.footer')?.attributes).toMatchObject({ text: { type: 'string' } });
  });
});

describe('page body dynamic zone (static section admission)', () => {
  it('lists section.hero and section.cta alongside the press.* atoms', () => {
    // Sections are engine-owned and deterministic, so they are admitted STATICALLY
    // in the page schema (not via the dynamic custom.* push) — Spec §5.1.
    const components = pageSchema.attributes.body.components as string[];
    expect(components).toContain('section.hero');
    expect(components).toContain('section.cta');
    // Additive: the press.* atoms remain admitted, unchanged (Spec §2).
    expect(components).toContain('press.paragraph');
    expect(components).toContain('press.image');
  });
});

describe('site-setting chrome dynamic zones (static admission)', () => {
  it('admits chrome.* + press.* atoms + section.* into header and footer, statically', () => {
    // Chrome DZs admit everything except custom.* (which arrives dynamically) —
    // listed statically like section.* in the page body (Spec §1).
    for (const zone of ['header', 'footer'] as const) {
      const components = (siteSettingSchema.attributes as any)[zone].components as string[];
      expect(components).toContain('chrome.navbar');
      expect(components).toContain('chrome.footer');
      expect(components).toContain('press.paragraph');
      expect(components).toContain('press.button');
      expect(components).toContain('section.hero');
      expect(components).toContain('section.cta');
    }
  });

  it('no longer carries the removed headerNav attribute (BREAKING, Spec §Migration)', () => {
    expect((siteSettingSchema.attributes as any).headerNav).toBeUndefined();
  });

  it('keeps chrome.* out of the page body Dynamic Zone', () => {
    expect(pageSchema.attributes.body.components).not.toContain('chrome.navbar');
    expect(pageSchema.attributes.body.components).not.toContain('chrome.footer');
  });
});
