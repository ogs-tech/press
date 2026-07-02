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
  return {
    contentType: (_uid: string) => ({
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'dynamiczone', components: ['press.paragraph', 'press.image', 'custom.callout'] },
      },
    }),
    get: (key: string) => (key === 'components' ? components : undefined),
  } as any;
};

describe('serializeSchema', () => {
  it('emits the page content-type and only the DZ-admitted components (runtime view)', () => {
    const out = serializeSchema(fakeStrapi());
    expect(Object.keys(out.contentTypes)).toEqual(['plugin::press-cms.page']);
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
