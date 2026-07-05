import { describe, expect, it } from 'vitest';
import { DEFAULT_CHROME, seedSiteSetting, SITE_SETTING_UID } from './seed-site-setting';

/**
 * Minimal Document-Service + plugin-store fake: a mutable record, recording
 * create/update, and a Map-backed store for the run-once chrome flag.
 */
function fakeStrapi(record: any = null, flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: unknown }> = [];
  const updates: Array<{ documentId: string; data: unknown }> = [];
  let current = record;
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID); // helper must target the single-type UID
      return {
        findFirst: async (params: any) => {
          // The chrome DZs are invisible without populate — pin that the seed asks.
          expect(params?.populate).toMatchObject({ header: true, footer: true });
          return current;
        },
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

describe('seedSiteSetting — chrome composition (Spec §4)', () => {
  it('creates the record WITH the default chrome on a fresh DB and marks the seed done', async () => {
    const { strapi, creates, updates, store } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    expect(creates).toEqual([{ data: DEFAULT_CHROME }]);
    expect(updates).toEqual([]);
    expect(store.get('chromeSeeded')).toBe(true);
  });

  it('fills still-empty DZs on an existing record (upgrade path) exactly once', async () => {
    const { strapi, updates, store } = fakeStrapi({ documentId: 'doc-1', header: [], footer: [] });
    await seedSiteSetting(strapi);
    expect(updates).toEqual([{ documentId: 'doc-1', data: DEFAULT_CHROME }]);
    expect(store.get('chromeSeeded')).toBe(true);
  });

  it('never overwrites a composed DZ — only the empty sibling is seeded', async () => {
    const composed = [{ __component: 'preset-organism.navbar', id: 7, items: [{ label: 'Docs' }] }];
    const { strapi, updates } = fakeStrapi({ documentId: 'doc-1', header: composed, footer: [] });
    await seedSiteSetting(strapi);
    expect(updates).toEqual([{ documentId: 'doc-1', data: { footer: DEFAULT_CHROME.footer } }]);
  });

  it('respects an editor-emptied [] once the seed has run (flag set → no writes)', async () => {
    const { strapi, creates, updates } = fakeStrapi(
      { documentId: 'doc-1', header: [], footer: [] },
      { chromeSeeded: true },
    );
    await seedSiteSetting(strapi);
    expect(creates).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates, updates } = fakeStrapi(null);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    await seedSiteSetting(strapi);
    expect(creates).toHaveLength(1);
    expect(updates).toEqual([]);
  });
});
