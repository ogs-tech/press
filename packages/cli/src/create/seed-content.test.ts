import { describe, expect, it } from 'vitest';
import { validatePressTree, validateNodeArray } from '@ogs-tech/press-shared';
// The template ships as plain .mjs data — imported across the package boundary on purpose:
// this test IS the guard that the scaffold seeds a valid tree (spec §8, CLI).
// eslint-not-applicable: repo has no eslint.
import { buildHomeBody, buildPageDefaults } from '../../templates/cms/scripts/seed-content.mjs';

describe('seeded home body', () => {
  const tree = buildHomeBody({ heroAssetId: 7 }) as any;

  it('is a valid PressTree with inherited chrome', () => {
    const { value, errors, warnings } = validatePressTree(tree);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(value!.root.header).toEqual({ mode: 'inherit' });
  });

  it('opens with the hero (assetId media ref) and closes with cta + adopter callout', () => {
    const children = tree.root.children;
    expect(children[0]).toMatchObject({ type: 'block', component: 'preset-organism.hero' });
    expect(children[0].data.image).toEqual({ assetId: 7 });
    expect(children.at(-2)).toMatchObject({ component: 'preset-organism.cta' });
    expect(children.at(-1)).toMatchObject({ component: 'custom-organism.callout' });
  });

  it('demonstrates recursion: a 50-50 row whose column nests another row', () => {
    const rowNode = tree.root.children.find((n: any) => n.type === 'row');
    expect(rowNode.ratio).toBe('50-50');
    const nested = rowNode.children[1].children.find((n: any) => n.type === 'row');
    expect(nested).toBeDefined();
    expect(nested.children).toHaveLength(2);
  });

  it('uses plain-text content and link descriptors (no blocks AST, no href strings)', () => {
    const json = JSON.stringify(tree);
    expect(json).not.toContain('"type":"paragraph"');   // no blocks AST nodes
    expect(json).not.toContain('ctaHref');
    const button = tree.root.children.find((n: any) => n.component === 'preset-atom.button');
    expect(button.data.link).toMatchObject({ label: 'Star on GitHub' });
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
