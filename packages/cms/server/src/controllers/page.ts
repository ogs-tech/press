import type { Core } from '@strapi/strapi';
import { hydratePageDoc, hydratePageDocs } from '../lib/serve-hydrated';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * Engine-owned page controller. `body` is a JSON custom field now — no dynamic
 * zone, no populate tree: the whole "vanished from the wire but visible in the
 * admin" bug class is gone (Spec §4). Published-only + 404 semantics unchanged.
 * Media/page-ref hydration is layered on in lib/serve-hydrated (Task 6).
 */
const page = ({ strapi }: { strapi: Core.Strapi }) => ({
  async find(ctx: any) {
    const data = await strapi.documents(PAGE_UID as any).findMany({ status: 'published' });
    ctx.body = { data: await hydratePageDocs(strapi, data as any[]) };
  },

  async findOne(ctx: any) {
    const { slug } = ctx.params;
    const [doc] = await strapi.documents(PAGE_UID as any).findMany({
      filters: { slug },
      status: 'published',
      limit: 1,
    });
    if (!doc) return ctx.notFound();
    ctx.body = { data: await hydratePageDoc(strapi, doc as any) };
  },
});

export default page;
