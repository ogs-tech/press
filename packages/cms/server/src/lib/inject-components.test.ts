import { describe, expect, it } from 'vitest';
import { admitCustomBlocks, injectComponents } from './inject-components';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * Minimal Strapi double exposing only what admitCustomBlocks touches: the
 * content-types + components registries (`strapi.get`) and a no-op logger.
 */
const makeStrapi = (opts: { page?: any; componentUids?: string[] }) => {
  const contentTypes = new Map<string, any>();
  if (opts.page) contentTypes.set(PAGE_UID, opts.page);
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

describe('admitCustomBlocks', () => {
  it('admits every custom.* component into the page Dynamic Zone', () => {
    const page = pageWithBody(['press.paragraph']);
    const strapi = makeStrapi({ page, componentUids: ['press.paragraph', 'custom.callout', 'custom.banner'] });

    admitCustomBlocks({ strapi });

    // press.* is untouched; both custom.* blocks are appended, no duplicates.
    expect(page.attributes.body.components).toEqual(['press.paragraph', 'custom.callout', 'custom.banner']);
  });

  it('is idempotent: an already-admitted custom.* block is not duplicated', () => {
    const page = pageWithBody(['press.paragraph', 'custom.callout']);
    const strapi = makeStrapi({ page, componentUids: ['press.paragraph', 'custom.callout'] });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['press.paragraph', 'custom.callout']);
  });

  it('throws (aborts boot) when the page content-type is absent from the registry', () => {
    const strapi = makeStrapi({ componentUids: ['custom.callout'] }); // no page registered
    expect(() => admitCustomBlocks({ strapi })).toThrow(/plugin::press-cms\.page.*absent/);
  });

  it('throws (aborts boot) when page.body is not a dynamic zone', () => {
    const strapi = makeStrapi({
      page: { uid: PAGE_UID, attributes: { body: { type: 'string' } } },
      componentUids: ['custom.callout'],
    });
    expect(() => admitCustomBlocks({ strapi })).toThrow(/no 'body' dynamic zone/);
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
    const contentTypes = new Map<string, any>([[PAGE_UID, page]]);
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
});
