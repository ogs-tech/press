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

const siteSettingWithChrome = (
  header: string[] = ['preset-organism.navbar'],
  footer: string[] = ['preset-organism.footer'],
) => ({
  uid: SITE_SETTING_UID,
  attributes: {
    header: { type: 'dynamiczone', components: header },
    footer: { type: 'dynamiczone', components: footer },
  },
});

describe('admitCustomBlocks', () => {
  it('admits every custom block into the page body AND both chrome DZs (universal placement)', () => {
    const page = pageWithBody(['preset-atom.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['preset-atom.paragraph', 'custom-organism.callout', 'custom-atom.badge'],
    });

    admitCustomBlocks({ strapi });

    // The adopter contract: the `custom*` category is stable and flows into ALL
    // three engine DZs. Placement is not a category concern on the custom side —
    // the editor decides where each block goes (unified-components).
    expect(page.attributes.body.components).toEqual([
      'preset-atom.paragraph', 'custom-organism.callout', 'custom-atom.badge',
    ]);
    expect(siteSetting.attributes.header.components).toEqual([
      'preset-organism.navbar', 'custom-organism.callout', 'custom-atom.badge',
    ]);
    expect(siteSetting.attributes.footer.components).toEqual([
      'preset-organism.footer', 'custom-organism.callout', 'custom-atom.badge',
    ]);
  });

  it('is idempotent: an already-admitted custom block is not duplicated in any DZ', () => {
    const page = pageWithBody(['preset-atom.paragraph', 'custom-organism.callout']);
    const siteSetting = siteSettingWithChrome(
      ['preset-organism.navbar', 'custom-organism.callout'],
      ['preset-organism.footer', 'custom-organism.callout'],
    );
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['preset-atom.paragraph', 'custom-organism.callout'],
    });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['preset-atom.paragraph', 'custom-organism.callout']);
    expect(siteSetting.attributes.header.components).toEqual(['preset-organism.navbar', 'custom-organism.callout']);
    expect(siteSetting.attributes.footer.components).toEqual(['preset-organism.footer', 'custom-organism.callout']);
  });

  it('never admits a preset (non-custom) component — only the engine schema.json places those', () => {
    const page = pageWithBody(['preset-atom.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['preset-atom.paragraph', 'preset-organism.navbar', 'preset-organism.hero'],
    });

    admitCustomBlocks({ strapi });

    // preset-* blocks are curated statically per content-type; admitCustomBlocks
    // touches only `custom*` categories, so nothing changes here.
    expect(page.attributes.body.components).toEqual(['preset-atom.paragraph']);
    expect(siteSetting.attributes.header.components).toEqual(['preset-organism.navbar']);
    expect(siteSetting.attributes.footer.components).toEqual(['preset-organism.footer']);
  });

  it('admits every custom LAYER (atom/molecule/organism) into every zone alike', () => {
    const page = pageWithBody(['preset-atom.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({
      page,
      siteSetting,
      componentUids: ['custom-atom.badge', 'custom-molecule.field', 'custom-organism.pricing'],
    });

    admitCustomBlocks({ strapi });

    // The atomic LAYER is organization only (picker grouping + type names); it
    // does NOT restrict placement — every custom-* lands in all three DZs.
    for (const zone of [
      page.attributes.body.components,
      siteSetting.attributes.header.components,
      siteSetting.attributes.footer.components,
    ]) {
      expect(zone).toContain('custom-atom.badge');
      expect(zone).toContain('custom-molecule.field');
      expect(zone).toContain('custom-organism.pricing');
    }
  });

  it('still admits a legacy bare custom.* block (forgiving migration path)', () => {
    const page = pageWithBody(['preset-atom.paragraph']);
    const siteSetting = siteSettingWithChrome();
    const strapi = makeStrapi({ page, siteSetting, componentUids: ['custom.legacy'] });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toContain('custom.legacy');
    expect(siteSetting.attributes.header.components).toContain('custom.legacy');
    expect(siteSetting.attributes.footer.components).toContain('custom.legacy');
  });

  it('throws (aborts boot) when the page content-type is absent from the registry', () => {
    const strapi = makeStrapi({ siteSetting: siteSettingWithChrome(), componentUids: ['custom-organism.callout'] });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.page.*absent/);
  });

  it('throws (aborts boot) when the site-setting content-type is absent from the registry', () => {
    const strapi = makeStrapi({ page: pageWithBody(['preset-atom.paragraph']), componentUids: ['custom-organism.callout'] });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.site-setting.*absent/);
  });

  it('throws (aborts boot) when page.body is not a dynamic zone', () => {
    const strapi = makeStrapi({
      page: { uid: PAGE_UID, attributes: { body: { type: 'string' } } },
      siteSetting: siteSettingWithChrome(),
      componentUids: ['custom-organism.callout'],
    });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/no 'body' dynamic zone/);
  });

  it('throws (aborts boot) when a chrome DZ is missing or malformed', () => {
    const strapi = makeStrapi({
      page: pageWithBody(['preset-atom.paragraph']),
      siteSetting: { uid: SITE_SETTING_UID, attributes: { header: { type: 'string' } } },
      componentUids: ['custom-organism.callout'],
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

  it('registers every engine preset-* component as a component model', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const expected = [
      'preset-atom.paragraph', 'preset-atom.heading', 'preset-atom.list', 'preset-atom.quote',
      'preset-atom.image', 'preset-atom.button', 'preset-atom.separator', 'preset-atom.spacer',
      'preset-molecule.nav-item', 'preset-molecule.column',
      'preset-organism.hero', 'preset-organism.cta', 'preset-organism.columns',
      'preset-organism.navbar', 'preset-organism.footer',
      'preset-config.seo', 'preset-config.theme-colors', 'preset-config.theme-radius',
      'preset-config.cookie-category', 'preset-config.cookie-consent',
    ];
    for (const uid of expected) {
      expect(components.get(uid)?.modelType).toBe('component');
      expect(components.get(uid)?.uid).toBe(uid);
    }
  });

  it('no longer registers any legacy press.* / section.* / chrome.* uid (rename is complete)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    for (const legacy of ['press.paragraph', 'press.heading', 'press.nav-item', 'press.seo', 'section.hero', 'chrome.navbar']) {
      expect(components.get(legacy)).toBeUndefined();
    }
  });

  it('skips a component already present in the registry (idempotent injection)', () => {
    const { strapi, components } = makeStrapi();
    components.set('preset-atom.paragraph', { uid: 'preset-atom.paragraph', preexisting: true });
    injectComponents({ strapi });
    expect(components.get('preset-atom.paragraph')).toEqual({ uid: 'preset-atom.paragraph', preexisting: true });
    expect(components.get('preset-config.seo')?.modelType).toBe('component'); // others still injected
  });

  it('injects preset-molecule.nav-item but never admits it into the page Dynamic Zone', () => {
    // nav-item is a molecule nested inside the navbar. Injecting it registers the
    // component, but it must NOT leak into the page block palette — only custom-*
    // is admitted into the page body Dynamic Zone.
    const components = new Map<string, any>();
    const page = pageWithBody(['preset-atom.paragraph']);
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
    components.set('custom-organism.callout', { uid: 'custom-organism.callout' }); // a real custom block
    admitCustomBlocks({ strapi });

    expect(components.get('preset-molecule.nav-item')?.modelType).toBe('component'); // injected
    expect(page.attributes.body.components).toContain('custom-organism.callout');    // custom admitted
    expect(page.attributes.body.components).not.toContain('preset-molecule.nav-item'); // never admitted
  });

  it('injects the organism sections (hero/cta) under category "preset-organism" with a derived globalId', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('preset-organism.hero')?.modelType).toBe('component');
    expect(components.get('preset-organism.hero')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.hero')?.globalId).toBe('ComponentPresetOrganismHero');

    expect(components.get('preset-organism.cta')?.modelType).toBe('component');
    expect(components.get('preset-organism.cta')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.cta')?.globalId).toBe('ComponentPresetOrganismCta');
  });

  it('injects preset-organism.columns with its nested preset-molecule.column (never a DZ member)', () => {
    // Same nesting contract as navbar/nav-item: the organism is a DZ block, the
    // molecule exists only inside it. `columns` nests the repeatable molecule;
    // the molecule reuses preset-atom.button (the navbar.cta pattern).
    const components = new Map<string, any>();
    const page = pageWithBody(['preset-atom.paragraph']);
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
    admitCustomBlocks({ strapi });

    expect(components.get('preset-organism.columns')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.columns')?.globalId).toBe('ComponentPresetOrganismColumns');
    expect(components.get('preset-organism.columns')?.attributes).toMatchObject({
      ratio: { type: 'enumeration', enum: ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'], default: '50-50' },
      gap: { type: 'enumeration', enum: ['compact', 'normal', 'spacious'], default: 'normal' },
      verticalAlign: { type: 'enumeration', enum: ['top', 'center', 'bottom'], default: 'top' },
      columns: { type: 'component', repeatable: true, component: 'preset-molecule.column' },
    });
    expect(components.get('preset-molecule.column')?.category).toBe('preset-molecule');
    expect(components.get('preset-molecule.column')?.attributes).toMatchObject({
      content: { type: 'blocks' },
      image: { type: 'media', multiple: false, allowedTypes: ['images'] },
      button: { type: 'component', repeatable: false, component: 'preset-atom.button' },
    });
    // Nested-only: the molecule never leaks into any Dynamic Zone.
    expect(page.attributes.body.components).not.toContain('preset-molecule.column');
  });

  it('injects the organism chrome (navbar/footer) under category "preset-organism" with a derived globalId', () => {
    // navbar/footer are organisms too (unified from the old chrome.* palette); the
    // placement split lives in schema.json, not the category.
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('preset-organism.navbar')?.modelType).toBe('component');
    expect(components.get('preset-organism.navbar')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.navbar')?.globalId).toBe('ComponentPresetOrganismNavbar');
    // Composite shape: nested nav items + optional CTA, no brand fields.
    expect(components.get('preset-organism.navbar')?.attributes).toMatchObject({
      items: { type: 'component', repeatable: true, component: 'preset-molecule.nav-item' },
      cta: { type: 'component', repeatable: false, component: 'preset-atom.button' },
    });

    expect(components.get('preset-organism.footer')?.modelType).toBe('component');
    expect(components.get('preset-organism.footer')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.footer')?.globalId).toBe('ComponentPresetOrganismFooter');
    expect(components.get('preset-organism.footer')?.attributes).toMatchObject({ text: { type: 'string' } });
  });
});

describe('page body dynamic zone (static organism admission)', () => {
  it('lists preset-organism.hero and preset-organism.cta alongside the preset-atom.* atoms', () => {
    // Body organisms are engine-owned and deterministic, so they are admitted
    // STATICALLY in the page schema (not via the dynamic custom-* push).
    const components = pageSchema.attributes.body.components as string[];
    expect(components).toContain('preset-organism.hero');
    expect(components).toContain('preset-organism.cta');
    expect(components).toContain('preset-organism.columns');
    // The atoms remain admitted, unchanged.
    expect(components).toContain('preset-atom.paragraph');
    expect(components).toContain('preset-atom.image');
    // Chrome organisms are NOT page-body blocks (placement: header/footer only).
    expect(components).not.toContain('preset-organism.navbar');
    expect(components).not.toContain('preset-organism.footer');
  });
});

describe('site-setting cookie-consent attribute (cookie-consent Spec §1)', () => {
  it('attaches preset-config.cookie-consent as a config component, never a DZ member', () => {
    expect((siteSettingSchema.attributes as any).cookieConsent).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.cookie-consent',
    });
    // Config components stay out of every Dynamic Zone (the preset-config rule).
    for (const zone of ['header', 'footer'] as const) {
      const components = (siteSettingSchema.attributes as any)[zone].components as string[];
      expect(components).not.toContain('preset-config.cookie-consent');
      expect(components).not.toContain('preset-config.cookie-category');
    }
    expect(pageSchema.attributes.body.components).not.toContain('preset-config.cookie-consent');
  });

  it('nests the three engine-fixed category components (closed key set, Spec §2)', () => {
    const { strapi, components } = (() => {
      const map = new Map<string, any>();
      return {
        strapi: {
          get: (key: string) => (key === 'components' ? map : undefined),
          log: { warn() {}, info() {}, debug() {}, error() {} },
        } as any,
        components: map,
      };
    })();
    injectComponents({ strapi });
    expect(components.get('preset-config.cookie-consent')?.attributes).toMatchObject({
      enabled: { type: 'boolean', default: true },
      necessary: { type: 'component', repeatable: false, component: 'preset-config.cookie-category' },
      analytics: { type: 'component', repeatable: false, component: 'preset-config.cookie-category' },
      marketing: { type: 'component', repeatable: false, component: 'preset-config.cookie-category' },
      privacyPage: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' },
    });
    expect(components.get('preset-config.cookie-category')?.attributes).toMatchObject({
      enabled: { type: 'boolean', default: true },
      label: { type: 'string' },
      description: { type: 'text' },
    });
  });
});

describe('site-setting chrome dynamic zones (static admission)', () => {
  it('admits preset-organism.navbar/footer + preset-atom.* atoms into header and footer, statically', () => {
    // Chrome DZs admit the chrome organisms and every atom (custom-* arrives
    // dynamically). Body organisms (hero/cta) are NOT chrome blocks.
    for (const zone of ['header', 'footer'] as const) {
      const components = (siteSettingSchema.attributes as any)[zone].components as string[];
      expect(components).toContain('preset-organism.navbar');
      expect(components).toContain('preset-organism.footer');
      expect(components).toContain('preset-atom.paragraph');
      expect(components).toContain('preset-atom.button');
      expect(components).not.toContain('preset-organism.hero');
      expect(components).not.toContain('preset-organism.cta');
      expect(components).not.toContain('preset-organism.columns');
    }
  });

  it('no longer carries the removed headerNav attribute (BREAKING, Spec §Migration)', () => {
    expect((siteSettingSchema.attributes as any).headerNav).toBeUndefined();
  });

  it('keeps the chrome organisms out of the page body Dynamic Zone', () => {
    expect(pageSchema.attributes.body.components).not.toContain('preset-organism.navbar');
    expect(pageSchema.attributes.body.components).not.toContain('preset-organism.footer');
  });
});
