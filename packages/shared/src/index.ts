/**
 * @ogs-tech/press-shared — the framework-agnostic press wire contract.
 *
 * `PressSchema` is the JSON shape the engine serves at `/api/press/schema`:
 * produced by @ogs-tech/press-cms (serialize-schema) and consumed by @ogs-tech/press-web's type
 * generator. Single-sourcing it here removes the drift risk of two hand-kept
 * copies. It deliberately references NO Strapi or React types — it is the
 * contract itself, owned by neither side (Spec §5.2: the generator stays
 * decoupled from Strapi's internal type format).
 *
 * Consumed type-only (`import type`), so it never enters either package's
 * runtime/published artifact — purely a build-time, single-source-of-truth dep.
 */

/**
 * One serialized attribute. `type` is optional and an open index signature is
 * kept on purpose: the producer (Strapi) emits a wide, evolving set of keys and
 * the consumer must tolerate unknown ones rather than reject the payload.
 */
export interface Attr {
  type?: string;
  required?: boolean;
  enum?: string[];
  multiple?: boolean;
  components?: string[];
  /** For `type: 'component'`: the referenced component uid (e.g. `preset-molecule.nav-item`). */
  component?: string;
  /** For `type: 'component'`: repeatable → array on the wire (Spec §2). */
  repeatable?: boolean;
  [k: string]: unknown;
}

export interface PressSchema {
  contentTypes: Record<string, { uid: string; info: unknown; attributes: Record<string, Attr> }>;
  components: Record<string, { uid: string; attributes: Record<string, Attr> }>;
}
