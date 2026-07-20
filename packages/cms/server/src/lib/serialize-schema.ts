import type { Core } from '@strapi/strapi';
import type { Attr, PressSchema } from '@ogs-tech/press-shared';
import { PRESS_TREE_VERSION } from '@ogs-tech/press-shared';
import { isCustomBlockUid } from './inject-components';

// Re-exported so the type stays importable from this module, while the single
// source of truth lives in @ogs-tech/press-shared (shared with @ogs-tech/press-web's generator).
export type { Attr, PressSchema };

const PAGE_UID = 'plugin::press-cms.page';
const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

// The only attribute keys that are part of the public type-sync contract. Any
// other key Strapi attaches (private flags, column hints, plugin internals) is
// deliberately dropped so the generated types stay stable across Strapi patches.
const KEEP = ['type', 'required', 'enum', 'default', 'components', 'multiple', 'allowedTypes', 'repeatable', 'component', 'relation', 'target'] as const;

/** Palette membership: engine presets + adopter customs; Strapi-internal categories never serve. */
const isPaletteUid = (uid: string): boolean => uid.startsWith('preset-') || isCustomBlockUid(uid);

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
 * Serializes the engine's RUNTIME view: the page AND site-setting content-types
 * plus the FULL registered palette (Spec §4/§5.2) — every `preset-*` + `custom-*`
 * component uid. The `body`/`pageDefaults` composition tree references components
 * by uid at arbitrary depth via the `plugin::press-cms.builder` custom field, so
 * there is no Dynamic Zone admission list left to walk; the palette is exactly
 * "every component the registry knows about that belongs to press" (Strapi's own
 * `admin.*`/other-plugin categories never serve). Reading the live registry (not
 * loose JSON on disk) means the generator can never disagree with what Strapi
 * actually serves. Also carries `tree.version` (`PRESS_TREE_VERSION`) so the
 * builder/generator can refuse a tree version they don't understand.
 */
export const serializeSchema = (strapi: Core.Strapi): PressSchema => {
  const page = requireContentType(strapi, PAGE_UID);
  const siteSetting = requireContentType(strapi, SITE_SETTING_UID);

  const registry = strapi.get('components') as Map<string, any>;
  const components: PressSchema['components'] = {};
  for (const [uid, comp] of registry.entries()) {
    if (!isPaletteUid(uid)) continue;
    components[uid] = { uid, attributes: pickAttributes(comp.attributes) };
  }

  return {
    tree: { version: PRESS_TREE_VERSION },
    contentTypes: {
      [page.uid]: { uid: page.uid, info: page.info, attributes: pickAttributes(page.attributes) },
      [siteSetting.uid]: { uid: siteSetting.uid, info: siteSetting.info, attributes: pickAttributes(siteSetting.attributes) },
    },
    components,
  };
};
