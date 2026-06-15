import { describe, expect, it } from 'vitest';
import { admitCustomBlocks } from './inject-components';

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
    const page = pageWithBody(['press.hero']);
    const strapi = makeStrapi({ page, componentUids: ['press.hero', 'custom.callout', 'custom.banner'] });

    admitCustomBlocks({ strapi });

    // press.* is untouched; both custom.* blocks are appended, no duplicates.
    expect(page.attributes.body.components).toEqual(['press.hero', 'custom.callout', 'custom.banner']);
  });

  it('is idempotent: an already-admitted custom.* block is not duplicated', () => {
    const page = pageWithBody(['press.hero', 'custom.callout']);
    const strapi = makeStrapi({ page, componentUids: ['press.hero', 'custom.callout'] });

    admitCustomBlocks({ strapi });

    expect(page.attributes.body.components).toEqual(['press.hero', 'custom.callout']);
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
