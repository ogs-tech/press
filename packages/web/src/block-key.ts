/**
 * Stable React key for a single dynamic-zone entry.
 *
 * Keying by `id` ALONE is wrong for Strapi dynamic zones: a component instance's
 * `id` is unique only within its own component table, so two entries of different
 * `__component` types can legitimately share the same numeric `id` (e.g. a
 * `press.hero` and a `custom.callout` both id 5). React then sees duplicate keys
 * and warns / drops children. Qualifying the id with `__component` makes the key
 * unique across the whole zone. Falls back to the array index when `id` is absent.
 */
export function blockKey(block: { __component: string; id?: number | null }, index: number): string {
  return `${block.__component}:${block.id ?? index}`;
}
