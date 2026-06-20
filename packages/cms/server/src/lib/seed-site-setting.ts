import type { Core } from '@strapi/strapi';

/** UID of the engine's Site Settings single type (plugin name `press-cms`). */
export const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Seeds exactly one EMPTY Site Settings record on a fresh DB (Spec §5).
 * Idempotent: if a record already exists, does nothing — a re-run (every
 * bootstrap) leaves exactly one record, never two. Empty is intentional: no
 * defaults are duplicated in the CMS. The editor fills identity/SEO on first
 * registration; unset theme tokens resolve over DEFAULT_THEME at read time
 * (`mapSiteSettings`).
 */
export async function seedSiteSetting(strapi: Core.Strapi): Promise<void> {
  const existing = await strapi.documents(SITE_SETTING_UID).count({});
  if (existing > 0) return;
  await strapi.documents(SITE_SETTING_UID).create({ data: {} });
}
