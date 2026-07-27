import type { Core } from '@strapi/strapi';
import { seedSiteSetting } from './lib/seed-site-setting';
import { syncPluginEntries } from './lib/sync-plugin-entries';
import { assertValidPageWrite, assertValidSiteSettingWrite } from './lib/validate-write';

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  // Write-path backstop (Spec §4): the admin builder can't produce an invalid
  // tree; raw API writes are rejected here with actionable messages.
  const guard = (event: any): void => {
    if (event.model?.uid === 'plugin::press-cms.page') assertValidPageWrite(event.params?.data);
    else assertValidSiteSettingWrite(event.params?.data);
  };
  strapi.db.lifecycles.subscribe({
    models: ['plugin::press-cms.page', 'plugin::press-cms.site-setting'],
    beforeCreate(event: any) {
      guard(event);
    },
    beforeUpdate(event: any) {
      guard(event);
    },
  } as any);

  await seedSiteSetting(strapi);
  // Last (Spec §4): the CM plugin index mirrors whatever Site Settings holds
  // after seeding, and runs every boot (not seed-once) so an editor toggle is
  // never permanently stale.
  await syncPluginEntries(strapi);
};

export default bootstrap;
