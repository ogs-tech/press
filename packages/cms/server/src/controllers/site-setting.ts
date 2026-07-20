import type { Core } from '@strapi/strapi';
import { hydrateSiteSetting } from '../lib/serve-hydrated';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) and returns it under
 * `{ data }` — the wire shape the web resolver (`getSiteConfig`) maps.
 *
 * The engine owns the populate (Spec §5.1 of the site-settings spec): `ctx.query`
 * is NOT honored (public `auth: false` route). `populate: '*'` is SHALLOW, so
 * `seo.image` is deep-populated explicitly. `pageDefaults` is a JSON custom field
 * (Spec §4) — a scalar on the wire, no populate key needed.
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => {
  const settingsPopulate = () => ({
    logo: true,
    favicon: true,
    seo: { populate: { image: true } },
    themeColors: true,
    themeRadius: true,
    // Nested category components + the privacy page's slug sit one level below
    // what a shallow populate reaches — same reason as seo.image above.
    cookieConsent: {
      populate: {
        necessary: true,
        analytics: true,
        marketing: true,
        privacyPage: { fields: ['slug'] },
      },
    },
  });

  return {
    async find(ctx: any) {
      const data = await strapi
        .documents(SITE_SETTING_UID as any)
        .findFirst({ populate: settingsPopulate() as any });
      ctx.body = { data: await hydrateSiteSetting(strapi, data as any) };
    },
  };
};

export default siteSetting;
