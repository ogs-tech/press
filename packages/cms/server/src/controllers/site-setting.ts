import type { Core } from '@strapi/strapi';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) with every relation and
 * component populated, and returns it under `{ data }` — the wire shape the web
 * resolver (`getSiteConfig`) maps. A fresh DB returns the empty seeded record;
 * the editor fills it in the admin (Spec §3, §5).
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const data = await strapi.documents(SITE_SETTING_UID as any).findFirst({ populate: '*' });
    ctx.body = { data };
  },
});

export default siteSetting;
