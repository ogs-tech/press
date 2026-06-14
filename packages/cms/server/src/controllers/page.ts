import type { Core } from '@strapi/strapi';
import { buildBodyPopulate } from '../lib/dz-populate';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * Engine-owned page controller. The adopter never defines this — it ships the
 * wire shape the front-end consumes (Spec §5.1).
 *
 * Published-only + 404 (Spec decision 2026-06-11): every read filters to the
 * published view; a missing/unpublished slug is a 404, surfaced by `getPage` as
 * the App Router's notFound().
 */
const page = ({ strapi }: { strapi: Core.Strapi }) => {
  // Returns the document-service `populate` VALUE for the page body DZ — i.e.
  // `{ body: { on: {...} } }`. It must be assigned to the `populate` KEY of the
  // query (not spread into the query root); spreading drops it and Strapi omits
  // the dynamic zone entirely from the response.
  const bodyPopulate = () => {
    const ct = strapi.contentType(PAGE_UID as any) as any;
    const components: string[] = ct?.attributes?.body?.components ?? [];
    return buildBodyPopulate(components);
  };

  return {
    async find(ctx: any) {
      const data = await strapi.documents(PAGE_UID as any).findMany({
        status: 'published',
        populate: bodyPopulate(),
      });
      ctx.body = { data };
    },

    async findOne(ctx: any) {
      const { slug } = ctx.params;
      const [doc] = await strapi.documents(PAGE_UID as any).findMany({
        filters: { slug },
        status: 'published',
        limit: 1,
        populate: bodyPopulate(),
      });
      if (!doc) return ctx.notFound();
      ctx.body = { data: doc };
    },
  };
};

export default page;
