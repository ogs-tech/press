import { describe, expect, it } from 'vitest';
import { pascalForUid, tsTypeForAttribute, generateTypes } from './generate';

describe('pascalForUid', () => {
  it('PascalCases each dotted segment (hyphens included) and concatenates', () => {
    expect(pascalForUid('preset-atom.paragraph')).toBe('PresetAtomParagraph');
    expect(pascalForUid('custom-organism.callout')).toBe('CustomOrganismCallout');
    expect(pascalForUid('custom-organism.call-to-action')).toBe('CustomOrganismCallToAction');
  });
});

describe('tsTypeForAttribute', () => {
  it('maps scalars', () => {
    expect(tsTypeForAttribute({ type: 'string' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'text' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'uid' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'integer' })).toBe('number');
    expect(tsTypeForAttribute({ type: 'decimal' })).toBe('number');
    expect(tsTypeForAttribute({ type: 'boolean' })).toBe('boolean');
    expect(tsTypeForAttribute({ type: 'datetime' })).toBe('string');
    expect(tsTypeForAttribute({ type: 'json' })).toBe('unknown');
  });

  it('maps enumeration to a string-literal union', () => {
    expect(tsTypeForAttribute({ type: 'enumeration', enum: ['info', 'warning'] }))
      .toBe("'info' | 'warning'");
  });

  it('maps an empty enum to never', () => {
    expect(tsTypeForAttribute({ type: 'enumeration', enum: [] })).toBe('never');
  });

  it('maps media to PressMedia, honoring `multiple`', () => {
    expect(tsTypeForAttribute({ type: 'media', multiple: false })).toBe('PressMedia');
    expect(tsTypeForAttribute({ type: 'media', multiple: true })).toBe('PressMedia[]');
  });

  it('falls back to unknown for unrecognized types', () => {
    expect(tsTypeForAttribute({ type: 'relation' })).toBe('unknown');
  });

  it('maps a relation targeting the page content-type to PressPageRef; other relations remain unknown', () => {
    expect(tsTypeForAttribute({ type: 'relation', target: 'plugin::press-cms.page' } as any)).toBe('PressPageRef');
    expect(tsTypeForAttribute({ type: 'relation' })).toBe('unknown');
  });

  it('maps a component reference to its interface name, honoring `repeatable` (Spec §2)', () => {
    expect(tsTypeForAttribute({ type: 'component', component: 'preset-molecule.nav-item', repeatable: true }))
      .toBe('PresetMoleculeNavItem[]');
    expect(tsTypeForAttribute({ type: 'component', component: 'preset-atom.button', repeatable: false }))
      .toBe('PresetAtomButton');
  });
});

describe('generateTypes', () => {
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          slug: { type: 'uid' },
          body: { type: 'customField', customField: 'plugin::press-cms.builder' },
        },
      },
    },
    components: {
      'preset-atom.paragraph': {
        uid: 'preset-atom.paragraph',
        attributes: {
          content: { type: 'blocks', required: true },
        },
      },
      'preset-atom.image': {
        uid: 'preset-atom.image',
        attributes: {
          image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
          caption: { type: 'string' },
        },
      },
      'preset-molecule.link': {
        uid: 'preset-molecule.link',
        attributes: {
          label: { type: 'string', required: true },
          page: { type: 'relation', target: 'plugin::press-cms.page' },
        },
      },
      'custom-organism.callout': {
        uid: 'custom-organism.callout',
        attributes: {
          message: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info' },
        },
      },
    },
  };

  const out = generateTypes(schema as any);

  it('imports PressTree from @ogs-tech/press-web', () => {
    expect(out).toContain("import type { PressTree } from '@ogs-tech/press-web';");
  });

  it('emits a fixed PressMedia interface', () => {
    expect(out).toContain('export interface PressMedia');
    expect(out).toContain('url: string');
  });

  it('emits a PressPageRef interface for page relations', () => {
    expect(out).toContain('export interface PressPageRef {');
    expect(out).toContain('documentId: string;');
    expect(out).toContain('slug?: string;');
  });

  it('emits the paragraph interface with no __component/id (tree data objects, not DZ rows)', () => {
    expect(out).toContain('export interface PresetAtomParagraph {');
    expect(out).toContain('content: unknown;');
  });

  it('emits the image interface with single media typed PressMedia (required) and optional caption', () => {
    expect(out).toContain('image: PressMedia;');
    expect(out).toContain('caption?: string;');
  });

  it('maps the custom block enum field', () => {
    expect(out).toContain("variant?: 'info' | 'warning' | 'success';");
  });

  it('maps a page relation attribute to PressPageRef, optional when not required', () => {
    expect(out).toContain('export interface PresetMoleculeLink {');
    expect(out).toContain('page?: PressPageRef;');
  });

  it('emits no __component discriminator and no row-only id field on component (data-shape) interfaces', () => {
    expect(out).not.toContain('__component');
    // Excludes `Page` on purpose: Page is a real CMS content-type row (a genuine
    // numeric id + documentId), unlike component interfaces, which are tree
    // `data` objects and never carry a row id.
    expect(out).not.toMatch(/interface (?!Page\b)\w+ \{\n  id: number;/);
  });

  it('emits PageBody as an alias for PressTree — the old DZ unions are gone', () => {
    expect(out).toContain('export type PageBody = PressTree;');
    expect(out).not.toContain('HeaderBlocks');
    expect(out).not.toContain('FooterBlocks');
  });

  it('emits a Page interface whose body is PageBody', () => {
    expect(out).toMatch(/export interface Page \{[\s\S]*body: PageBody;/);
    expect(out).toContain('title: string;');
    expect(out).toContain('documentId: string;');
  });

  it('starts with the do-not-edit banner', () => {
    expect(out.startsWith('// AUTO-GENERATED')).toBe(true);
  });
});

describe('generateTypes — production-shape guard (real serialize-schema strips the customField id)', () => {
  // serialize-schema.ts's KEEP list does not include `customField`, so the real
  // GET /api/press/schema emits page.body as bare `{ type: 'customField' }` — no id
  // string. The generator must recognize the tree body by field name/shape alone,
  // never by the (absent-in-production) customField value.
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'customField' },
        },
      },
    },
    components: {},
  };

  const out = generateTypes(schema as any);

  it('still emits PageBody = PressTree and Page.body: PageBody with no customField id present', () => {
    expect(out).toContain('export type PageBody = PressTree;');
    expect(out).toMatch(/export interface Page \{[\s\S]*body: PageBody;/);
  });
});
