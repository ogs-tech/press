import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT, PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import schema from './schema';

/** Minimal registry-shaped fake (keys()/get(), never a Map) + a single-type read. */
const fakeStrapi = (record: unknown) => {
  const componentRecord: Record<string, any> = {
    'preset-atom.paragraph': { uid: 'preset-atom.paragraph', attributes: { content: { type: 'text' } } },
  };
  const contentTypes: Record<string, any> = {
    'plugin::press-cms.page': { uid: 'plugin::press-cms.page', info: {}, attributes: {} },
    'plugin::press-cms.site-setting': { uid: 'plugin::press-cms.site-setting', info: {}, attributes: {} },
  };
  return {
    contentType: (uid: string) => contentTypes[uid],
    get: (key: string) =>
      key === 'components'
        ? { keys: () => Object.keys(componentRecord), get: (uid: string) => componentRecord[uid] }
        : undefined,
    documents: vi.fn(() => ({ findFirst: vi.fn(async () => record) })),
  } as any;
};

describe('schema controller', () => {
  it('serves the registry view PLUS the CMS-owned layoutDefaults', async () => {
    const ctx: any = {};
    await schema({ strapi: fakeStrapi({ layout: { row: { gap: 'compact' } } }) }).get(ctx);
    expect(ctx.body.contentTypes['plugin::press-cms.page']).toBeDefined();
    expect(ctx.body.components['preset-atom.paragraph']).toBeDefined();
    expect(ctx.body.tree).toEqual({ version: PRESS_TREE_VERSION });
    expect(ctx.body.layoutDefaults.row).toEqual({ width: 'lg', gap: 'compact', verticalAlign: 'top' });
  });

  it('serves DEFAULT_LAYOUT when the Site Settings record is missing', async () => {
    const ctx: any = {};
    await schema({ strapi: fakeStrapi(null) }).get(ctx);
    expect(ctx.body.layoutDefaults).toEqual(DEFAULT_LAYOUT);
  });
});
