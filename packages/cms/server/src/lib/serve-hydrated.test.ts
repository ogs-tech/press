import { describe, expect, it, vi } from 'vitest';
import { hydratePageDoc, hydratePageDocs, hydrateSiteSetting } from './serve-hydrated';

/** Mirrors the fixtures in hydrate-tree.test.ts: image → media, link → relation→page, navbar → repeatable+nested. */
const SCHEMAS: Record<string, any> = {
  'preset-atom.image': { attributes: { image: { type: 'media', multiple: false }, caption: { type: 'string' } } },
  'preset-atom.button': { attributes: { link: { type: 'component', component: 'preset-molecule.link' }, variant: { type: 'enumeration' } } },
  'preset-molecule.link': { attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean' } } },
  'preset-organism.navbar': { attributes: { items: { type: 'component', repeatable: true, component: 'preset-molecule.link' }, cta: { type: 'component', component: 'preset-atom.button' } } },
};

type File = { id: number; url: string; width: number; height: number; alternativeText: string | null; name: string; mime: string };
type PageRow = { documentId: string; slug: string };

/**
 * A fake strapi exposing exactly what serve-hydrated calls: `get('components')`
 * for the schema registry, `db.query('plugin::upload.file').findMany` for
 * assets, `documents(PAGE_UID).findMany` for page refs. Both findMany stubs are
 * counting spies (vi.fn tracks every call in `.mock.calls`) that return canned
 * rows filtered to the requested `$in` ids — enough to prove BOTH the wire
 * shapes AND (via `.mock.calls.length`) that a whole doc list shares one query
 * pair instead of one per doc.
 */
function makeStrapi(files: File[], pages: PageRow[]) {
  const components = new Map(Object.entries(SCHEMAS));
  const fileFindMany = vi.fn(async (args: any) => {
    const ids: number[] = args.where.id.$in;
    return files.filter((f) => ids.includes(f.id));
  });
  const pageFindMany = vi.fn(async (args: any) => {
    const ids: string[] = args.filters.documentId.$in;
    return pages.filter((p) => ids.includes(p.documentId));
  });
  const strapi = {
    get: (key: string) => (key === 'components' ? components : undefined),
    db: { query: (_uid: string) => ({ findMany: fileFindMany }) },
    documents: (_uid: string) => ({ findMany: pageFindMany }),
  } as any;
  return { strapi, fileFindMany, pageFindMany };
}

const imageBlock = (id: string, assetId: number) => ({ id, type: 'block', component: 'preset-atom.image', data: { image: { assetId }, caption: id } });
const linkBlock = (id: string, documentId: string) => ({ id, type: 'block', component: 'preset-atom.button', data: { link: { label: id, page: { documentId } }, variant: 'primary' } });
const bodyOf = (children: unknown[]) => ({ version: 2, root: { type: 'layout', children } });

describe('hydratePageDocs — batched across the whole list', () => {
  const FILES: File[] = [{ id: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' }];
  const PAGES: PageRow[] = [{ documentId: 'a', slug: 'a-page' }];

  const docA = { documentId: 'a', slug: 'a-page', body: bodyOf([imageBlock('b1', 7)]) };
  const docB = { documentId: 'b', slug: 'b-page', body: bodyOf([linkBlock('b2', 'a'), imageBlock('b3', 999)]) };
  const docC = { documentId: 'c', slug: 'c-page', body: bodyOf([linkBlock('b4', 'zzz-missing')]) };
  const docNoBody = { documentId: 'd', slug: 'd-page', body: null };

  it('issues exactly one upload.file findMany and one pages findMany for the whole list (the N+1 regression guard)', async () => {
    const { strapi, fileFindMany, pageFindMany } = makeStrapi(FILES, PAGES);
    await hydratePageDocs(strapi, [docA, docB, docC, docNoBody, null as any]);
    expect(fileFindMany).toHaveBeenCalledTimes(1);
    expect(pageFindMany).toHaveBeenCalledTimes(1);
    // combined refs across ALL docs, not just the first
    expect(fileFindMany.mock.calls[0][0].where.id.$in.sort()).toEqual([7, 999]);
    expect(pageFindMany.mock.calls[0][0].filters.documentId.$in.sort()).toEqual(['a', 'zzz-missing']);
  });

  it('hydrates each doc to the exact wire shape and passes null/body-less docs through untouched', async () => {
    const { strapi } = makeStrapi(FILES, PAGES);
    const out = await hydratePageDocs(strapi, [docA, docB, docC, docNoBody, null as any]);

    expect((out[0] as any).body.root.children[0].data.image).toEqual({
      assetId: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png',
    });

    const bDoc = out[1] as any;
    expect(bDoc.body.root.children[0].data.link.page).toEqual({ documentId: 'a', slug: 'a-page' }); // published → slug attached
    expect(bDoc.body.root.children[1].data.image).toBeNull(); // missing asset → null

    const cDoc = out[2] as any;
    const missingPageRef = cDoc.body.root.children[0].data.link.page;
    expect(missingPageRef).toEqual({ documentId: 'zzz-missing' });
    expect(missingPageRef).not.toHaveProperty('slug'); // unpublished/missing → ref kept, no slug key

    expect(out[3]).toBe(docNoBody); // body-less doc: same reference, untouched
    expect(out[4]).toBeNull(); // null doc entry: passed through
  });
});

describe('hydratePageDoc — single doc still resolves correctly', () => {
  it('hydrates media and page refs for one doc', async () => {
    const { strapi } = makeStrapi(
      [{ id: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' }],
      [{ documentId: 'a', slug: 'a-page' }],
    );
    const doc = { documentId: 'a', slug: 'a-page', body: bodyOf([imageBlock('b1', 7)]) };
    const out = await hydratePageDoc(strapi, doc);
    expect((out as any).body.root.children[0].data.image.url).toBe('/uploads/x.png');
  });

  it('passes a null doc through untouched', async () => {
    const { strapi } = makeStrapi([], []);
    expect(await hydratePageDoc(strapi, null)).toBeNull();
  });
});

describe('hydrateSiteSetting', () => {
  const FILES: File[] = [{ id: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' }];
  const PAGES: PageRow[] = [{ documentId: 'a', slug: 'a-page' }];

  it('hydrates pageDefaults.header/.footer bare Node[]', async () => {
    const { strapi } = makeStrapi(FILES, PAGES);
    const data = {
      name: 'Acme',
      pageDefaults: { header: [imageBlock('h1', 7)], footer: [linkBlock('f1', 'a')] },
    };
    const out = await hydrateSiteSetting(strapi, data);
    expect((out as any).pageDefaults.header[0].data.image).toEqual({
      assetId: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png',
    });
    expect((out as any).pageDefaults.footer[0].data.link.page).toEqual({ documentId: 'a', slug: 'a-page' });
  });

  it('is tolerant of a null record — passes through, no throw', async () => {
    const { strapi } = makeStrapi([], []);
    await expect(hydrateSiteSetting(strapi, null)).resolves.toBeNull();
  });

  it('is tolerant of a pageDefaults-less record — passes through, no throw', async () => {
    const { strapi } = makeStrapi([], []);
    const data: { name: string; pageDefaults?: unknown } = { name: 'Acme' };
    await expect(hydrateSiteSetting(strapi, data)).resolves.toEqual(data);
  });
});
