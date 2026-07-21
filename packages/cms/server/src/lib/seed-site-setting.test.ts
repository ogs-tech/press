import { describe, expect, it } from 'vitest';
import { seedSiteSetting, SITE_SETTING_UID } from './seed-site-setting';

/** Minimal Document-Service + plugin-store fake (pre-tree harness, populate pin dropped). */
function fakeStrapi(record: any = null, flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: any }> = [];
  const updates: Array<{ documentId: string; data: any }> = [];
  let current = record;
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID);
      return {
        findFirst: async () => current,
        create: async (params: { data: any }) => {
          creates.push(params);
          current = { documentId: 'doc-1', ...params.data };
          return current;
        },
        update: async (params: { documentId: string; data: any }) => {
          updates.push(params);
          current = { ...current, ...params.data };
          return current;
        },
      };
    },
    store: ({ type, name }: { type: string; name: string }) => {
      expect(type).toBe('plugin');
      expect(name).toBe('press-cms');
      return {
        get: async ({ key }: { key: string }) => store.get(key),
        set: async ({ key, value }: { key: string; value: unknown }) => void store.set(key, value),
      };
    },
  } as any;
  return { strapi, creates, updates, store };
}

const expectBareChrome = (pd: any) => {
  expect(pd.header).toHaveLength(1);
  expect(pd.header[0]).toMatchObject({ type: 'block', component: 'preset-organism.navbar', data: {} });
  expect(typeof pd.header[0].id).toBe('string');
  expect(pd.footer[0]).toMatchObject({ type: 'block', component: 'preset-organism.footer', data: {} });
};

describe('seedSiteSetting — pageDefaults (composition-builder Spec §4)', () => {
  it('creates the record WITH bare pageDefaults on a fresh DB and marks the seed done', async () => {
    const { strapi, creates, updates, store } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expectBareChrome(creates[0].data.pageDefaults);
    expect(updates).toEqual([]);
    expect(store.get('pageDefaultsSeeded')).toBe(true);
  });

  it('fills still-empty slots on an existing record exactly once', async () => {
    const { strapi, updates, store } = fakeStrapi({ documentId: 'doc-1', pageDefaults: { header: [], footer: [] } });
    await seedSiteSetting(strapi);
    expect(updates).toHaveLength(1);
    expectBareChrome(updates[0].data.pageDefaults);
    expect(store.get('pageDefaultsSeeded')).toBe(true);
  });

  it('never overwrites a composed slot — only the empty sibling is seeded', async () => {
    const composed = [{ id: 'n1', type: 'block', component: 'preset-organism.navbar', data: { items: [{ label: 'Docs' }] } }];
    const { strapi, updates } = fakeStrapi({ documentId: 'doc-1', pageDefaults: { header: composed, footer: [] } });
    await seedSiteSetting(strapi);
    expect(updates).toHaveLength(1);
    const pd = updates[0].data.pageDefaults as any;
    expect(pd.header).toEqual(composed);
    expect(pd.footer[0]).toMatchObject({ component: 'preset-organism.footer' });
  });

  it('respects an editor-emptied slot once the seed has run (flag set → no writes)', async () => {
    const { strapi, creates, updates } = fakeStrapi(
      { documentId: 'doc-1', pageDefaults: { header: [], footer: [] } },
      { pageDefaultsSeeded: true },
    );
    await seedSiteSetting(strapi);
    expect(creates).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates, updates } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expect(updates).toEqual([]);
  });
});
