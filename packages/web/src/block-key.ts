import { buildUrn, type Urn } from './urn';

/**
 * Stable React key for a single dynamic-zone entry.
 *
 * Keying by `id` ALONE is wrong for Strapi dynamic zones: a component instance's
 * `id` is unique only within its own component table, so two entries of different
 * `__component` types can legitimately share the same numeric `id` (e.g. a
 * `preset-atom.image` and a `custom-organism.callout` both id 5). React then sees duplicate keys
 * and warns / drops children. Qualifying the id with `__component` makes the key
 * unique across the whole zone. Falls back to the array index when `id` is absent.
 *
 * The key is formatted through the canonical urn primitive with `__component`
 * as the entity segment (canonical-urn Spec §4) — a COMPUTED identity, never
 * stored on the block: a DZ entry's id is ephemeral, so the engine promises
 * nothing beyond the current render.
 */
export function blockKey(block: { __component: string; id?: number | null }, index: number): Urn<string> {
  return buildUrn(block.__component, block.id ?? index);
}
