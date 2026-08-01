import { describe, expect, it } from 'vitest';
import type { PressTree } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { PAGE_UID, seedPage } from './seed-page';

const DEMO_BODY: PressTree = {
  version: PRESS_TREE_VERSION,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [],
  },
};

const OPTS = {
  slug: 'demo',
  title: 'Demo',
  flagKey: 'demoPageSeeded',
  body: DEMO_BODY,
};

/**
 * Minimal Document-Service + plugin-store fake: a mutable page list keyed by
 * slug, recording creates, and a Map-backed store for the run-once flag.
 */
function fakeStrapi(pages: any[] = [], flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: any }> = [];
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(PAGE_UID); // helper must target the page collection UID
      return {
        findFirst: async (params: any) => {
          // The seed must look up by the requested slug — never a broad match.
          expect(params?.filters).toMatchObject({ slug: OPTS.slug });
          return pages.find((page) => page.slug === OPTS.slug) ?? null;
        },
        create: async (params: { data: any }) => {
          creates.push(params);
          pages.push({ documentId: `doc-${pages.length + 1}`, ...params.data });
          return pages[pages.length - 1];
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
  return { strapi, creates, store };
}

describe('seedPage — generic idempotent page seed', () => {
  it('creates the page as a DRAFT on a fresh DB and marks the flag done', async () => {
    const { strapi, creates, store } = fakeStrapi();
    await seedPage(strapi, OPTS);
    expect(creates).toEqual([{ data: { title: OPTS.title, slug: OPTS.slug, body: OPTS.body } }]);
    // DRAFT: create carries no publish signal for an editor to review first.
    expect(creates[0].data).not.toHaveProperty('publishedAt');
    expect(creates[0].data).not.toHaveProperty('status');
    expect(store.get('demoPageSeeded')).toBe(true);
  });

  it('respects an adopter page already on the slug — no create, flag still set', async () => {
    const { strapi, creates, store } = fakeStrapi([{ documentId: 'doc-9', slug: 'demo' }]);
    await seedPage(strapi, OPTS);
    expect(creates).toEqual([]);
    expect(store.get('demoPageSeeded')).toBe(true);
  });

  it('is a no-op once the flag is set — editor-deleted page respected forever', async () => {
    const { strapi, creates } = fakeStrapi([], { demoPageSeeded: true });
    await seedPage(strapi, OPTS);
    expect(creates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates } = fakeStrapi();
    await seedPage(strapi, OPTS);
    await seedPage(strapi, OPTS);
    await seedPage(strapi, OPTS);
    expect(creates).toHaveLength(1);
  });
});
