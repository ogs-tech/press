import type { Core } from '@strapi/strapi';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * Explicit populate for the Site Settings wire shape (Spec §5.1). Computed
 * server-side — the engine owns the shape, like the page controller's
 * `bodyPopulate()`; `ctx.query` is NOT honored (public `auth: false` routes).
 *
 * `populate: '*'` is SHALLOW: it brings first-level relations/components but NOT
 * relations/media nested *inside* a component. So `headerNav.page` (the internal
 * page link, resolved to its slug) and `seo.image` (the OG image) must be
 * deep-populated explicitly — without this, every internal nav link silently
 * falls back to its raw `url` field.
 */
const SITE_SETTING_POPULATE = {
  logo: true,
  favicon: true,
  seo: { populate: { image: true } },
  themeColors: true,
  themeRadius: true,
  headerNav: { populate: { page: { fields: ['slug'] } } },
} as const;

/**
 * Engine-owned single-type controller. Reads the one always-live Site Settings
 * record (draftAndPublish: false → no published filter) and returns it under
 * `{ data }` — the wire shape the web resolver (`getSiteConfig`) maps. A fresh DB
 * returns the empty seeded record; the editor fills it in the admin (Spec §3, §5).
 */
const siteSetting = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const data = await strapi
      .documents(SITE_SETTING_UID as any)
      .findFirst({ populate: SITE_SETTING_POPULATE as any });
    ctx.body = { data };
  },
});

export default siteSetting;
