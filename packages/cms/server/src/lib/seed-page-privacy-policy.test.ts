import { describe, expect, it } from 'vitest';
import { PAGE_UID, PRIVACY_PAGE, seedPrivacyPolicyPage } from './seed-page-privacy-policy';

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
          // The seed must look up by slug — anything else could match the wrong page.
          expect(params?.filters).toMatchObject({ slug: PRIVACY_PAGE.slug });
          return pages.find((page) => page.slug === PRIVACY_PAGE.slug) ?? null;
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

describe('seedPrivacyPolicyPage — page template seed', () => {
  it('creates the template page on a fresh DB and marks the seed done', async () => {
    const { strapi, creates, store } = fakeStrapi();
    await seedPrivacyPolicyPage(strapi);
    expect(creates).toEqual([{ data: PRIVACY_PAGE }]);
    expect(store.get('privacyPageSeeded')).toBe(true);
  });

  it('never publishes — the created data carries no publishedAt/status', async () => {
    // The engine seeds a DRAFT: documents.create without publish leaves the
    // page unpublished for an editor to review the placeholders first.
    const { strapi, creates } = fakeStrapi();
    await seedPrivacyPolicyPage(strapi);
    expect(creates[0].data).not.toHaveProperty('publishedAt');
    expect(creates[0].data).not.toHaveProperty('status');
  });

  it('composes the body from press.* atoms only (structure + placeholders)', async () => {
    const components = new Set(PRIVACY_PAGE.body.map((block: any) => block.__component));
    expect([...components].sort()).toEqual(['press.heading', 'press.paragraph']);

    // press.paragraph content is Strapi rich-text blocks JSON, not a plain string.
    const firstParagraph = PRIVACY_PAGE.body.find((b: any) => b.__component === 'press.paragraph') as any;
    expect(firstParagraph.content[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text' }],
    });

    // Section headings sit under the page title: level 2, standard sections present.
    const headings = PRIVACY_PAGE.body.filter((b: any) => b.__component === 'press.heading') as any[];
    expect(headings.every((h) => h.level === '2')).toBe(true);
    expect(headings.map((h) => h.text)).toContain('Your Rights');
  });

  it('respects an adopter page already occupying the slug — no create, seed marked done', async () => {
    const { strapi, creates, store } = fakeStrapi([{ documentId: 'doc-9', slug: 'privacy-policy' }]);
    await seedPrivacyPolicyPage(strapi);
    expect(creates).toEqual([]);
    expect(store.get('privacyPageSeeded')).toBe(true);
  });

  it('respects an editor-deleted page once the seed has run (flag set → no writes)', async () => {
    const { strapi, creates } = fakeStrapi([], { privacyPageSeeded: true });
    await seedPrivacyPolicyPage(strapi);
    expect(creates).toEqual([]);
  });

  it('is idempotent across repeated runs — one create, no later writes', async () => {
    const { strapi, creates } = fakeStrapi();
    await seedPrivacyPolicyPage(strapi);
    await seedPrivacyPolicyPage(strapi);
    await seedPrivacyPolicyPage(strapi);
    expect(creates).toHaveLength(1);
  });
});
