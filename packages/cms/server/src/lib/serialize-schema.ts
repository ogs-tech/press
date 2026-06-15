import type { Core } from '@strapi/strapi';
import type { Attr, PressSchema } from '@press/shared';

// Re-exported so the type stays importable from this module, while the single
// source of truth lives in @press/shared (shared with @press/web's generator).
export type { Attr, PressSchema };

const PAGE_UID = 'plugin::press-cms.page';

// The only attribute keys that are part of the public type-sync contract. Any
// other key Strapi attaches (private flags, column hints, plugin internals) is
// deliberately dropped so the generated types stay stable across Strapi patches.
const KEEP = ['type', 'required', 'enum', 'default', 'components', 'multiple', 'allowedTypes', 'repeatable', 'component'] as const;

const pickAttributes = (attributes: Record<string, Attr>): Record<string, Attr> => {
  const out: Record<string, Attr> = {};
  for (const [name, attr] of Object.entries(attributes ?? {})) {
    // Skip Strapi-managed timestamp/private fields — never part of the contract.
    if (attr?.private) continue;
    if (['createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy', 'locale'].includes(name)) continue;
    // Loose record while copying: indexing a typed Attr by the KEEP union on the
    // write side collapses to `never`. We cast back to Attr once fully built.
    const kept: Record<string, unknown> = {};
    for (const key of KEEP) {
      if (attr[key] !== undefined) kept[key] = attr[key];
    }
    out[name] = kept as Attr;
  }
  return out;
};

/**
 * Serializes the engine's RUNTIME view (Spec §5.2 golden rule): the page
 * content-type plus exactly the components currently admitted into its `body`
 * dynamic zone — `press.*` reference blocks AND already-admitted `custom.*`.
 * Reading the live registry (not loose JSON on disk) means the generator can
 * never disagree with what Strapi actually serves.
 */
export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = strapi.contentType(PAGE_UID as any) as any;
  // Loud failure beats a cryptic `Cannot read 'uid' of undefined` downstream: if
  // the page content-type is gone, the type-sync contract cannot be produced.
  if (!page) {
    throw new Error(
      `[press-cms] cannot serialize schema: content-type '${PAGE_UID}' is not registered — ` +
        'is @press/cms loaded? The type-sync contract cannot be produced.',
    );
  }

  const registry = strapi.get('components') as Map<string, any>;
  const dzComponents: string[] = page.attributes?.body?.components ?? [];

  const components: PressSchema['components'] = {};
  for (const uid of dzComponents) {
    const comp = registry.get(uid);
    // A uid admitted into the page DZ but missing from the components registry is a
    // contract violation (Spec §5.2: the schema must never disagree with what Strapi
    // serves). Fail loud rather than silently emit types that omit a real block.
    if (!comp) {
      throw new Error(
        `[press-cms] cannot serialize schema: component '${uid}' is admitted into the page ` +
          'Dynamic Zone but absent from the components registry — the generated types would be ' +
          'incomplete. Aborting the schema response.',
      );
    }
    components[uid] = { uid, attributes: pickAttributes(comp.attributes) };
  }

  return {
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
    },
    components,
  };
};
