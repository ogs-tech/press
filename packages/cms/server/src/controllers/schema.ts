import type { Core } from '@strapi/strapi';
import { serializeSchema } from '../lib/serialize-schema';

/**
 * Public, versioned type-sync source of truth (Spec §5.2). Returns the engine's
 * runtime registry view; `@ogs-tech/press-web sync-types` fetches this to generate types.
 */
const schema = ({ strapi }: { strapi: Core.Strapi }) => ({
  get(ctx: any) {
    ctx.body = serializeSchema(strapi);
  },
});

export default schema;
