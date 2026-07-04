import type { Core } from '@strapi/strapi';
import { buildChromeDzPopulate } from '../lib/dz-populate';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) and returns it under
 * `{ data }` — the wire shape the web resolver (`getSiteConfig`) maps.
 *
 * The engine owns the populate (Spec §5.1 of the site-settings spec): `ctx.query`
 * is NOT honored (public `auth: false` route). `populate: '*'` is SHALLOW, so
 * `seo.image` and the chrome DZs' nested content (`chrome.navbar` items.page +
 * cta) are deep-populated explicitly. The chrome DZ component lists are read from
 * the live content-type at request time — like the page controller — so admitted
 * custom.* blocks populate too.
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => {
  const chromePopulate = () => {
    const ct = strapi.contentType(SITE_SETTING_UID as any) as any;
    const header: string[] = ct?.attributes?.header?.components ?? [];
    const footer: string[] = ct?.attributes?.footer?.components ?? [];
    return {
      logo: true,
      favicon: true,
      seo: { populate: { image: true } },
      themeColors: true,
      themeRadius: true,
      header: buildChromeDzPopulate(header),
      footer: buildChromeDzPopulate(footer),
    };
  };

  return {
    async find(ctx: any) {
      const data = await strapi
        .documents(SITE_SETTING_UID as any)
        .findFirst({ populate: chromePopulate() as any });
      ctx.body = { data };
    },
  };
};

export default siteSetting;
