import { describe, expect, it } from 'vitest';
import { syncPluginEntries, PLUGIN_DEFINITIONS } from './sync-plugin-entries';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const PLUGIN_UID = 'plugin::press-cms.plugin';

/** Minimal Document-Service fake covering both UIDs sync-plugin-entries reads/writes. */
function fakeStrapi(siteSetting: any = null, pluginRows: Record<string, any> = {}) {
  const creates: Array<{ data: any }> = [];
  const updates: Array<{ documentId: string; data: any }> = [];
  const rows = new Map<string, any>(Object.entries(pluginRows));
  const strapi = {
    documents: (uid: string) => {
      if (uid === SITE_SETTING_UID) {
        return { findFirst: async () => siteSetting };
      }
      if (uid === PLUGIN_UID) {
        return {
          findFirst: async ({ filters }: { filters: { pluginId: string } }) => rows.get(filters.pluginId) ?? null,
          create: async (params: { data: any }) => {
            creates.push(params);
            const doc = { documentId: `doc-${params.data.pluginId}`, ...params.data };
            rows.set(params.data.pluginId, doc);
            return doc;
          },
          update: async (params: { documentId: string; data: any }) => {
            updates.push(params);
            const existing = [...rows.values()].find((r) => r.documentId === params.documentId);
            const doc = { ...existing, ...params.data };
            rows.set(params.data.pluginId, doc);
            return doc;
          },
        };
      }
      throw new Error(`unexpected uid ${uid}`);
    },
  } as any;
  return { strapi, creates, updates, rows };
}

describe('syncPluginEntries (base-plugin Spec §4)', () => {
  it('creates one row per PLUGIN_DEFINITIONS entry on a fresh DB, defaultEnabled when Site Settings is null', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    expect(creates).toHaveLength(PLUGIN_DEFINITIONS.length);
    expect(creates[0].data).toEqual({
      pluginId: 'example',
      label: 'Example Plugin',
      configHost: 'site-setting.examplePlugin',
      enabled: false,
    });
  });

  it('mirrors the live Site Settings enabled value on create', async () => {
    const { strapi, creates } = fakeStrapi({ examplePlugin: { enabled: true } });
    await syncPluginEntries(strapi);
    expect(creates[0].data.enabled).toBe(true);
  });

  it('creates the seo entry with defaultEnabled true when Site Settings is null (plugin-seo Spec §4)', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    const seoEntry = creates.find((c) => c.data.pluginId === 'seo');
    expect(seoEntry?.data).toEqual({
      pluginId: 'seo',
      label: 'SEO & Social',
      configHost: 'site-setting.seo',
      enabled: true,
    });
  });

  it('mirrors the live Site Settings seo.enabled value on create', async () => {
    const { strapi, creates } = fakeStrapi({ seo: { enabled: false } });
    await syncPluginEntries(strapi);
    const seoEntry = creates.find((c) => c.data.pluginId === 'seo');
    expect(seoEntry?.data.enabled).toBe(false);
  });

  it('updates the existing row on the next boot instead of creating a duplicate (idempotent upsert)', async () => {
    const { strapi, creates, updates } = fakeStrapi(
      { examplePlugin: { enabled: true } },
      {
        example: {
          documentId: 'doc-example',
          pluginId: 'example',
          label: 'Example Plugin',
          configHost: 'site-setting.examplePlugin',
          enabled: false,
        },
        seo: {
          documentId: 'doc-seo',
          pluginId: 'seo',
          label: 'SEO & Social',
          configHost: 'site-setting.seo',
          enabled: true,
        },
        'legal-pages': {
          documentId: 'doc-legal-pages',
          pluginId: 'legal-pages',
          label: 'Legal Pages',
          configHost: 'site-setting.legalPages',
          enabled: true,
        },
        'legal-consent': {
          documentId: 'doc-legal-consent',
          pluginId: 'legal-consent',
          label: 'Cookie Consent',
          configHost: 'site-setting.cookieConsent',
          enabled: true,
        },
      },
    );
    await syncPluginEntries(strapi);
    expect(creates).toEqual([]);
    expect(updates).toHaveLength(4);
    const exampleUpdate = updates.find((u) => u.data.pluginId === 'example');
    expect(exampleUpdate).toEqual({
      documentId: 'doc-example',
      data: { pluginId: 'example', label: 'Example Plugin', configHost: 'site-setting.examplePlugin', enabled: true },
    });
  });

  it('falls back to defaultEnabled when the Site Settings record has no examplePlugin component', async () => {
    const { strapi, creates } = fakeStrapi({});
    await syncPluginEntries(strapi);
    const exampleEntry = creates.find((c) => c.data.pluginId === 'example');
    expect(exampleEntry?.data.enabled).toBe(false);
  });

  it('creates the legal-pages entry with defaultEnabled true when Site Settings is null (Plugin/Legal Spec §2)', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    const entry = creates.find((c) => c.data.pluginId === 'legal-pages');
    expect(entry?.data).toEqual({
      pluginId: 'legal-pages',
      label: 'Legal Pages',
      configHost: 'site-setting.legalPages',
      enabled: true,
    });
  });

  it('creates the legal-consent entry with defaultEnabled true when Site Settings is null', async () => {
    const { strapi, creates } = fakeStrapi(null);
    await syncPluginEntries(strapi);
    const entry = creates.find((c) => c.data.pluginId === 'legal-consent');
    expect(entry?.data).toEqual({
      pluginId: 'legal-consent',
      label: 'Cookie Consent',
      configHost: 'site-setting.cookieConsent',
      enabled: true,
    });
  });

  it('mirrors the live Site Settings legalPages.enabled and cookieConsent.enabled values on create', async () => {
    const { strapi, creates } = fakeStrapi({ legalPages: { enabled: false }, cookieConsent: { enabled: false } });
    await syncPluginEntries(strapi);
    expect(creates.find((c) => c.data.pluginId === 'legal-pages')?.data.enabled).toBe(false);
    expect(creates.find((c) => c.data.pluginId === 'legal-consent')?.data.enabled).toBe(false);
  });
});
