import { describe, expect, it } from 'vitest';
import type { Node, PressTree } from '@ogs-tech/press-shared';
import { hydrateEngineBlocks, resolveTree } from './resolve-slots';

const brand = { name: 'Press', logo: 'http://cms/logo.png' };

const navbarNode = (): Node => ({
  id: 'nav', type: 'block', component: 'preset-organism.navbar',
  data: {
    items: [
      { label: 'Home', page: { documentId: 'd1', slug: 'home' } },
      { label: 'GH', url: 'https://github.com', newTab: true },
      { label: 'dead' }, // unresolvable → dropped from links
    ],
    cta: { link: { label: 'Go', url: '/go' }, variant: 'secondary' },
  },
});

const site = (defaults: { header?: Node[]; footer?: Node[] }) =>
  ({
    brand: { ...brand, favicon: '' },
    routes: { home: 'home' },
    pageDefaults: { header: defaults.header ?? [], footer: defaults.footer ?? [] },
  }) as any;

const tree = (header: any, footer: any, children: Node[] = []): PressTree => ({
  version: 2,
  root: { type: 'layout', header, footer, children },
});

describe('hydrateEngineBlocks', () => {
  it('hydrates navbar brand/links/cta with home-slug collapse, at any depth', () => {
    const nested: Node[] = [{
      id: 'r', type: 'row', children: [
        { id: 'c', type: 'column', span: { base: 12 }, children: [navbarNode()] },
        { id: 'c2', type: 'column', span: { base: 12 }, children: [] },
      ],
    }];
    const [row] = hydrateEngineBlocks(nested, brand, 'home') as any[];
    const nav = row.children[0].children[0].data;
    expect(nav.brand).toEqual(brand);
    expect(nav.links).toEqual([
      { label: 'Home', href: '/', external: false, newTab: false },
      { label: 'GH', href: 'https://github.com', external: true, newTab: true },
    ]);
    expect(nav.cta).toMatchObject({ label: 'Go', href: '/go', variant: 'secondary' });
  });

  it('resolves button/hero/cta link fields and injects the footer brand', () => {
    const nodes: Node[] = [
      { id: 'b', type: 'block', component: 'preset-atom.button', data: { link: { label: 'Docs', page: { documentId: 'd9', slug: 'docs' } }, variant: 'primary' } },
      { id: 'h', type: 'block', component: 'preset-organism.hero', data: { title: 'T', cta: { label: 'Read', url: '/read' } } },
      { id: 'f', type: 'block', component: 'preset-organism.footer', data: {} },
      { id: 'x', type: 'block', component: 'custom-organism.callout', data: { message: 'untouched' } },
    ];
    const out = hydrateEngineBlocks(nodes, brand, 'home') as any[];
    expect(out[0].data.link).toEqual({ label: 'Docs', href: '/docs', external: false, newTab: false });
    expect(out[1].data.cta.href).toBe('/read');
    expect(out[2].data.brand).toEqual({ name: 'Press' });
    expect(out[3].data).toEqual({ message: 'untouched' }); // adopter data is never touched
    expect(nodes[0].type === 'block' && (nodes[0].data as any).link.page.slug).toBe('docs'); // input not mutated
  });
});

describe('resolveTree slot matrix', () => {
  const defaults = { header: [navbarNode()], footer: [{ id: 'f', type: 'block', component: 'preset-organism.footer', data: {} } as Node] };

  it('inherit pulls (and hydrates) pageDefaults; none is empty; custom wins', () => {
    const inherited = resolveTree(tree({ mode: 'inherit' }, { mode: 'inherit' }), site(defaults));
    expect((inherited.header[0] as any).data.brand).toEqual(brand);
    expect((inherited.footer[0] as any).data.brand).toEqual({ name: 'Press' });

    const bare = resolveTree(tree({ mode: 'none' }, { mode: 'none' }), site(defaults));
    expect(bare.header).toEqual([]);
    expect(bare.footer).toEqual([]);

    const custom = resolveTree(
      tree({ mode: 'custom', children: [{ id: 'p', type: 'block', component: 'preset-atom.paragraph', data: { content: 'x' } }] }, { mode: 'none' }),
      site(defaults),
    );
    expect((custom.header[0] as any).component).toBe('preset-atom.paragraph');
  });

  it('inherit against absent defaults renders bare (fail-to-empty)', () => {
    const out = resolveTree(tree({ mode: 'inherit' }, { mode: 'inherit' }), site({}));
    expect(out.header).toEqual([]);
  });

  it('carries the root container and hydrates body children too', () => {
    const t = tree({ mode: 'none' }, { mode: 'none' }, [
      { id: 'b', type: 'block', component: 'preset-atom.button', data: { link: { label: 'Go', url: '/g' } } },
    ]);
    t.root.container = { gap: 'spacious' };
    const out = resolveTree(t, site({}));
    expect(out.rootContainer).toEqual({ gap: 'spacious' });
    expect((out.children[0] as any).data.link.href).toBe('/g');
  });
});
