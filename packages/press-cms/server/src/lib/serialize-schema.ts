import type { Core } from '@strapi/strapi';

const PAGE_UID = 'plugin::press-cms.page';

// The only attribute keys that are part of the public type-sync contract. Any
// other key Strapi attaches (private flags, column hints, plugin internals) is
// deliberately dropped so the generated types stay stable across Strapi patches.
const KEEP = ['type', 'required', 'enum', 'default', 'components', 'multiple', 'allowedTypes', 'repeatable', 'component'] as const;

type Attr = Record<string, unknown>;

const pickAttributes = (attributes: Record<string, Attr>): Record<string, Attr> => {
  const out: Record<string, Attr> = {};
  for (const [name, attr] of Object.entries(attributes ?? {})) {
    // Skip Strapi-managed timestamp/private fields — never part of the contract.
    if (attr?.private) continue;
    if (['createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'locale'].includes(name)) continue;
    const kept: Attr = {};
    for (const key of KEEP) {
      if (attr[key] !== undefined) kept[key] = attr[key];
    }
    out[name] = kept;
  }
  return out;
};

export interface PressSchema {
  contentTypes: Record<string, { uid: string; info: unknown; attributes: Record<string, Attr> }>;
  components: Record<string, { uid: string; attributes: Record<string, Attr> }>;
}

/**
 * Serializes the engine's RUNTIME view (Spec §5.2 golden rule): the page
 * content-type plus exactly the components currently admitted into its `body`
 * dynamic zone — `press.*` reference blocks AND already-admitted `custom.*`.
 * Reading the live registry (not loose JSON on disk) means the generator can
 * never disagree with what Strapi actually serves.
 */
export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = strapi.contentType(PAGE_UID as any) as any;
  const registry = strapi.get('components') as Map<string, any>;
  const dzComponents: string[] = page?.attributes?.body?.components ?? [];

  const components: PressSchema['components'] = {};
  for (const uid of dzComponents) {
    const comp = registry.get(uid);
    if (comp) components[uid] = { uid, attributes: pickAttributes(comp.attributes) };
  }

  return {
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
    },
    components,
  };
};
