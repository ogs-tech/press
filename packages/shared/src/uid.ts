/**
 * Parses the palette's uniform `{owner}-{layer}.{name}` uid grammar (see the
 * "Component palette" architecture notes) — the one place that splits a
 * component uid, so owner/layer/category extraction can't drift across the
 * admin picker's icon/label lookups and the cms/web palette filters.
 */
export interface ParsedUid {
  category: string;
  owner: string;
  layer: string;
  name: string;
}

export function parseUid(uid: string): ParsedUid {
  const [category, name = ''] = uid.split('.');
  const [owner, layer = ''] = category.split('-');
  return { category, owner, layer, name };
}

export const isPresetUid = (uid: string): boolean => uid.startsWith('preset-');

/** An adopter block: any registered component under a `custom`/`custom-${layer}` category
 *  (the bare `custom.` form is a pre-Atomic-Design legacy shape, tolerated for migration). */
export const isCustomBlockUid = (uid: string): boolean => uid.startsWith('custom.') || uid.startsWith('custom-');
