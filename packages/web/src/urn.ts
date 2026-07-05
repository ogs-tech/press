/**
 * Canonical identity primitives (canonical-urn Spec §1). Web-only: the CMS wire
 * contract never carries a urn — identity is attached (Page) or synthesized
 * (Site Settings) at the web mapping boundary. Interface + factory, no classes:
 * a urn stays a plain string at runtime, so it crosses the RSC boundary and
 * lands in a JSX `key` with zero serialization cost.
 */

/**
 * The CLOSED set of engine entities that carry a canonical identity. Three
 * identity CLASSES coexist in this file — keep them straight:
 *
 *  1. STORED (via `Canonical<E>`, `E extends Entity`): a durable id fixed
 *     independent of the current render — a document id (`page`), a synthetic
 *     singleton constant (`site-setting`, `plugin`). Attached once at a mapping
 *     boundary; safe to treat as stable across renders and RSC hops.
 *  2. TYPE-level (also an `Entity`, but keyed by a code-defined uid, not a
 *     document): `component` → `urn:component:{uid}` names a palette
 *     REGISTRATION (`press.image`, `section.hero`, `chrome.navbar`, adopter
 *     `custom.*`). No object implements `Canonical<'component'>` — the palette
 *     registries (reference/section/chrome-blocks) ARE the canonical base;
 *     any uid in them has this identity for free via `componentUrn`.
 *  3. COMPUTED (`Urn<string>`, NOT an `Entity`): formatted ad hoc for a value
 *     with no durable identity of its own — `blockKey` qualifies a DZ row's
 *     ephemeral numeric id with its `__component` (`urn:press.image:5`).
 *     Deliberately never promoted into this union: a DZ row id isn't durable.
 *
 * Extend this union — never widen a call site to plain `string` — when a new
 * entity earns a stored/type-level urn (e.g. media). Mirrors ThemeName's
 * "additive, not breaking" precedent (config/types.ts).
 */
export type Entity = 'page' | 'site-setting' | 'plugin' | 'component';

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

/**
 * Canonical identity of a component TYPE (identity class 2 above): the palette
 * registration keyed by its uid — `press.image`, `section.hero`, `chrome.navbar`,
 * an adopter's `custom.*`. Thin wrapper over `buildUrn` so there is exactly one
 * formatting implementation. Contrast `blockKey`, which formats the COMPUTED
 * per-instance identity (`urn:{uid}:{id}`) — same primitive, different axis:
 * here the uid IS the id segment, there it is the entity segment.
 */
export function componentUrn(uid: string): Urn<'component'> {
  return buildUrn('component', uid);
}
