import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DEFAULT_LAYOUT, type LayoutDefaults, type Node, type PressTree } from '@ogs-tech/press-shared';
import { TreeRenderer } from './tree-renderer';

const site = (overrides: Partial<{ header: Node[]; footer: Node[]; layout: LayoutDefaults }> = {}) =>
  ({
    brand: { name: 'Press', favicon: '' },
    routes: { home: 'home' },
    pageDefaults: { header: overrides.header ?? [], footer: overrides.footer ?? [] },
    layout: overrides.layout ?? DEFAULT_LAYOUT,
  }) as any;

const tree = (children: Node[], extra: Partial<PressTree['root']> = {}): PressTree => ({
  version: 2,
  root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children, ...extra },
});

const paragraph = (id: string, content: string): Node => ({
  id, type: 'block', component: 'preset-atom.paragraph', data: { content },
});

describe('TreeRenderer', () => {
  it('renders header/main/footer with top-level blocks as DIRECT main children (prose rail)', () => {
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, { body: tree([paragraph('p1', 'Hello')]), site: site() }),
    );
    expect(html).toContain('<header></header>');
    expect(html).toMatch(/<main[^>]*><div data-block="preset-atom.paragraph">/);
    expect(html).toContain('<footer></footer>');
  });

  it('renders a top-level row as Container>Grid>Column and a NESTED row as bare Grid (recursion)', () => {
    const body = tree([{
      id: 'r1', type: 'row', container: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      children: [
        { id: 'c1', type: 'column', span: { base: 12, md: 4 }, children: [paragraph('p2', 'left')] },
        { id: 'c2', type: 'column', span: { base: 12, md: 8 }, container: { verticalAlign: 'bottom', gap: 'spacious' }, children: [{
          id: 'r2', type: 'row', children: [
            { id: 'c3', type: 'column', span: { base: 12, md: 6 }, children: [paragraph('p3', 'deep')] },
            { id: 'c4', type: 'column', span: { base: 12, md: 6 }, children: [] },
          ],
        }] },
      ],
    }]);
    const html = renderToStaticMarkup(createElement(TreeRenderer, { body, site: site() }));
    expect(html).toContain('data-max-width="full"');                       // width applied top-level
    expect((html.match(/data-press-layout="grid"/g) ?? []).length).toBe(2); // outer + nested grid
    expect((html.match(/data-press-layout="container"/g) ?? []).length).toBe(1); // nested row gets NO Container
    expect(html).toContain('data-align-items="center"');
    expect(html).toContain('data-cell-align="end"');
    expect(html).toContain('--press-cell-gap:var(--press-space-7)');
    expect(html).toContain('--press-col-span-md:4');   // first column's md span
    expect(html).toContain('--press-col-span-md:8');   // second column's md span
    expect(html).toContain('deep');
  });

  it('resolves inherit slots against pageDefaults and hydrates the navbar there', () => {
    const navbar: Node = { id: 'n', type: 'block', component: 'preset-organism.navbar', data: { items: [{ label: 'Home', url: '/' }] } };
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, {
        body: tree([], { header: { mode: 'inherit' } }),
        site: site({ header: [navbar] }),
      }),
    );
    expect(html).toContain('data-block="preset-organism.navbar"');
    expect(html).toContain('Press'); // hydrated brand
  });

  it('applies the root gap as a main stack and omits it when undeclared', () => {
    const withGap = tree([paragraph('p', 'x')], { container: { gap: 'compact' } });
    expect(renderToStaticMarkup(createElement(TreeRenderer, { body: withGap, site: site() })))
      .toMatch(/<main[^>]*data-press-stack[^>]*style="--press-tree-gap:var\(--press-space-3\)"/);
    expect(renderToStaticMarkup(createElement(TreeRenderer, { body: tree([]), site: site() })))
      .not.toContain('data-press-stack');
  });

  it('fails an invalid body to empty but KEEPS the inherited chrome (Spec §7)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const navbar: Node = { id: 'n', type: 'block', component: 'preset-organism.navbar', data: {} };
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, { body: { version: 99 }, site: site({ header: [navbar] }) }),
    );
    expect(html).toContain('data-block="preset-organism.navbar"');
    expect(html).toMatch(/<main[^>]*><\/main>/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('skips unknown components with a dev warning and honors adopter overrides', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = tree([
      { id: 'u', type: 'block', component: 'custom-organism.mystery', data: {} },
      { id: 'h', type: 'block', component: 'preset-organism.hero', data: { title: 'T' } },
    ]);
    const MyHero = () => createElement('div', { 'data-my-hero': '' }, 'override');
    const html = renderToStaticMarkup(
      createElement(TreeRenderer, { body, site: site(), components: { 'preset-organism.hero': MyHero } }),
    );
    expect(html).toContain('data-my-hero');
    expect(html).not.toContain('mystery');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('custom-organism.mystery'));
    warn.mockRestore();
  });

  it('resolves an undeclared node attr against the SITE layout defaults at every level', () => {
    const layout: LayoutDefaults = {
      page: { gap: 'compact' },
      row: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      column: { gap: 'spacious', verticalAlign: 'bottom' },
    };
    const body = tree([{
      id: 'r', type: 'row', children: [
        { id: 'c', type: 'column', span: { base: 12 }, children: [paragraph('p', 'x')] },
      ],
    }]);
    const html = renderToStaticMarkup(createElement(TreeRenderer, { body, site: site({ layout }) }));
    expect(html).toContain('data-max-width="full"');                             // row.width
    expect(html).toContain('--press-grid-gap-current:var(--press-grid-gap-sm)');  // row.gap compact
    expect(html).toContain('data-align-items="center"');                          // row.verticalAlign
    expect(html).toContain('data-cell-align="end"');                              // column.verticalAlign
    expect(html).toContain('--press-cell-gap:var(--press-space-7)');              // column.gap spacious
    expect(html).toMatch(/<main[^>]*data-press-stack[^>]*--press-tree-gap:var\(--press-space-3\)/); // page.gap
  });

  it('lets a node container attr override the site default', () => {
    const layout: LayoutDefaults = {
      page: {},
      row: { width: 'full', gap: 'compact', verticalAlign: 'center' },
      column: { verticalAlign: 'top' },
    };
    const body = tree([{
      id: 'r', type: 'row', container: { width: 'prose' },
      children: [{ id: 'c', type: 'column', span: { base: 12 }, children: [paragraph('p', 'x')] }],
    }]);
    const html = renderToStaticMarkup(createElement(TreeRenderer, { body, site: site({ layout }) }));
    expect(html).toContain('data-max-width="prose"');   // node wins
    expect(html).toContain('data-align-items="center"'); // untouched attr still inherits the site
  });
});
