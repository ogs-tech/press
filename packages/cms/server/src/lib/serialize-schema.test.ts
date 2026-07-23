import { describe, expect, it } from 'vitest';
import { serializeSchema } from './serialize-schema';

const fakeStrapi = () => {
  // Registry-shaped fake mirroring Strapi's REAL components registry API
  // (keys()/get(), NOT a Map with entries()) — so this test fails if serialize
  // ever iterates with registry.entries() again (the runtime bug a Map fake hid).
  const componentRecord: Record<string, any> = {
    'preset-atom.paragraph': { uid: 'preset-atom.paragraph', attributes: { content: { type: 'text', required: true }, createdAt: { type: 'datetime', private: true } } },
    'preset-molecule.link': { uid: 'preset-molecule.link', attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean', default: false } } },
    'preset-layout.container': { uid: 'preset-layout.container', attributes: { width: { type: 'enumeration', enum: ['prose', 'lg', 'full'] } } },
    'custom-organism.callout': { uid: 'custom-organism.callout', attributes: { message: { type: 'string', required: true } } },
    // NOT part of the palette — must be excluded:
    'admin.something': { uid: 'admin.something', attributes: { x: { type: 'string' } } },
  };
  const components = {
    keys: () => Object.keys(componentRecord),
    get: (uid: string) => componentRecord[uid],
  };
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': {
      uid: 'plugin::press-cms.page',
      info: { singularName: 'page', pluralName: 'pages', displayName: 'Page' },
      attributes: {
        title: { type: 'string', required: true },
        slug: { type: 'uid', targetField: 'title' },
        body: { type: 'customField', customField: 'plugin::press-cms.builder' },
      },
    },
    'plugin::press-cms.site-setting': {
      uid: 'plugin::press-cms.site-setting',
      info: { singularName: 'site-setting', pluralName: 'site-settings', displayName: 'Site Settings' },
      attributes: {
        name: { type: 'string' },
        pageDefaults: { type: 'customField', customField: 'plugin::press-cms.builder' },
      },
    },
  };
  return {
    contentType: (uid: string) => contentTypes[uid],
    get: (key: string) => (key === 'components' ? components : undefined),
  } as any;
};

describe('serializeSchema', () => {
  it('serves the tree contract version', () => {
    expect(serializeSchema(fakeStrapi()).tree).toEqual({ version: 2 });
  });

  it('serves the FULL registered palette — every preset-* and custom-* uid, nothing else', () => {
    const out = serializeSchema(fakeStrapi());
    expect(Object.keys(out.components).sort()).toEqual([
      'custom-organism.callout',
      'preset-atom.paragraph',
      'preset-layout.container',
      'preset-molecule.link',
    ]);
  });

  it('keeps contract attribute keys (target included, for page refs) and drops noise', () => {
    const out = serializeSchema(fakeStrapi());
    expect(out.components['preset-atom.paragraph'].attributes).toEqual({
      content: { type: 'text', required: true },
    });
    expect(out.components['preset-molecule.link'].attributes.page).toEqual({
      type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page',
    });
  });

  it('still fails loud when an engine content-type is missing', () => {
    const broken = fakeStrapi();
    const orig = broken.contentType;
    broken.contentType = (uid: string) => (uid === 'plugin::press-cms.page' ? undefined : orig(uid));
    expect(() => serializeSchema(broken)).toThrow(/not registered/);
  });
});
