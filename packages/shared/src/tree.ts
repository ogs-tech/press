/**
 * The press composition tree — the JSON stored by the `plugin::press-cms.builder`
 * custom field (page `body`) and, as bare `Node[]` slots, by Site Settings
 * `pageDefaults` (Spec §3). Pure wire types: no Strapi, no React.
 *
 * Responsiveness NEVER appears in this JSON — `ratio` and the `container` attrs
 * are editorial intents; the web renderer maps them to Responsive<T> values.
 */

/** Readers reject any other version (fail-to-empty); gates future migrations. */
export const PRESS_TREE_VERSION = 1;

/** Row-only: defines the column split. The closed scale inherited from the retired columns organism. */
export type Ratio = '50-50' | '33-67' | '67-33' | '33-33-33' | '25-25-25-25';
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
  container?: ContainerAttrs;
  children: Node[];
}

export interface RowNode {
  id: string;
  type: 'row';
  ratio: Ratio;
  container?: ContainerAttrs;
  /** 1..4, ratio-bound; extra columns beyond the ratio's slots reuse the last span. */
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
