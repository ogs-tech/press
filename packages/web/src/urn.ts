/**
 * Canonical identity primitives (canonical-urn Spec §1). Web-only: the CMS wire
 * contract never carries a urn — identity is attached (Page) or synthesized
 * (Site Settings) at the web mapping boundary. Interface + factory, no classes:
 * a urn stays a plain string at runtime, so it crosses the RSC boundary and
 * lands in a JSX `key` with zero serialization cost.
 */

/**
 * The CLOSED set of engine aggregates that carry a canonical STORED identity.
 * Extend this union — never widen a call site to plain `string` — when a new
 * aggregate earns a stored urn (media, blocks with persisted identity).
 * Mirrors ThemeName's "additive, not breaking" precedent (config/types.ts).
 */
export type Entity = 'page' | 'site-setting' | 'plugin';

/**
 * A `urn:{entity}:{id}` identity string. Generic over any string — NOT bounded
 * to Entity — so the same primitive also formats COMPUTED identities (block-key
 * uses the block's `__component` as the entity segment) without admitting them
 * into the closed Entity union. The template literal already rejects an
 * arbitrary string at compile time; no nominal brand (and its `as Urn` noise).
 */
export type Urn<E extends string = string> = `urn:${E}:${string}`;

/**
 * The shape of an aggregate with a canonical stored identity: one `urn` field,
 * scoped to the closed Entity union. Implemented by extension — `Page extends
 * Canonical<'page'>` — never via a parallel wrapper type: the aggregate IS the
 * entity, so there is exactly one type to import.
 */
export interface Canonical<E extends Entity = Entity> {
  urn: Urn<E>;
}

/**
 * Formats a canonical urn. Pure; no validation of `id` — the engine trusts its
 * own wire shape here exactly as mapSiteSettings does for CMS field formats.
 */
export function buildUrn<E extends string>(entity: E, id: string | number): Urn<E> {
  return `urn:${entity}:${id}`;
}
