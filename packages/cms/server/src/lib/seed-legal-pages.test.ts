import { describe, expect, it } from 'vitest';
import { validatePressTree } from '@ogs-tech/press-shared';
import { seedLegalPages } from './seed-legal-pages';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const PAGE_UID = 'plugin::press-cms.page';

/** Minimal fake covering both UIDs seedLegalPages reads/writes (via seedPage), plus the plugin store. */
function fakeStrapi(siteSetting: any = null, pages: any[] = [], flags: Record<string, unknown> = {}) {
  const creates: Array<{ data: any }> = [];
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      if (uid === SITE_SETTING_UID) {
        return { findFirst: async () => siteSetting };
      }
      if (uid === PAGE_UID) {
        return {
          findFirst: async ({ filters }: { filters: { slug: string } }) =>
            pages.find((p) => p.slug === filters.slug) ?? null,
          create: async (params: { data: any }) => {
            creates.push(params);
            pages.push({ documentId: `doc-${pages.length + 1}`, ...params.data });
            return pages[pages.length - 1];
          },
        };
      }
      throw new Error(`unexpected uid ${uid}`);
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

describe('seedLegalPages (Plugin/Legal Spec §3)', () => {
  it('seeds the privacy-policy page as a DRAFT when legalPages is absent (defaults to enabled)', async () => {
    const { strapi, creates, store } = fakeStrapi(null);
    await seedLegalPages(strapi);
    expect(creates).toHaveLength(1);
    expect(creates[0].data.slug).toBe('privacy-policy');
    expect(creates[0].data.title).toBe('Privacy Policy');
    expect(creates[0].data).not.toHaveProperty('publishedAt');
    expect(store.get('legalPrivacyPolicySeeded')).toBe(true);
  });

  it('seeds when legalPages.enabled is explicitly true', async () => {
    const { strapi, creates } = fakeStrapi({ legalPages: { enabled: true } });
    await seedLegalPages(strapi);
    expect(creates).toHaveLength(1);
  });

  it('does not seed when legalPages.enabled is explicitly false (gate respected)', async () => {
    const { strapi, creates, store } = fakeStrapi({ legalPages: { enabled: false } });
    await seedLegalPages(strapi);
    expect(creates).toEqual([]);
    expect(store.get('legalPrivacyPolicySeeded')).toBeUndefined();
  });

  it('builds a valid PressTree body — heading + paragraph under an inherited header/footer', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await seedLegalPages(strapi);
    const body = creates[0].data.body;
    expect(body.version).toBe(2);
    expect(body.root.header).toEqual({ mode: 'inherit' });
    expect(body.root.footer).toEqual({ mode: 'inherit' });
    expect(body.root.children).toHaveLength(2);
    expect(body.root.children[0]).toMatchObject({
      type: 'block',
      component: 'preset-atom.heading',
      data: { text: 'Privacy Policy', level: '1' },
    });
    expect(body.root.children[1]).toMatchObject({ type: 'block', component: 'preset-atom.paragraph' });
  });

  it('is idempotent across repeated boots — one create only', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await seedLegalPages(strapi);
    await seedLegalPages(strapi);
    expect(creates).toHaveLength(1);
  });

  it('produces a body that the real validatePressTree accepts with no errors/warnings — the fake strapi here bypasses the beforeCreate lifecycle guard (assertValidPageWrite), same caveat seed-page.test.ts documents, so this test is the one place that actually proves a real write would not be rejected', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await seedLegalPages(strapi);
    const { errors, warnings } = validatePressTree(creates[0].data.body);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('respects an adopter page already on the privacy-policy slug — no create, flag still set', async () => {
    const { strapi, creates, store } = fakeStrapi(null, [{ documentId: 'doc-9', slug: 'privacy-policy' }]);
    await seedLegalPages(strapi);
    expect(creates).toEqual([]);
    expect(store.get('legalPrivacyPolicySeeded')).toBe(true);
  });
});
