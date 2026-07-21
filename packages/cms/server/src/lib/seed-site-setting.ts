import { randomUUID } from 'node:crypto';
import type { Core } from '@strapi/strapi';
import { pluginStore } from './plugin-store';

/** UID of the engine's Site Settings single type (plugin name `press-cms`). */
export const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

const PAGE_DEFAULTS_SEED_KEY = 'pageDefaultsSeeded';

/**
 * Default chrome (Spec §4): a bare navbar and a bare footer BlockNode per slot.
 * BARE on purpose (no items/cta/text) — the CLI's seed.mjs fills demo content;
 * "no defaults duplicated in the CMS". Fresh ids per call: node ids are
 * builder-scoped React keys, never identity.
 */
export const buildDefaultPageDefaults = () => ({
  header: [{ id: randomUUID(), type: 'block', component: 'preset-organism.navbar', data: {} }],
  footer: [{ id: randomUUID(), type: 'block', component: 'preset-organism.footer', data: {} }],
});

/**
 * Seeds Site Settings pageDefaults exactly once (plugin-store flag): Strapi
 * cannot distinguish a never-touched slot from an editor-emptied one (both read
 * back as []), so after the one seeding pass the slots are never written again.
 */
export async function seedSiteSetting(strapi: Core.Strapi): Promise<void> {
  const docs = strapi.documents(SITE_SETTING_UID);
  const store = pluginStore(strapi);

  // pageDefaults is a JSON scalar — visible without populate.
  const existing = (await docs.findFirst()) as any;

  if (!existing) {
    await docs.create({ data: { pageDefaults: buildDefaultPageDefaults() } as any });
  } else if (!(await store.get({ key: PAGE_DEFAULTS_SEED_KEY }))) {
    const pd = (existing.pageDefaults ?? {}) as { header?: unknown[]; footer?: unknown[] };
    const defaults = buildDefaultPageDefaults();
    const next: Record<string, unknown> = { ...pd };
    let changed = false;
    if (!Array.isArray(pd.header) || pd.header.length === 0) { next.header = defaults.header; changed = true; }
    if (!Array.isArray(pd.footer) || pd.footer.length === 0) { next.footer = defaults.footer; changed = true; }
    if (changed) {
      await docs.update({ documentId: existing.documentId, data: { pageDefaults: next } as any });
    }
  } else {
    return; // seeded before — never touch the defaults again
  }

  await store.set({ key: PAGE_DEFAULTS_SEED_KEY, value: true });
}
