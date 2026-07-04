import { describe, expect, it } from 'vitest';
import { DEFAULT_COOKIE_CONSENT_SEED, seedCookieConsent } from './seed-cookie-consent';
import { SITE_SETTING_UID } from './seed-site-setting';

/**
 * Same fake shape as seed-site-setting.test.ts: a mutable record, recorded
 * updates, and a Map-backed plugin store for the run-once flag.
 */
function fakeStrapi(record: any = null, flags: Record<string, unknown> = {}) {
  const updates: Array<{ documentId: string; data: unknown }> = [];
  let current = record;
  const store = new Map<string, unknown>(Object.entries(flags));
  const strapi = {
    documents: (uid: string) => {
      expect(uid).toBe(SITE_SETTING_UID);
      return {
        findFirst: async (params: any) => {
          // The component is invisible without populate — pin that the seed asks.
          expect(params?.populate).toMatchObject({ cookieConsent: true });
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
  return { strapi, updates, store };
}

describe('seedCookieConsent (cookie-consent Spec §4)', () => {
  it('seeds only the enabled booleans on a record with no cookie-consent component', async () => {
    const { strapi, updates, store } = fakeStrapi({ documentId: 'doc-1', cookieConsent: null });
    await seedCookieConsent(strapi);
    expect(updates).toEqual([{ documentId: 'doc-1', data: { cookieConsent: DEFAULT_COOKIE_CONSENT_SEED } }]);
    // Booleans only — no default copy duplicated into the CMS (Spec §4).
    expect(DEFAULT_COOKIE_CONSENT_SEED).toEqual({
      enabled: true,
      necessary: { enabled: true },
      analytics: { enabled: true },
      marketing: { enabled: true },
    });
    expect(store.get('cookieConsentSeeded')).toBe(true);
  });

  it('never overwrites an existing component (editor or earlier pass) and still marks the seed done', async () => {
    const authored = { enabled: false, title: 'Custom' };
    const { strapi, updates, store } = fakeStrapi({ documentId: 'doc-1', cookieConsent: authored });
    await seedCookieConsent(strapi);
    expect(updates).toEqual([]);
    expect(store.get('cookieConsentSeeded')).toBe(true);
  });

  it('respects an editor-removed component once the flag is set (no reads beyond the flag, no writes)', async () => {
    const { strapi, updates } = fakeStrapi(
      { documentId: 'doc-1', cookieConsent: null },
      { cookieConsentSeeded: true },
    );
    await seedCookieConsent(strapi);
    expect(updates).toEqual([]);
  });

  it('does NOT set the flag when the Site Settings record is absent — self-heals next boot', async () => {
    const { strapi, updates, store } = fakeStrapi(null);
    await seedCookieConsent(strapi);
    expect(updates).toEqual([]);
    expect(store.get('cookieConsentSeeded')).toBeUndefined();
  });

  it('is idempotent across repeated runs — one update, never more', async () => {
    const { strapi, updates } = fakeStrapi({ documentId: 'doc-1', cookieConsent: null });
    await seedCookieConsent(strapi);
    await seedCookieConsent(strapi);
    await seedCookieConsent(strapi);
    expect(updates).toHaveLength(1);
  });
});
