import type { Core } from '@strapi/strapi';
import { collectNodeRefs, collectTreeRefs, hydrateNodeArray, hydrateTree, type SchemaLookup, type TreeRefs, type TreeResolvers } from './hydrate-tree';

const PAGE_UID = 'plugin::press-cms.page';

const schemaLookup = (strapi: Core.Strapi): SchemaLookup => {
  const registry = strapi.get('components') as Map<string, any>;
  return (uid) => registry.get(uid);
};

/** One batched query per ref kind; a missing asset → null, a missing/unpublished page → ref without slug. */
async function buildResolvers(strapi: Core.Strapi, refs: TreeRefs): Promise<TreeResolvers> {
  const files = refs.assetIds.length
    ? await strapi.db.query('plugin::upload.file').findMany({ where: { id: { $in: refs.assetIds } } })
    : [];
  const fileById = new Map<number, Record<string, unknown>>(
    files.map((f: any) => [f.id, {
      assetId: f.id, url: f.url, width: f.width, height: f.height,
      alternativeText: f.alternativeText ?? null, name: f.name, mime: f.mime,
    }]),
  );
  const pages = refs.pageDocumentIds.length
    ? await strapi.documents(PAGE_UID as any).findMany({
        filters: { documentId: { $in: refs.pageDocumentIds } },
        status: 'published',
        fields: ['slug'],
      })
    : [];
  const pageByDoc = new Map<string, Record<string, unknown>>(
    (pages as any[]).map((p) => [p.documentId, { documentId: p.documentId, slug: p.slug }]),
  );
  return {
    media: (assetId) => fileById.get(assetId) ?? null,
    page: (documentId) => pageByDoc.get(documentId) ?? { documentId },
  };
}

/** Applies already-built resolvers to one doc's body — the shared last step of both hydration paths below. */
function hydrateBody<T extends Record<string, unknown>>(doc: T, getSchema: SchemaLookup, resolvers: TreeResolvers): T {
  return { ...doc, body: hydrateTree(doc.body, getSchema, resolvers) };
}

export async function hydratePageDoc<T extends Record<string, unknown>>(strapi: Core.Strapi, doc: T | null): Promise<T | null> {
  if (!doc || doc.body === undefined || doc.body === null) return doc;
  const getSchema = schemaLookup(strapi);
  const resolvers = await buildResolvers(strapi, collectTreeRefs(doc.body, getSchema));
  return hydrateBody(doc, getSchema, resolvers);
}

/** One resolver build for the WHOLE list (kills the per-doc N+1 on the unpaginated `GET /pages`): collect refs across every doc's body, resolve once, then hydrate each doc against the shared resolvers. */
export async function hydratePageDocs<T extends Record<string, unknown>>(strapi: Core.Strapi, docs: T[]): Promise<T[]> {
  const getSchema = schemaLookup(strapi);
  const combinedRefs = docs.reduce<TreeRefs>((refs, doc) => {
    if (!doc || doc.body === undefined || doc.body === null) return refs;
    const docRefs = collectTreeRefs(doc.body, getSchema);
    return {
      assetIds: [...refs.assetIds, ...docRefs.assetIds],
      pageDocumentIds: [...refs.pageDocumentIds, ...docRefs.pageDocumentIds],
    };
  }, { assetIds: [], pageDocumentIds: [] });
  const resolvers = await buildResolvers(strapi, combinedRefs);
  return docs.map((doc) => (!doc || doc.body === undefined || doc.body === null ? doc : hydrateBody(doc, getSchema, resolvers)));
}

export async function hydrateSiteSetting<T extends { pageDefaults?: unknown }>(strapi: Core.Strapi, data: T | null): Promise<T | null> {
  const pd = data?.pageDefaults as { header?: unknown; footer?: unknown } | null | undefined;
  if (!data || !pd || typeof pd !== 'object') return data;
  const getSchema = schemaLookup(strapi);
  const refs = [collectNodeRefs(pd.header, getSchema), collectNodeRefs(pd.footer, getSchema)];
  const resolvers = await buildResolvers(strapi, {
    assetIds: [...new Set(refs.flatMap((r) => r.assetIds))],
    pageDocumentIds: [...new Set(refs.flatMap((r) => r.pageDocumentIds))],
  });
  return {
    ...data,
    pageDefaults: {
      ...pd,
      header: hydrateNodeArray(pd.header, getSchema, resolvers),
      footer: hydrateNodeArray(pd.footer, getSchema, resolvers),
    },
  };
}
