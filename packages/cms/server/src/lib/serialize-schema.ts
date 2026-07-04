import type { Core } from '@strapi/strapi';
import type { Attr, PressSchema } from '@ogs-tech/press-shared';

// Re-exported so the type stays importable from this module, while the single
// source of truth lives in @ogs-tech/press-shared (shared with @ogs-tech/press-web's generator).
export type { Attr, PressSchema };

const PAGE_UID = 'plugin::press-cms.page';
const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

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

const requireContentType = (strapi: Core.Strapi, uid: string) => {
  const ct = strapi.contentType(uid as any) as any;
  // Loud failure beats a cryptic `Cannot read 'uid' of undefined` downstream: if
  // an engine content-type is gone, the type-sync contract cannot be produced.
  if (!ct) {
    throw new Error(
      `[press-cms] cannot serialize schema: content-type '${uid}' is not registered — ` +
        'is @ogs-tech/press-cms loaded? The type-sync contract cannot be produced.',
    );
  }
  return ct;
};

/**
 * Serializes the engine's RUNTIME view (Spec §5.2 golden rule of the type-sync
 * loop): the page AND site-setting content-types plus exactly the components
 * currently admitted into the three engine Dynamic Zones (page `body`,
 * site-setting `header`/`footer`), FOLLOWING nested component references —
 * `chrome.navbar` references `press.nav-item` and `press.button`, so those enter
 * the map even though they are not direct DZ members (Spec §2). Reading the live
 * registry (not loose JSON on disk) means the generator can never disagree with
 * what Strapi actually serves.
 */
export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = requireContentType(strapi, PAGE_UID);
  const siteSetting = requireContentType(strapi, SITE_SETTING_UID);

  const registry = strapi.get('components') as Map<string, any>;
  const dzComponents: string[] = [
    ...(page.attributes?.body?.components ?? []),
    ...(siteSetting.attributes?.header?.components ?? []),
    ...(siteSetting.attributes?.footer?.components ?? []),
  ];

  const components: PressSchema['components'] = {};
  // Breadth-first over DZ admissions + nested `type: 'component'` references, so
  // nested-only components (press.nav-item) enter the map exactly once.
  const queue = [...new Set(dzComponents)];
  while (queue.length > 0) {
    const uid = queue.shift()!;
    if (components[uid]) continue;
    const comp = registry.get(uid);
    // A uid reachable from an engine DZ but missing from the components registry
    // is a contract violation (Spec §5.2: the schema must never disagree with
    // what Strapi serves). Fail loud rather than silently emit incomplete types.
    if (!comp) {
      throw new Error(
        `[press-cms] cannot serialize schema: component '${uid}' is admitted into an engine ` +
          'Dynamic Zone (or referenced by an admitted component) but absent from the components ' +
          'registry — the generated types would be incomplete. Aborting the schema response.',
      );
    }
    const attributes = pickAttributes(comp.attributes);
    components[uid] = { uid, attributes };
    for (const attr of Object.values(attributes)) {
      if (attr.type === 'component' && typeof attr.component === 'string') queue.push(attr.component);
    }
  }

  return {
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
      [siteSetting.uid]: { uid: siteSetting.uid, info: siteSetting.info, attributes: pickAttributes(siteSetting.attributes) },
    },
    components,
  };
};
