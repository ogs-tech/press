import { describe, expect, it } from 'vitest';
import { injectComponents } from './inject-components';
import pageSchema from '../content-types/page/schema.json';
import siteSettingSchema from '../content-types/site-setting/schema.json';

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
      'preset-molecule.link',
      'preset-organism.hero', 'preset-organism.cta',
      'preset-organism.navbar', 'preset-organism.footer',
      'preset-layout.container', 'preset-layout.row', 'preset-layout.column',
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

  it('injects preset-molecule.link under category "preset-molecule" with the shared link shape', () => {
    // link is the engine's one link concept, nested inside preset-atom.button,
    // preset-organism.hero/.cta, and preset-organism.navbar.items[] — never a DZ
    // member itself.
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('preset-molecule.link')?.category).toBe('preset-molecule');
    expect(components.get('preset-molecule.link')?.globalId).toBe('ComponentPresetMoleculeLink');
    expect(components.get('preset-molecule.link')?.attributes).toMatchObject({
      label: { type: 'string' },
      page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' },
      url: { type: 'string' },
      newTab: { type: 'boolean', default: false },
    });
  });

  it('injects the organism chrome (navbar/footer) under category "preset-organism" with a derived globalId', () => {
    // navbar/footer are organisms too (unified from the old chrome.* palette); the
    // placement split lives in schema.json, not the category.
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('preset-organism.navbar')?.modelType).toBe('component');
    expect(components.get('preset-organism.navbar')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.navbar')?.globalId).toBe('ComponentPresetOrganismNavbar');
    // Composite shape: nested nav items (the shared link descriptor) + optional
    // CTA (a button, already a labeled link + variant), no brand fields.
    expect(components.get('preset-organism.navbar')?.attributes).toMatchObject({
      items: { type: 'component', repeatable: true, component: 'preset-molecule.link' },
      cta: { type: 'component', repeatable: false, component: 'preset-atom.button' },
    });

    expect(components.get('preset-organism.footer')?.modelType).toBe('component');
    expect(components.get('preset-organism.footer')?.category).toBe('preset-organism');
    expect(components.get('preset-organism.footer')?.globalId).toBe('ComponentPresetOrganismFooter');
    expect(components.get('preset-organism.footer')?.attributes).toMatchObject({ text: { type: 'string' } });
  });

  it('injects the preset-layout tree-node descriptors (container/row) with the real JSON enum values', () => {
    // preset-layout.container is the shared curated attribute surface (width/gap/
    // verticalAlign) referenced by row/column via `component:` fields; row's ratio
    // is the closed column-split enum. These are JSON-sourced (no TS shape check),
    // so a typo like "spacius" would otherwise pass every other check.
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('preset-layout.container')?.modelType).toBe('component');
    expect(components.get('preset-layout.container')?.category).toBe('preset-layout');
    expect(components.get('preset-layout.container')?.attributes).toMatchObject({
      width: { type: 'enumeration', enum: ['prose', 'lg', 'full'] },
      gap: { type: 'enumeration', enum: ['compact', 'normal', 'spacious'] },
      verticalAlign: { type: 'enumeration', enum: ['top', 'center', 'bottom'] },
    });

    expect(components.get('preset-layout.row')?.modelType).toBe('component');
    expect(components.get('preset-layout.row')?.category).toBe('preset-layout');
    expect(components.get('preset-layout.row')?.attributes).toMatchObject({
      ratio: {
        type: 'enumeration',
        enum: ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'],
        default: '50-50',
      },
      container: { type: 'component', repeatable: false, component: 'preset-layout.container' },
    });
  });
});

describe('page.body customField (composition-builder storage, Spec §4)', () => {
  it('points body at the builder JSON custom field — no dynamic zone, no component list', () => {
    expect((pageSchema.attributes as any).body).toEqual({
      type: 'customField',
      customField: 'plugin::press-cms.builder',
    });
  });
});

describe('site-setting.pageDefaults customField (composition-builder storage, Spec §4)', () => {
  it('points pageDefaults at the builder JSON custom field in slots mode', () => {
    expect((siteSettingSchema.attributes as any).pageDefaults).toEqual({
      type: 'customField',
      customField: 'plugin::press-cms.builder',
      options: { mode: 'slots' },
    });
  });

  it('no longer carries the header/footer dynamic zones (BREAKING, Spec §4)', () => {
    expect((siteSettingSchema.attributes as any).header).toBeUndefined();
    expect((siteSettingSchema.attributes as any).footer).toBeUndefined();
  });
});

describe('site-setting cookie-consent attribute (cookie-consent Spec §1)', () => {
  it('attaches preset-config.cookie-consent as a config component', () => {
    expect((siteSettingSchema.attributes as any).cookieConsent).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.cookie-consent',
    });
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
