/**
 * The press composition tree — the JSON stored by the `plugin::press-cms.builder`
 * custom field (page `body`) and, as bare `Node[]` slots, by Site Settings
 * `pageDefaults`. Pure wire types: no Strapi, no React.
 *
 * Column `span` (base/md/lg) is the ONE responsive value this JSON carries — the
 * deliberate exception to "responsiveness lives in code". `container` attrs remain
 * editorial intents the web renderer maps to Responsive<T> values code-side.
 */

/** Readers reject any other version (fail-to-empty); gates future migrations. */
export const PRESS_TREE_VERSION = 2;

/** 1..12 track span. Kept `number` on the wire (not a 12-arm literal union);
 *  the range is enforced by the validator, not the type. */
export type Span = number;

/** Mobile-first responsive span: `base` is the required mobile default; `md`/`lg`
 *  are optional overrides that cascade up (md inherits base, lg inherits md). */
export interface ColumnSpan {
  base: Span;
  md?: Span;
  lg?: Span;
}

export type Gap = 'compact' | 'normal' | 'spacious';
export type VerticalAlign = 'top' | 'center' | 'bottom';
export type ContainerWidth = 'prose' | 'lg' | 'full';

/**
 * The ONE attribute surface for every children-bearing node (Spec §3). An
 * absent field (or the whole group absent) means the engine default. Attrs
 * that don't apply to a node type are ignored by the renderer and hidden by
 * the builder form — never an error.
 */
export interface ContainerAttrs {
  /** Container tier — top-level Rows only; ignored when nested. */
  width?: ContainerWidth;
  /** Row: track gap; Column/Layout: stack rhythm. */
  gap?: Gap;
  /** Row: aligns cells; Column: content within the cell height. */
  verticalAlign?: VerticalAlign;
}

/**
 * A placed block: `component` is a palette uid (`preset-atom.paragraph`,
 * `custom-organism.callout`); `data` is validated against that component's
 * registry schema. Media inside `data` is a REFERENCE (`{ assetId: number }`),
 * page links are `{ documentId: string }` — the cms hydrates both server-side
 * so the wire never rots (Spec §3).
 */
export interface BlockNode {
  /** Builder-minted (crypto.randomUUID); React keys + builder ops only — never an Entity. */
  id: string;
  type: 'block';
  component: string;
  data: Record<string, unknown>;
}

/** The recursion point: a column nests arbitrary nodes, including further rows. */
export interface ColumnNode {
  id: string;
  type: 'column';
  /** Per-breakpoint width in 12-track units — the one responsive value on the wire. */
  span: ColumnSpan;
  container?: ContainerAttrs;
  children: Node[];
}

export interface RowNode {
  id: string;
  type: 'row';
  container?: ContainerAttrs;
  /** 1..N columns; each column owns its own span (no shared row-level ratio). */
  children: ColumnNode[];
}

export type Node = RowNode | ColumnNode | BlockNode;

export type Slot =
  | { mode: 'inherit' }                    // resolve against Site Settings pageDefaults
  | { mode: 'none' }                       // bare page
  | { mode: 'custom'; children: Node[] };  // page-owned chrome

export interface LayoutNode {
  type: 'layout';
  header: Slot;
  footer: Slot;
  /** Only `gap` applies: rhythm between top-level children. */
  container?: ContainerAttrs;
  children: Node[];
}

export interface PressTree {
  version: typeof PRESS_TREE_VERSION;
  root: LayoutNode;
}
