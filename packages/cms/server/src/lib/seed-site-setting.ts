import type { Core } from '@strapi/strapi';
import { pluginStore } from './plugin-store';

/** UID of the engine's Site Settings single type (plugin name `press-cms`). */
export const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/** Default chrome composition (Spec §4): a navbar (empty items) + a footer (empty text). */
export const DEFAULT_CHROME = {
  header: [{ __component: 'chrome.navbar' }],
  footer: [{ __component: 'chrome.footer' }],
};

const CHROME_SEED_KEY = 'chromeSeeded';

/**
 * Seeds the Site Settings single type (Spec §4/§5 of the site-settings spec):
 *
 * 1. Fresh DB → exactly one record, created WITH the default chrome composition.
 *    Identity/SEO stay empty on purpose: no defaults duplicated in the CMS.
 * 2. Existing record (upgrade path: the chrome DZs just appeared via schema
 *    sync) → a single seeding pass fills each still-empty DZ.
 *
 * "Runs once; never overwrites" (Spec §4) is made literal with a plugin-store
 * flag: Strapi cannot distinguish a never-touched DZ from an editor-emptied one
 * (both read back as []), so after the one seeding pass the DZs are never
 * written again — an editor-emptied [] is respected forever.
 */
export async function seedSiteSetting(strapi: Core.Strapi): Promise<void> {
  const docs = strapi.documents(SITE_SETTING_UID);
  const store = pluginStore(strapi);

  // DZ content is invisible without populate — findFirst({}) would report the
  // zones as undefined and the seed could clobber real content.
  const existing = (await docs.findFirst({ populate: { header: true, footer: true } as any })) as any;

  if (!existing) {
    await docs.create({ data: { ...DEFAULT_CHROME } as any });
  } else if (!(await store.get({ key: CHROME_SEED_KEY }))) {
    const data: Record<string, unknown> = {};
    if (!existing.header?.length) data.header = DEFAULT_CHROME.header;
    if (!existing.footer?.length) data.footer = DEFAULT_CHROME.footer;
    if (Object.keys(data).length > 0) {
      await docs.update({ documentId: existing.documentId, data: data as any });
    }
  } else {
    return; // seeded before — never touch the chrome again
  }

  await store.set({ key: CHROME_SEED_KEY, value: true });
}
