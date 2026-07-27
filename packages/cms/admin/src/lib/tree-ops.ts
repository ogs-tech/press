/**
 * Pure, immutable operations on a composition forest (a slot's Node[]). The
 * builder UI calls ONLY these — the structural invariants (Spec §4: Column only
 * under Row, Row children are Columns only, 1–12 columns via MAX_COLUMNS; the
 * wire itself has no upper cap) are enforced here by
 * construction, which is what makes the lifecycle validator "unreachable" from
 * the admin. No React, no Strapi: unit-tested without a DOM.
 */
import type { BlockNode, ColumnNode, ColumnSpan, ContainerAttrs, ContainerKey, Node, RowNode } from '@ogs-tech/press-shared';

export type Forest = Node[];
export type NodePath = number[];

export const MAX_COLUMNS = 12;

const uuid = (): string => globalThis.crypto.randomUUID();

export const newBlockNode = (component: string): BlockNode => ({ id: uuid(), type: 'block', component, data: {} });

export const newColumnNode = (span: ColumnSpan = { base: 12 }): ColumnNode => ({
  id: uuid(), type: 'column', span, children: [],
});

/** A fresh row: 2 columns, stacked on mobile (base 12) and 50/50 on desktop (md 6). */
export const newRowNode = (): RowNode => ({
  id: uuid(),
  type: 'row',
  children: [newColumnNode({ base: 12, md: 6 }), newColumnNode({ base: 12, md: 6 })],
});

/** The span actually applied at a tier, resolving the mobile-first cascade (lg→md→base). */
export function effectiveSpan(span: ColumnSpan, tier: 'base' | 'md' | 'lg'): number {
  if (tier === 'lg') return span.lg ?? span.md ?? span.base;
  if (tier === 'md') return span.md ?? span.base;
  return span.base;
}

const childrenOf = (node: Node): Node[] =>
  node.type === 'block' ? [] : (node.children as Node[]);

export function getNode(forest: Forest, path: NodePath): Node | null {
  let list: Node[] = forest;
  let node: Node | null = null;
  for (const index of path) {
    node = list[index] ?? null;
    if (!node) return null;
    list = childrenOf(node);
  }
  return node;
}

/** Rebuilds the spine along `path`, applying `update` to the addressed sibling
 *  list. `null` and `[]` both address the forest itself — `walk`'s own
 *  `path.length === 0` base case already handles a `null` parentPath via the
 *  trailing `parentPath ?? []`, so there is no separate case to special-case. */
function updateList(forest: Forest, parentPath: NodePath | null, update: (siblings: Node[], parent: Node | null) => Node[]): Forest {
  const walk = (list: Node[], path: NodePath): Node[] => {
    if (path.length === 0) return update([...list], null);
    const [head, ...rest] = path;
    return list.map((node, i) => {
      if (i !== head) return node;
      if (node.type === 'block') throw new Error('[press-cms] a block node has no children');
      if (rest.length === 0) {
        return { ...node, children: update([...(node.children as Node[])], node) } as Node;
      }
      return { ...node, children: walk(node.children as Node[], rest) } as Node;
    });
  };
  return walk(forest, parentPath ?? []);
}

/** Splits an addressed node's `NodePath` into its parent path (empty at the
 *  forest root — `updateList` treats `[]` the same as `null`) and its index
 *  among siblings — shared by remove/move/patch. */
function splitPath(path: NodePath): { parentPath: NodePath; index: number } {
  return { parentPath: path.slice(0, -1), index: path[path.length - 1] };
}

function assertLegalChild(parent: Node | null, child: Node): void {
  if (parent === null || parent.type === 'column') {
    if (child.type === 'column') throw new Error('[press-cms] a column is only legal directly under a row');
    return;
  }
  if (parent.type === 'row') {
    if (child.type !== 'column') throw new Error('[press-cms] row children must be columns');
    return;
  }
  throw new Error('[press-cms] a block node cannot take children');
}

export function insertNode(forest: Forest, parentPath: NodePath | null, index: number, node: Node): Forest {
  const parent = parentPath === null ? null : getNode(forest, parentPath);
  if (parentPath !== null && !parent) throw new Error('[press-cms] insert parent not found');
  assertLegalChild(parent, node);
  if (parent?.type === 'row' && (parent.children as Node[]).length >= MAX_COLUMNS) {
    throw new Error(`[press-cms] a row carries at most ${MAX_COLUMNS} columns`);
  }
  return updateList(forest, parentPath, (siblings) => {
    siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, node);
    return siblings;
  });
}

export function removeNode(forest: Forest, path: NodePath): Forest {
  const { parentPath, index } = splitPath(path);
  return updateList(forest, parentPath, (siblings) => {
    siblings.splice(index, 1);
    return siblings;
  });
}

export function moveNode(forest: Forest, path: NodePath, delta: -1 | 1): Forest {
  const { parentPath, index } = splitPath(path);
  return updateList(forest, parentPath, (siblings) => {
    const target = index + delta;
    if (target < 0 || target >= siblings.length) return siblings;
    const [node] = siblings.splice(index, 1);
    siblings.splice(target, 0, node);
    return siblings;
  });
}

function patchNode(forest: Forest, path: NodePath, patch: (node: Node) => Node): Forest {
  const { parentPath, index } = splitPath(path);
  return updateList(forest, parentPath, (siblings) => {
    if (!siblings[index]) throw new Error('[press-cms] node not found at path');
    siblings[index] = patch(siblings[index]);
    return siblings;
  });
}

export function setBlockData(forest: Forest, path: NodePath, data: Record<string, unknown>): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type !== 'block') throw new Error('[press-cms] setBlockData targets block nodes');
    return { ...node, data };
  });
}

/**
 * The container-attr patch RULE: setting `undefined` deletes the key, and an
 * emptied container disappears entirely so a cleared node never persists
 * `container: {}`. Pure — never mutates its input. Pair with `applyContainer`
 * below to write the result back onto a node.
 */
export function patchContainer(
  container: ContainerAttrs | undefined,
  key: ContainerKey,
  value: string | undefined,
): ContainerAttrs | undefined {
  const next = { ...(container ?? {}) } as Record<string, unknown>;
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length === 0 ? undefined : (next as ContainerAttrs);
}

/** Applies a patched `ContainerAttrs` onto a node-like object: sets the key when
 *  present, deletes it when the patch collapsed to `undefined` (an emptied
 *  container never persists as `container: {}`). Shared by the path-addressed
 *  `setContainerAttr` below and the root-addressed call in builder-input. */
export function applyContainer<T extends { container?: ContainerAttrs }>(obj: T, container: ContainerAttrs | undefined): T {
  const next = { ...obj };
  if (container) next.container = container;
  else delete next.container;
  return next;
}

export function setContainerAttr(
  forest: Forest,
  path: NodePath,
  key: ContainerKey,
  value: string | undefined,
): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type === 'block') throw new Error('[press-cms] blocks carry no container attrs');
    return applyContainer(node, patchContainer(node.container, key, value));
  });
}

export function setColumnSpan(
  forest: Forest,
  path: NodePath,
  tier: 'base' | 'md' | 'lg',
  value: number | undefined,
): Forest {
  return patchNode(forest, path, (node) => {
    if (node.type !== 'column') throw new Error('[press-cms] setColumnSpan targets column nodes');
    const span: ColumnSpan = { ...node.span };
    if (tier === 'base') {
      span.base = value ?? 12; // base can never be cleared
    } else if (value === undefined) {
      delete span[tier];
    } else {
      span[tier] = value;
    }
    return { ...node, span };
  });
}

export function addColumn(forest: Forest, rowPath: NodePath): Forest {
  const row = getNode(forest, rowPath);
  if (!row || row.type !== 'row') throw new Error('[press-cms] addColumn targets row nodes');
  return insertNode(forest, rowPath, row.children.length, newColumnNode());
}
