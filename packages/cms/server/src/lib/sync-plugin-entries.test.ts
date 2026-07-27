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
      },
    );
    await syncPluginEntries(strapi);
    expect(creates).toEqual([]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      documentId: 'doc-example',
      data: { pluginId: 'example', label: 'Example Plugin', configHost: 'site-setting.examplePlugin', enabled: true },
    });
  });

  it('falls back to defaultEnabled when the Site Settings record has no examplePlugin component', async () => {
    const { strapi, creates } = fakeStrapi({});
    await syncPluginEntries(strapi);
    expect(creates[0].data.enabled).toBe(false);
  });
});
