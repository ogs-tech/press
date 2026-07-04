import type { Core } from '@strapi/strapi';
import { pluginStore } from './plugin-store';
import { SITE_SETTING_UID } from './seed-site-setting';

const COOKIE_CONSENT_SEED_KEY = 'cookieConsentSeeded';

/**
 * Only the booleans are seeded (cookie-consent Spec §4): an unsaved Strapi
 * boolean renders as an unchecked toggle in the admin, contradicting the live
 * site's enabled-by-default banner. Text fields stay empty on purpose — the
 * default copy lives web-side only ("no defaults duplicated in the CMS",
 * seed-site-setting precedent).
 */
export const DEFAULT_COOKIE_CONSENT_SEED = {
  enabled: true,
  necessary: { enabled: true },
  analytics: { enabled: true },
  marketing: { enabled: true },
};

/**
 * Seeds the cookie-consent component on Site Settings exactly once (Spec §4),
 * with the same plugin-store-flag semantics as the chrome seed: after the one
 * pass, an editor-disabled or editor-emptied component is respected forever.
 *
 * Depends on seedSiteSetting (bootstrap.ts order) having created the record.
 * If it is somehow absent, this returns WITHOUT setting the flag so the seed
 * self-heals on the next boot instead of silently skipping forever.
 */
export async function seedCookieConsent(strapi: Core.Strapi): Promise<void> {
  const store = pluginStore(strapi);
  if (await store.get({ key: COOKIE_CONSENT_SEED_KEY })) return;

  const docs = strapi.documents(SITE_SETTING_UID);
  // The component is invisible without populate — findFirst({}) would report it
  // as undefined and the seed could clobber a real editor-authored component.
  const existing = (await docs.findFirst({ populate: { cookieConsent: true } as any })) as any;
  if (!existing) return;

  if (!existing.cookieConsent) {
    await docs.update({
      documentId: existing.documentId,
      data: { cookieConsent: DEFAULT_COOKIE_CONSENT_SEED } as any,
    });
  }

  await store.set({ key: COOKIE_CONSENT_SEED_KEY, value: true });
}
