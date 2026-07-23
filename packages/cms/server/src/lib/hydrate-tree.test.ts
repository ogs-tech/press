import { describe, expect, it } from 'vitest';
import { collectNodeRefs, collectTreeRefs, hydrateNodeArray, hydrateTree } from './hydrate-tree';

const SCHEMAS: Record<string, any> = {
  'preset-atom.image': { attributes: { image: { type: 'media', multiple: false }, caption: { type: 'string' } } },
  'preset-atom.button': { attributes: { link: { type: 'component', component: 'preset-molecule.link' }, variant: { type: 'enumeration' } } },
  'preset-molecule.link': { attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean' } } },
  'preset-organism.navbar': { attributes: { items: { type: 'component', repeatable: true, component: 'preset-molecule.link' }, cta: { type: 'component', component: 'preset-atom.button' } } },
};
const getSchema = (uid: string) => SCHEMAS[uid];

const resolvers = {
  media: (assetId: number) => (assetId === 7 ? { assetId: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' } : null),
  page: (documentId: string) => (documentId === 'home-doc' ? { documentId: 'home-doc', slug: 'home' } : { documentId }),
};

const nodes = [
  { id: 'b1', type: 'block', component: 'preset-atom.image', data: { image: { assetId: 7 }, caption: 'c' } },
  {
    id: 'r1', type: 'row', children: [
      { id: 'c1', type: 'column', span: { base: 12 }, children: [
        { id: 'b2', type: 'block', component: 'preset-organism.navbar', data: {
          items: [{ label: 'Home', page: { documentId: 'home-doc' } }, { label: 'Ext', url: 'https://x' }],
          cta: { link: { label: 'Go', page: { documentId: 'gone-doc' } }, variant: 'primary' },
        } },
      ] },
      { id: 'c2', type: 'column', span: { base: 12 }, children: [] },
    ],
  },
  { id: 'b3', type: 'block', component: 'unknown.block', data: { anything: true } },
];

describe('collectNodeRefs', () => {
  it('collects media + page refs through rows, columns and nested components', () => {
    const refs = collectNodeRefs(nodes, getSchema);
    expect(refs.assetIds).toEqual([7]);
    expect(refs.pageDocumentIds.sort()).toEqual(['gone-doc', 'home-doc']);
  });

  it('returns empty refs for malformed input', () => {
    expect(collectNodeRefs(null, getSchema)).toEqual({ assetIds: [], pageDocumentIds: [] });
    expect(collectNodeRefs('nope', getSchema)).toEqual({ assetIds: [], pageDocumentIds: [] });
  });
});

describe('hydrateNodeArray', () => {
  it('replaces refs with resolved shapes, deep, without mutating input', () => {
    const out = hydrateNodeArray(nodes, getSchema, resolvers) as any[];
    expect(out[0].data.image).toEqual({ assetId: 7, url: '/uploads/x.png', width: 480, height: 270, alternativeText: null, name: 'x.png', mime: 'image/png' });
    const navbar = out[1].children[0].children[0].data;
    expect(navbar.items[0].page).toEqual({ documentId: 'home-doc', slug: 'home' });
    expect(navbar.items[1]).toEqual({ label: 'Ext', url: 'https://x' });
    expect(navbar.cta.link.page).toEqual({ documentId: 'gone-doc' }); // unpublished → ref kept, no slug
    expect((nodes[0] as any).data.image).toEqual({ assetId: 7 }); // input untouched
  });

  it('nulls a media ref whose asset is gone and leaves unknown components untouched', () => {
    const out = hydrateNodeArray(
      [{ id: 'x', type: 'block', component: 'preset-atom.image', data: { image: { assetId: 999 } } }],
      getSchema,
      resolvers,
    ) as any[];
    expect(out[0].data.image).toBeNull();
    const unknown = hydrateNodeArray([nodes[2]], getSchema, resolvers) as any[];
    expect(unknown[0]).toEqual(nodes[2]);
  });
});

describe('tree-level helpers', () => {
  const tree = {
    version: 2,
    root: {
      type: 'layout',
      header: { mode: 'custom', children: [nodes[0]] },
      footer: { mode: 'inherit' },
      children: [nodes[1]],
    },
  };

  it('collects and hydrates root children AND custom slot children', () => {
    const refs = collectTreeRefs(tree, getSchema);
    expect(refs.assetIds).toEqual([7]);
    expect(refs.pageDocumentIds.sort()).toEqual(['gone-doc', 'home-doc']);
    const out = hydrateTree(tree, getSchema, resolvers) as any;
    expect(out.root.header.children[0].data.image.url).toBe('/uploads/x.png');
    expect(out.root.footer).toEqual({ mode: 'inherit' });
  });

  it('passes malformed trees through untouched', () => {
    expect(hydrateTree(null, getSchema, resolvers)).toBeNull();
    expect(hydrateTree({ nope: 1 }, getSchema, resolvers)).toEqual({ nope: 1 });
  });
});
