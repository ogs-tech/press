import { describe, expect, it } from 'vitest';
import { serializeSchema } from './serialize-schema';

const fakeStrapi = () => {
  const components = new Map<string, any>([
    ['preset-atom.paragraph', {
      uid: 'preset-atom.paragraph',
      attributes: {
        content: { type: 'blocks', required: true },
        // noise that must be stripped:
        createdAt: { type: 'datetime', private: true },
      },
    }],
    ['preset-atom.image', {
      uid: 'preset-atom.image',
      attributes: {
        image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
        caption: { type: 'string' },
      },
    }],
    ['custom-organism.callout', {
      uid: 'custom-organism.callout',
      attributes: {
        message: { type: 'string', required: true },
        variant: { type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info' },
      },
    }],
    ['preset-atom.unused', { uid: 'preset-atom.unused', attributes: { x: { type: 'string' } } }],
  ]);
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': {
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'dynamiczone', components: ['preset-atom.paragraph', 'preset-atom.image', 'custom-organism.callout'] },
      },
    },
    'plugin::press-cms.site-setting': {
      uid: 'plugin::press-cms.site-setting',
      info: { singularName: 'site-setting', pluralName: 'site-settings', displayName: 'Site Settings' },
      attributes: {
        name: { type: 'string' },
        header: { type: 'dynamiczone', components: [] },
        footer: { type: 'dynamiczone', components: [] },
      },
    },
  };
  return {
    contentType: (uid: string) => contentTypes[uid],
    get: (key: string) => (key === 'components' ? components : undefined),
  } as any;
};

describe('serializeSchema', () => {
  it('emits the page content-type and only the DZ-admitted components (runtime view)', () => {
    const out = serializeSchema(fakeStrapi());
    expect(Object.keys(out.contentTypes).sort()).toEqual([
      'plugin::press-cms.page',
      'plugin::press-cms.site-setting',
    ]);
    // preset-atom.unused is registered but NOT in page.body → excluded
    expect(Object.keys(out.components).sort()).toEqual([
      'custom-organism.callout', 'preset-atom.image', 'preset-atom.paragraph',
    ]);
  });

  it('keeps only the contract attribute keys and drops private/internal noise', () => {
    const out = serializeSchema(fakeStrapi());
    // paragraph: the `blocks` type and `required` flag survive; createdAt noise is dropped.
    expect(out.components['preset-atom.paragraph'].attributes).toEqual({
      content: { type: 'blocks', required: true },
    });
    // image: single required media + optional caption.
    expect(out.components['preset-atom.image'].attributes).toEqual({
      image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
      caption: { type: 'string' },
    });
    expect(out.components['custom-organism.callout'].attributes.variant).toEqual({
      type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info',
    });
    expect(out.contentTypes['plugin::press-cms.page'].attributes.body).toEqual({
      type: 'dynamiczone', components: ['preset-atom.paragraph', 'preset-atom.image', 'custom-organism.callout'],
    });
  });

  it('serializes preset-organism.hero and preset-organism.cta with their flat attributes (runtime view)', () => {
    const components = new Map<string, any>([
      ['preset-organism.hero', {
        uid: 'preset-organism.hero',
        attributes: {
          eyebrow: { type: 'string' },
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
          ctaLabel: { type: 'string' },
          ctaHref: { type: 'string' },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      }],
      ['preset-organism.cta', {
        uid: 'preset-organism.cta',
        attributes: {
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          buttonLabel: { type: 'string', required: true },
          buttonHref: { type: 'string', required: true },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      }],
    ]);
    const strapi = {
      contentType: () => ({
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: { body: { type: 'dynamiczone', components: ['preset-organism.hero', 'preset-organism.cta'] } },
      }),
      get: (key: string) => (key === 'components' ? components : undefined),
    } as any;

    const out = serializeSchema(strapi);
    expect(Object.keys(out.components).sort()).toEqual(['preset-organism.cta', 'preset-organism.hero']);
    // Flat fields survive verbatim — no serialize-schema change is needed (Spec §5.1/§7).
    expect(out.components['preset-organism.hero'].attributes.title).toEqual({ type: 'string', required: true });
    expect(out.components['preset-organism.hero'].attributes.align).toEqual({
      type: 'enumeration', enum: ['left', 'center'], default: 'left',
    });
    expect(out.components['preset-organism.cta'].attributes.buttonHref).toEqual({ type: 'string', required: true });
  });

  it('throws (not a cryptic null-deref) when the page content-type is not registered', () => {
    const strapi = { contentType: () => undefined, get: () => new Map() } as any;
    expect(() => serializeSchema(strapi)).toThrow(/plugin::press-cms\.page.*not registered/);
  });

  it('throws instead of silently dropping a DZ-admitted component missing from the registry', () => {
    const strapi = {
      contentType: () => ({
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: { body: { type: 'dynamiczone', components: ['custom-organism.ghost'] } },
      }),
      get: (key: string) => (key === 'components' ? new Map() : undefined),
    } as any;
    expect(() => serializeSchema(strapi)).toThrow(/custom-organism\.ghost.*absent from the components registry/);
  });
});

describe('serializeSchema — chrome dynamic zones', () => {
  const chromeStrapi = () => {
    const components = new Map<string, any>([
      ['preset-organism.navbar', {
        uid: 'preset-organism.navbar',
        attributes: {
          items: { type: 'component', repeatable: true, component: 'preset-molecule.nav-item' },
          cta: { type: 'component', repeatable: false, component: 'preset-atom.button' },
        },
      }],
      ['preset-organism.footer', { uid: 'preset-organism.footer', attributes: { text: { type: 'string' } } }],
      ['preset-molecule.nav-item', {
        uid: 'preset-molecule.nav-item',
        attributes: {
          label: { type: 'string', required: true },
          page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' },
          url: { type: 'string' },
          newTab: { type: 'boolean', default: false },
        },
      }],
      ['preset-atom.button', {
        uid: 'preset-atom.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      }],
      ['preset-atom.paragraph', { uid: 'preset-atom.paragraph', attributes: { content: { type: 'blocks', required: true } } }],
    ]);
    const contentTypes: Record<string, any> = {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['preset-atom.paragraph', 'preset-atom.button'] },
        },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: {},
        attributes: {
          name: { type: 'string' },
          header: { type: 'dynamiczone', components: ['preset-organism.navbar', 'preset-atom.paragraph'] },
          footer: { type: 'dynamiczone', components: ['preset-organism.footer'] },
        },
      },
    };
    return {
      contentType: (uid: string) => contentTypes[uid],
      get: (key: string) => (key === 'components' ? components : undefined),
    } as any;
  };

  it('serializes the site-setting content-type with its two chrome DZ attributes', () => {
    const out = serializeSchema(chromeStrapi());
    const siteSetting = out.contentTypes['plugin::press-cms.site-setting'];
    expect(siteSetting.attributes.header).toEqual({
      type: 'dynamiczone', components: ['preset-organism.navbar', 'preset-atom.paragraph'],
    });
    expect(siteSetting.attributes.footer).toEqual({
      type: 'dynamiczone', components: ['preset-organism.footer'],
    });
  });

  it('walks all three DZs into the components map', () => {
    const out = serializeSchema(chromeStrapi());
    for (const uid of ['preset-atom.paragraph', 'preset-atom.button', 'preset-organism.navbar', 'preset-organism.footer']) {
      expect(out.components[uid]).toBeDefined();
    }
  });

  it('follows nested component references — preset-molecule.nav-item enters the map without being a DZ member (Spec §2)', () => {
    const out = serializeSchema(chromeStrapi());
    expect(out.components['preset-molecule.nav-item']).toBeDefined();
    expect(out.components['preset-molecule.nav-item'].attributes.label).toEqual({ type: 'string', required: true });
    // The nested reference keeps its component/repeatable keys so the generator
    // can type it (Spec §2).
    expect(out.components['preset-organism.navbar'].attributes.items).toEqual({
      type: 'component', repeatable: true, component: 'preset-molecule.nav-item',
    });
    expect(out.components['preset-organism.navbar'].attributes.cta).toEqual({
      type: 'component', repeatable: false, component: 'preset-atom.button',
    });
  });

  it('does NOT pull site-setting config components (preset-config.seo & co.) into the map', () => {
    // Nested-ref walking starts from DZ admissions only — content-type component
    // attributes (seo, themeColors…) are not part of the block contract.
    const out = serializeSchema(chromeStrapi());
    expect(out.components['preset-config.seo']).toBeUndefined();
  });

  it('fail-fast covers nested refs: a referenced component missing from the registry throws', () => {
    const strapi = chromeStrapi();
    (strapi.get('components') as Map<string, any>).delete('preset-molecule.nav-item');
    expect(() => serializeSchema(strapi)).toThrow(/preset-molecule\.nav-item.*absent from the components registry/);
  });

  it('throws when the site-setting content-type is not registered', () => {
    const strapi = chromeStrapi();
    const inner = strapi.contentType;
    strapi.contentType = (uid: string) =>
      uid === 'plugin::press-cms.site-setting' ? undefined : inner(uid);
    expect(() => serializeSchema(strapi)).toThrow(/plugin::press-cms\.site-setting.*not registered/);
  });
});

describe('serializeSchema — two-level nesting (preset-organism.columns)', () => {
  // The navbar coverage above proves ONE level of nested refs; the columns chain
  // is the first TWO-level chain (DZ member → repeatable molecule → nested atom).
  // This pins the BFS as genuinely transitive, not accidentally depth-1.
  const columnsStrapi = () => {
    const components = new Map<string, any>([
      ['preset-organism.columns', {
        uid: 'preset-organism.columns',
        attributes: {
          ratio: { type: 'enumeration', enum: ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'], default: '50-50' },
          gap: { type: 'enumeration', enum: ['compact', 'normal', 'spacious'], default: 'normal' },
          verticalAlign: { type: 'enumeration', enum: ['top', 'center', 'bottom'], default: 'top' },
          columns: { type: 'component', repeatable: true, component: 'preset-molecule.column' },
        },
      }],
      ['preset-molecule.column', {
        uid: 'preset-molecule.column',
        attributes: {
          content: { type: 'blocks' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
          button: { type: 'component', repeatable: false, component: 'preset-atom.button' },
        },
      }],
      ['preset-atom.button', {
        uid: 'preset-atom.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      }],
    ]);
    const contentTypes: Record<string, any> = {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: { body: { type: 'dynamiczone', components: ['preset-organism.columns'] } },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: {},
        attributes: {
          header: { type: 'dynamiczone', components: [] },
          footer: { type: 'dynamiczone', components: [] },
        },
      },
    };
    return {
      contentType: (uid: string) => contentTypes[uid],
      get: (key: string) => (key === 'components' ? components : undefined),
    } as any;
  };

  it('follows the chain columns → column → button: all three enter the map from one DZ admission', () => {
    const out = serializeSchema(columnsStrapi());
    expect(Object.keys(out.components).sort()).toEqual([
      'preset-atom.button', 'preset-molecule.column', 'preset-organism.columns',
    ]);
    // The layout enums survive verbatim (KEEP: type/enum/default).
    expect(out.components['preset-organism.columns'].attributes.ratio).toEqual({
      type: 'enumeration', enum: ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'], default: '50-50',
    });
    // The nested refs keep component/repeatable so the generator can type them.
    expect(out.components['preset-organism.columns'].attributes.columns).toEqual({
      type: 'component', repeatable: true, component: 'preset-molecule.column',
    });
    expect(out.components['preset-molecule.column'].attributes.button).toEqual({
      type: 'component', repeatable: false, component: 'preset-atom.button',
    });
    // min/max are authoring guards, never part of the wire contract (KEEP excludes them).
    expect(out.components['preset-organism.columns'].attributes.columns).not.toHaveProperty('min');
  });

  it('fail-fast reaches depth 2: a missing second-level ref (the button) throws', () => {
    const strapi = columnsStrapi();
    (strapi.get('components') as Map<string, any>).delete('preset-atom.button');
    expect(() => serializeSchema(strapi)).toThrow(/preset-atom\.button.*absent from the components registry/);
  });
});
