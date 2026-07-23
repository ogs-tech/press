import { describe, expect, it } from 'vitest';
import { validatePressTree, validateNodeArray } from '@ogs-tech/press-shared';
// The template ships as plain .mjs data — imported across the package boundary on purpose:
// this test IS the guard that the scaffold seeds a valid tree (spec §8, CLI).
// eslint-not-applicable: repo has no eslint.
import { buildHomeBody, buildPageDefaults } from '../../templates/cms/scripts/seed-content.mjs';

describe('seeded home body', () => {
  const tree = buildHomeBody({ imageAssetId: 7 }) as any;

  it('is a valid PressTree with inherited chrome', () => {
    const { value, errors, warnings } = validatePressTree(tree);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(value!.root.header).toEqual({ mode: 'inherit' });
  });

  it('demonstrates atoms then the grid: heading/paragraph/list atoms + a spanned row (no hero, no nested rows)', () => {
    const children = tree.root.children;
    expect(children.map((n: any) => n.type)).toEqual(['block', 'block', 'block', 'block', 'row']);
    expect(children.slice(0, 4).map((n: any) => n.component)).toEqual([
      'preset-atom.heading', 'preset-atom.paragraph', 'preset-atom.list', 'preset-atom.heading',
    ]);
    expect(children.some((n: any) => n.component === 'preset-organism.hero')).toBe(false);

    const rowNode = children[4];
    expect(rowNode).toMatchObject({ type: 'row' });
    expect(rowNode).not.toHaveProperty('ratio');
    expect(rowNode.children).toHaveLength(2);
    // each column carries a mobile-first span (stacked on phones, 50/50 on desktop)
    expect(rowNode.children[0].span).toEqual({ base: 12, md: 6 });
    expect(rowNode.children[1].span).toEqual({ base: 12, md: 6 });
    // an image atom (media assetId ref) sits in the first column; no deeper row nesting
    const imageAtom = rowNode.children[0].children[0];
    expect(imageAtom).toMatchObject({ type: 'block', component: 'preset-atom.image' });
    expect(imageAtom.data.image).toEqual({ assetId: 7 });
    expect(rowNode.children[1].children.some((n: any) => n.type === 'row')).toBe(false);
  });

  it('uses plain-text content (no blocks AST, no href strings)', () => {
    const json = JSON.stringify(tree);
    expect(json).not.toContain('"type":"paragraph"');   // no blocks AST nodes
    expect(json).not.toContain('ctaHref');
    const paragraph = tree.root.children.find((n: any) => n.component === 'preset-atom.paragraph');
    expect(typeof paragraph.data.content).toBe('string');
  });
});

describe('seeded pageDefaults', () => {
  const pd = buildPageDefaults({ homeDocumentId: 'home-doc' }) as any;

  it('slots validate as Node[] and the Home item is a page ref', () => {
    expect(validateNodeArray(pd.header).errors).toEqual([]);
    expect(validateNodeArray(pd.footer).errors).toEqual([]);
    const navbar = pd.header[0];
    expect(navbar.data.items[0].page).toEqual({ documentId: 'home-doc' });
    expect(navbar.data.cta.link.label).toBe('Get started');
  });
});
