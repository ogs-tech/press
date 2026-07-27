/**
 * Media/page-ref hydration for composition trees (Spec §3 "Media inside `data`
 * is a reference, not a snapshot"). The builder stores `{ assetId }` for media
 * and `{ documentId }` for page relations; this walker — driven by the
 * components registry so it never hardcodes block shapes — swaps them for fresh
 * values at serve time, so the wire never rots.
 *
 * Pure: resolvers are injected; the strapi-facing batching lives in
 * serve-hydrated.ts. Never mutates its input; unknown components and malformed
 * values pass through untouched (the web renderer owns tolerance).
 */
import { isRecord } from '@ogs-tech/press-shared';

export interface TreeRefs {
  assetIds: number[];
  pageDocumentIds: string[];
}

export interface TreeResolvers {
  media(assetId: number): Record<string, unknown> | null;
  page(documentId: string): Record<string, unknown> | null;
}

export type SchemaLookup = (uid: string) => { attributes?: Record<string, any> } | undefined;

const PAGE_TARGET = 'plugin::press-cms.page';

type Visitor = {
  media(assetId: number): unknown;
  page(documentId: string): unknown;
};

/** Walks one component's data guided by its schema attributes; returns a new object. */
function walkData(data: unknown, attributes: Record<string, any> | undefined, getSchema: SchemaLookup, visit: Visitor): unknown {
  if (!isRecord(data) || !attributes) return data;
  const out: Record<string, unknown> = { ...data };
  for (const [name, attr] of Object.entries(attributes)) {
    const value = out[name];
    if (value === undefined || value === null) continue;
    if (attr?.type === 'media' && isRecord(value) && typeof value.assetId === 'number') {
      out[name] = visit.media(value.assetId);
    } else if (attr?.type === 'relation' && attr?.target === PAGE_TARGET && isRecord(value) && typeof value.documentId === 'string') {
      out[name] = visit.page(value.documentId);
    } else if (attr?.type === 'component' && typeof attr?.component === 'string') {
      const nested = getSchema(attr.component)?.attributes;
      out[name] = attr.repeatable && Array.isArray(value)
        ? value.map((item) => walkData(item, nested, getSchema, visit))
        : walkData(value, nested, getSchema, visit);
    }
  }
  return out;
}

function walkNodes(nodes: unknown, getSchema: SchemaLookup, visit: Visitor): unknown {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((node) => {
    if (!isRecord(node)) return node;
    if (node.type === 'block' && typeof node.component === 'string') {
      const attributes = getSchema(node.component)?.attributes;
      return { ...node, data: walkData(node.data, attributes, getSchema, visit) };
    }
    if ((node.type === 'row' || node.type === 'column') && Array.isArray(node.children)) {
      return { ...node, children: walkNodes(node.children, getSchema, visit) };
    }
    return node;
  });
}

function slotChildren(tree: unknown): { root: Record<string, unknown> | null; slots: Array<'header' | 'footer'> } {
  if (!isRecord(tree) || !isRecord(tree.root)) return { root: null, slots: [] };
  const slots: Array<'header' | 'footer'> = [];
  for (const key of ['header', 'footer'] as const) {
    const slot = (tree.root as Record<string, unknown>)[key];
    if (isRecord(slot) && slot.mode === 'custom') slots.push(key);
  }
  return { root: tree.root as Record<string, unknown>, slots };
}

export function collectNodeRefs(nodes: unknown, getSchema: SchemaLookup): TreeRefs {
  const assetIds = new Set<number>();
  const pageDocumentIds = new Set<string>();
  walkNodes(nodes, getSchema, {
    media: (assetId) => (assetIds.add(assetId), { assetId }),
    page: (documentId) => (pageDocumentIds.add(documentId), { documentId }),
  });
  return { assetIds: [...assetIds], pageDocumentIds: [...pageDocumentIds] };
}

export function hydrateNodeArray(nodes: unknown, getSchema: SchemaLookup, resolvers: TreeResolvers): unknown {
  return walkNodes(nodes, getSchema, {
    media: (assetId) => resolvers.media(assetId),
    page: (documentId) => resolvers.page(documentId),
  });
}

export function collectTreeRefs(tree: unknown, getSchema: SchemaLookup): TreeRefs {
  const { root, slots } = slotChildren(tree);
  if (!root) return { assetIds: [], pageDocumentIds: [] };
  const all = [
    collectNodeRefs(root.children, getSchema),
    ...slots.map((key) => collectNodeRefs((root[key] as Record<string, unknown>).children, getSchema)),
  ];
  return {
    assetIds: [...new Set(all.flatMap((r) => r.assetIds))],
    pageDocumentIds: [...new Set(all.flatMap((r) => r.pageDocumentIds))],
  };
}

export function hydrateTree(tree: unknown, getSchema: SchemaLookup, resolvers: TreeResolvers): unknown {
  const { root, slots } = slotChildren(tree);
  if (!root) return tree;
  const nextRoot: Record<string, unknown> = { ...root, children: hydrateNodeArray(root.children, getSchema, resolvers) };
  for (const key of slots) {
    const slot = root[key] as Record<string, unknown>;
    nextRoot[key] = { ...slot, children: hydrateNodeArray(slot.children, getSchema, resolvers) };
  }
  return { ...(tree as Record<string, unknown>), root: nextRoot };
}
