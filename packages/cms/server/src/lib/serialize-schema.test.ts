import { describe, expect, it } from 'vitest';
import { serializeSchema } from './serialize-schema';

const fakeStrapi = () => {
  const components = new Map<string, any>([
    ['press.paragraph', {
      uid: 'press.paragraph',
      attributes: {
        content: { type: 'blocks', required: true },
        // noise that must be stripped:
        createdAt: { type: 'datetime', private: true },
      },
    }],
    ['press.image', {
      uid: 'press.image',
      attributes: {
        image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
        caption: { type: 'string' },
      },
    }],
    ['custom.callout', {
      uid: 'custom.callout',
      attributes: {
        message: { type: 'string', required: true },
        variant: { type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info' },
      },
    }],
    ['press.unused', { uid: 'press.unused', attributes: { x: { type: 'string' } } }],
  ]);
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': {
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'dynamiczone', components: ['press.paragraph', 'press.image', 'custom.callout'] },
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
    // press.unused is registered but NOT in page.body → excluded
    expect(Object.keys(out.components).sort()).toEqual(['custom.callout', 'press.image', 'press.paragraph']);
  });

  it('keeps only the contract attribute keys and drops private/internal noise', () => {
    const out = serializeSchema(fakeStrapi());
    // paragraph: the `blocks` type and `required` flag survive; createdAt noise is dropped.
    expect(out.components['press.paragraph'].attributes).toEqual({
      content: { type: 'blocks', required: true },
    });
    // image: single required media + optional caption.
    expect(out.components['press.image'].attributes).toEqual({
      image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
      caption: { type: 'string' },
    });
    expect(out.components['custom.callout'].attributes.variant).toEqual({
      type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info',
    });
    expect(out.contentTypes['plugin::press-cms.page'].attributes.body).toEqual({
      type: 'dynamiczone', components: ['press.paragraph', 'press.image', 'custom.callout'],
    });
  });

  it('serializes section.hero and section.cta with their flat attributes (runtime view)', () => {
    const components = new Map<string, any>([
      ['section.hero', {
        uid: 'section.hero',
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
      ['section.cta', {
        uid: 'section.cta',
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
        attributes: { body: { type: 'dynamiczone', components: ['section.hero', 'section.cta'] } },
      }),
      get: (key: string) => (key === 'components' ? components : undefined),
    } as any;

    const out = serializeSchema(strapi);
    expect(Object.keys(out.components).sort()).toEqual(['section.cta', 'section.hero']);
    // Flat fields survive verbatim — no serialize-schema change is needed (Spec §5.1/§7).
    expect(out.components['section.hero'].attributes.title).toEqual({ type: 'string', required: true });
    expect(out.components['section.hero'].attributes.align).toEqual({
      type: 'enumeration', enum: ['left', 'center'], default: 'left',
    });
    expect(out.components['section.cta'].attributes.buttonHref).toEqual({ type: 'string', required: true });
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
        attributes: { body: { type: 'dynamiczone', components: ['custom.ghost'] } },
      }),
      get: (key: string) => (key === 'components' ? new Map() : undefined),
    } as any;
    expect(() => serializeSchema(strapi)).toThrow(/custom\.ghost.*absent from the components registry/);
  });
});

describe('serializeSchema — chrome dynamic zones', () => {
  const chromeStrapi = () => {
    const components = new Map<string, any>([
      ['chrome.navbar', {
        uid: 'chrome.navbar',
        attributes: {
          items: { type: 'component', repeatable: true, component: 'press.nav-item' },
          cta: { type: 'component', repeatable: false, component: 'press.button' },
        },
      }],
      ['chrome.footer', { uid: 'chrome.footer', attributes: { text: { type: 'string' } } }],
      ['press.nav-item', {
        uid: 'press.nav-item',
        attributes: {
          label: { type: 'string', required: true },
          page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' },
          url: { type: 'string' },
          newTab: { type: 'boolean', default: false },
        },
      }],
      ['press.button', {
        uid: 'press.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      }],
      ['press.paragraph', { uid: 'press.paragraph', attributes: { content: { type: 'blocks', required: true } } }],
    ]);
    const contentTypes: Record<string, any> = {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: {},
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['press.paragraph', 'press.button'] },
        },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: {},
        attributes: {
          name: { type: 'string' },
          header: { type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph'] },
          footer: { type: 'dynamiczone', components: ['chrome.footer'] },
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
      type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph'],
    });
    expect(siteSetting.attributes.footer).toEqual({
      type: 'dynamiczone', components: ['chrome.footer'],
    });
  });

  it('walks all three DZs into the components map', () => {
    const out = serializeSchema(chromeStrapi());
    for (const uid of ['press.paragraph', 'press.button', 'chrome.navbar', 'chrome.footer']) {
      expect(out.components[uid]).toBeDefined();
    }
  });

  it('follows nested component references — press.nav-item enters the map without being a DZ member (Spec §2)', () => {
    const out = serializeSchema(chromeStrapi());
    expect(out.components['press.nav-item']).toBeDefined();
    expect(out.components['press.nav-item'].attributes.label).toEqual({ type: 'string', required: true });
    // The nested reference keeps its component/repeatable keys so the generator
    // can type it (Spec §2).
    expect(out.components['chrome.navbar'].attributes.items).toEqual({
      type: 'component', repeatable: true, component: 'press.nav-item',
    });
    expect(out.components['chrome.navbar'].attributes.cta).toEqual({
      type: 'component', repeatable: false, component: 'press.button',
    });
  });

  it('does NOT pull site-setting config components (press.seo & co.) into the map', () => {
    // Nested-ref walking starts from DZ admissions only — content-type component
    // attributes (seo, themeColors…) are not part of the block contract.
    const out = serializeSchema(chromeStrapi());
    expect(out.components['press.seo']).toBeUndefined();
  });

  it('fail-fast covers nested refs: a referenced component missing from the registry throws', () => {
    const strapi = chromeStrapi();
    (strapi.get('components') as Map<string, any>).delete('press.nav-item');
    expect(() => serializeSchema(strapi)).toThrow(/press\.nav-item.*absent from the components registry/);
  });

  it('throws when the site-setting content-type is not registered', () => {
    const strapi = chromeStrapi();
    const inner = strapi.contentType;
    strapi.contentType = (uid: string) =>
      uid === 'plugin::press-cms.site-setting' ? undefined : inner(uid);
    expect(() => serializeSchema(strapi)).toThrow(/plugin::press-cms\.site-setting.*not registered/);
  });
});
