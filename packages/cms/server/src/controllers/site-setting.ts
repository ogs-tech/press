import type { Core } from '@strapi/strapi';
import { hydrateSiteSetting } from '../lib/serve-hydrated';
import { LAYOUT_POPULATE } from '../lib/read-layout-defaults';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) and returns it under
 * `{ data }` — the wire shape the web resolver (`getSiteConfig`) maps.
 *
 * The engine owns the populate (Spec §5.1 of the site-settings spec): `ctx.query`
 * is NOT honored (public `auth: false` route). `populate: '*'` is SHALLOW, so
 * `basicSettings`'s media fields and its nested `themeAdvanced` component are
 * deep-populated explicitly. `pageDefaults` is a JSON custom field (Spec §4) —
 * a scalar on the wire, no populate key needed.
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => {
  const settingsPopulate = () => ({
    basicSettings: {
      populate: {
        logo: true,
        favicon: true,
        themeAdvanced: true,
      },
    },
    // The layout group holds one component per tree level, and a shallow populate
    // stops at the group — same reason as basicSettings above.
    layout: { populate: LAYOUT_POPULATE },
    // examplePlugin is a flat scalar component (enabled/message) — no media or
    // nested component to deep-populate, so a shallow `true` is enough.
    examplePlugin: true,
    // seo carries one media field (ogImage) plus the nested social component —
    // both need explicit populate, same reason as basicSettings above.
    seo: { populate: { ogImage: true, social: true } },
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
