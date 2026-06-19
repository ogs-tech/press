import type { Core } from '@strapi/strapi';

/** UID of the engine's theme collection-type (plugin name `press-cms`). */
export const THEME_UID = 'plugin::press-cms.theme';

/**
 * Seeds exactly one active "Default" theme on a fresh DB (Spec §7). Idempotent:
 * if any theme already exists, it does nothing — a re-run (every bootstrap)
 * leaves exactly one active theme, never two. This owns the editorial SELECTION
 * surface only; token VALUES still come from press.config.ts (Spec §12 seam).
 */
export async function seedDefaultTheme(strapi: Core.Strapi): Promise<void> {
  const existing = await strapi.documents(THEME_UID).count({});
  if (existing > 0) return;
  await strapi.documents(THEME_UID).create({
    data: { name: 'Default', active: true },
  });
}
