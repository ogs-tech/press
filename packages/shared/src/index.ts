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
 * NO LONGER type-only. Alongside the types this package ships RUNTIME values —
 * `PRESS_TREE_VERSION`, `validatePressTree`/`validateNodeArray`,
 * `CONTAINER_ENUMS`, `DEFAULT_LAYOUT`/`resolveLayoutDefaults` — so it is a
 * PUBLISHED dependency: press-cms inlines it into its compiled `dist`
 * (`strapi-plugin build`) and press-web consumes the source (transpiled by the
 * Next host). The rule that survives: zero Strapi/Next imports, so the same code
 * runs unmodified on the cms write path and the web render path.
 */

import type { LayoutDefaults } from './layout-defaults';

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
  /** The composition-tree contract version served by this cms (absent on pre-tree engines). */
  tree?: { version: number };
  /** Site-level layout defaults served by this cms (absent on pre-layout engines). */
  layoutDefaults?: LayoutDefaults;
  contentTypes: Record<string, { uid: string; info: unknown; attributes: Record<string, Attr> }>;
  components: Record<string, { uid: string; attributes: Record<string, Attr> }>;
}

export * from './tree';
export * from './validate-tree';
export * from './layout-defaults';
