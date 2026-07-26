import { describe, expect, it } from 'vitest';
import { CONTAINER_ENUMS } from '@ogs-tech/press-shared';
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
      'preset-config.basic-settings', 'preset-config.theme-advanced',
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
    expect(components.get('preset-config.basic-settings')?.modelType).toBe('component'); // others still injected
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
    // navbar/footer are organisms too (unified from the old chrome.* palette);
    // placement is universal (Spec §4) — the tree, not the category, decides.
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
    // verticalAlign) referenced by row/column via `component:` fields; row carries
    // only the container reference now; column span is builder-owned structural
    // data. These are JSON-sourced (no TS shape check), so a typo like "spacius"
    // would otherwise pass every other check.
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });

    expect(components.get('preset-layout.container')?.modelType).toBe('component');
    expect(components.get('preset-layout.container')?.category).toBe('preset-layout');
    expect(components.get('preset-layout.container')?.attributes).toMatchObject({
      width: { type: 'enumeration', enum: ['prose', 'lg', 'full'] },
      gap: { type: 'enumeration', enum: ['compact', 'normal', 'spacious'] },
      verticalAlign: { type: 'enumeration', enum: ['top', 'center', 'bottom'] },
    });

    const rowAttrs = components.get('preset-layout.row')?.attributes as Record<string, unknown>;
    expect(components.get('preset-layout.row')?.modelType).toBe('component');
    expect(components.get('preset-layout.row')?.category).toBe('preset-layout');
    expect(rowAttrs).not.toHaveProperty('ratio');
    expect(rowAttrs).toMatchObject({
      container: { type: 'component', repeatable: false, component: 'preset-layout.container' },
    });
  });

  it('registers the four preset-config.layout* descriptors (layout-defaults spec §4)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    for (const uid of ['preset-config.layout', 'preset-config.layout-page', 'preset-config.layout-row', 'preset-config.layout-column']) {
      expect(components.get(uid)?.modelType).toBe('component');
      expect(components.get(uid)?.category).toBe('preset-config');
    }
    // the group holds exactly one component per tree level — the shape LayoutDefaults mirrors
    expect(components.get('preset-config.layout')?.attributes).toEqual({
      page: { type: 'component', repeatable: false, component: 'preset-config.layout-page' },
      row: { type: 'component', repeatable: false, component: 'preset-config.layout-row' },
      column: { type: 'component', repeatable: false, component: 'preset-config.layout-column' },
    });
  });

  it('gives each level exactly the attrs that apply there — never a field the renderer ignores', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    expect(Object.keys(components.get('preset-config.layout-page').attributes)).toEqual(['gap']);
    expect(Object.keys(components.get('preset-config.layout-row').attributes)).toEqual(['width', 'gap', 'verticalAlign']);
    expect(Object.keys(components.get('preset-config.layout-column').attributes)).toEqual(['gap', 'verticalAlign']);
  });

  it('pins every layout enum to the shared CONTAINER_ENUMS (one source of allowed values)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const attrs = (uid: string) => components.get(uid).attributes as Record<string, { enum: string[] }>;
    expect(attrs('preset-config.layout-page').gap.enum).toEqual([...CONTAINER_ENUMS.gap]);
    expect(attrs('preset-config.layout-row').width.enum).toEqual([...CONTAINER_ENUMS.width]);
    expect(attrs('preset-config.layout-row').gap.enum).toEqual([...CONTAINER_ENUMS.gap]);
    expect(attrs('preset-config.layout-row').verticalAlign.enum).toEqual([...CONTAINER_ENUMS.verticalAlign]);
    expect(attrs('preset-config.layout-column').gap.enum).toEqual([...CONTAINER_ENUMS.gap]);
    expect(attrs('preset-config.layout-column').verticalAlign.enum).toEqual([...CONTAINER_ENUMS.verticalAlign]);
  });

  it('labels the level fields EXACTLY as the builder names them (Site default · … traceability)', () => {
    const { strapi, components } = makeStrapi();
    injectComponents({ strapi });
    const label = (uid: string, field: string) => (components.get(uid) as any).config.metadatas[field].edit.label;
    expect(label('preset-config.layout-page', 'gap')).toBe('Vertical rhythm');
    expect(label('preset-config.layout-row', 'width')).toBe('Width');
    expect(label('preset-config.layout-row', 'gap')).toBe('Column gap');
    expect(label('preset-config.layout-row', 'verticalAlign')).toBe('Vertical align');
    expect(label('preset-config.layout-column', 'gap')).toBe('Vertical rhythm');
    expect(label('preset-config.layout-column', 'verticalAlign')).toBe('Content align');
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

describe('site-setting basicSettings attribute (Ajustes básicos)', () => {
  it('attaches preset-config.basic-settings as a config component', () => {
    expect((siteSettingSchema.attributes as any).basicSettings).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.basic-settings',
    });
  });

  it('no longer carries the removed seo/cookieConsent/themeColors/themeRadius attributes (BREAKING)', () => {
    expect((siteSettingSchema.attributes as any).seo).toBeUndefined();
    expect((siteSettingSchema.attributes as any).cookieConsent).toBeUndefined();
    expect((siteSettingSchema.attributes as any).themeColors).toBeUndefined();
    expect((siteSettingSchema.attributes as any).themeRadius).toBeUndefined();
  });

  it('always resolves the Content Manager title to the schema displayName, never the record name (mainField pinned to id)', () => {
    expect((siteSettingSchema as any).config.settings.mainField).toBe('id');
    expect(siteSettingSchema.info.displayName).toBe('Site Settings');
  });

  it('nests identity, curated basic theme tokens, and the theme-advanced sub-section', () => {
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
    expect(components.get('preset-config.basic-settings')?.attributes).toMatchObject({
      name: { type: 'string' },
      url: { type: 'string' },
      locale: { type: 'string' },
      logo: { type: 'media' },
      favicon: { type: 'media' },
      primary: { type: 'string' },
      accent: { type: 'string' },
      ink: { type: 'string' },
      surface: { type: 'string' },
      radius: { type: 'string' },
      themeAdvanced: { type: 'component', repeatable: false, component: 'preset-config.theme-advanced' },
    });
    expect(components.get('preset-config.theme-advanced')?.attributes).toMatchObject({
      secondary: { type: 'string' },
      muted: { type: 'string' },
      danger: { type: 'string' },
      onPrimary: { type: 'string' },
      border: { type: 'string' },
      radiusXs: { type: 'string' },
      radiusSm: { type: 'string' },
      radiusLg: { type: 'string' },
    });
  });
});

describe('site-setting layout attribute (layout-defaults spec §4)', () => {
  it('attaches preset-config.layout as a config component labelled "Layout"', () => {
    expect((siteSettingSchema.attributes as any).layout).toEqual({
      type: 'component',
      repeatable: false,
      component: 'preset-config.layout',
    });
    expect((siteSettingSchema as any).config.metadatas.layout.edit.label).toBe('Layout');
  });
});
