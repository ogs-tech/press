import type { Core } from '@strapi/strapi';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const PLUGIN_UID = 'plugin::press-cms.plugin';

/** A live Site Settings record, populated exactly enough for readEnabled below. */
interface SiteSettingSnapshot {
  examplePlugin?: { enabled?: boolean } | null;
  seo?: { enabled?: boolean } | null;
  legalPages?: { enabled?: boolean } | null;
  cookieConsent?: { enabled?: boolean } | null;
}

interface PluginDefinition {
  id: string;
  label: string;
  configHost: string;
  /** Mirrors the plugin's own DEFAULT_<PLUGIN>.enabled (web) — kept in sync by hand (base-plugin Spec §4). */
  defaultEnabled: boolean;
  /** No generic configHost string-path walker (base-plugin Spec §4 trade-off) — each plugin hand-writes its own read. */
  readEnabled: (site: SiteSettingSnapshot | null) => boolean | undefined;
}

/**
 * Every engine plugin the Content-Manager index mirrors (base-plugin Spec
 * §4). Adding a plugin here is the "+1 PLUGIN_DEFINITIONS entry" line
 * CLAUDE.md's "Engine plugins" section tracks, on top of the wiring in
 * map-example-plugin.ts.
 */
export const PLUGIN_DEFINITIONS: PluginDefinition[] = [
  {
    id: 'example',
    label: 'Example Plugin',
    configHost: 'site-setting.examplePlugin',
    defaultEnabled: false,
    readEnabled: (site) => site?.examplePlugin?.enabled,
  },
  {
    id: 'seo',
    label: 'SEO & Social',
    configHost: 'site-setting.seo',
    defaultEnabled: true,
    readEnabled: (site) => site?.seo?.enabled,
  },
  {
    id: 'legal-pages',
    label: 'Legal Pages',
    configHost: 'site-setting.legalPages',
    defaultEnabled: true,
    readEnabled: (site) => site?.legalPages?.enabled,
  },
  {
    id: 'legal-consent',
    label: 'Cookie Consent',
    configHost: 'site-setting.cookieConsent',
    defaultEnabled: true,
    readEnabled: (site) => site?.cookieConsent?.enabled,
  },
];

/**
 * Upserts one row per PLUGIN_DEFINITIONS entry into the read-only `plugin`
 * collection type — a VIEW, never a second source of truth (base-plugin
 * Spec §4). Runs every boot (not seed-once): an editor's Site Settings
 * toggle must not go stale under a run-once flag, though the mirror still
 * only refreshes on the NEXT boot (accepted limitation, no lifecycle-hook
 * refresh here).
 */
export async function syncPluginEntries(strapi: Core.Strapi): Promise<void> {
  const site = (await strapi
    .documents(SITE_SETTING_UID as any)
    .findFirst({ populate: { examplePlugin: true, seo: true, legalPages: true, cookieConsent: true } as any })) as SiteSettingSnapshot | null;

  const docs = strapi.documents(PLUGIN_UID as any);

  for (const def of PLUGIN_DEFINITIONS) {
    const enabled = def.readEnabled(site) ?? def.defaultEnabled;
    const data = { pluginId: def.id, label: def.label, configHost: def.configHost, enabled };
    const existing = (await docs.findFirst({ filters: { pluginId: def.id } } as any)) as { documentId: string } | null;
    if (!existing) {
      await docs.create({ data } as any);
    } else {
      await docs.update({ documentId: existing.documentId, data } as any);
    }
  }
}
