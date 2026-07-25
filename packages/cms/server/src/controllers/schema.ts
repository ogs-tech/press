import type { Core } from '@strapi/strapi';
import { serializeSchema } from '../lib/serialize-schema';
import { readLayoutDefaults } from '../lib/read-layout-defaults';

/**
 * Public, versioned type-sync source of truth (Spec §5.2). Returns the engine's
 * runtime registry view; `@ogs-tech/press-web sync-types` fetches this to generate types.
 *
 * The registry view stays synchronous and DB-free (`serializeSchema`); the
 * CMS-owned layout defaults are merged in HERE, one level up (layout-defaults
 * spec §4), so the builder learns them from the ONE fetch it already makes.
 * Editable values on this endpoint are why `watchSchema` compares only the
 * type-relevant slice of the body — see web/src/util/watch-schema.ts.
 */
const schema = ({ strapi }: { strapi: Core.Strapi }) => ({
  async get(ctx: any) {
    ctx.body = { ...serializeSchema(strapi), layoutDefaults: await readLayoutDefaults(strapi) };
  },
});

export default schema;
