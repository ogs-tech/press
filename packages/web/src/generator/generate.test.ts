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
          body: { type: 'dynamiczone', components: ['preset-atom.paragraph', 'preset-atom.image', 'custom-organism.callout'] },
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
      'custom-organism.callout': {
        uid: 'custom-organism.callout',
        attributes: {
          message: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['info', 'warning', 'success'], default: 'info' },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('emits a fixed PressMedia interface', () => {
    expect(out).toContain('export interface PressMedia');
    expect(out).toContain('url: string');
  });

  it('emits the paragraph interface; its `blocks` content falls through to unknown (required, no ?)', () => {
    expect(out).toContain("__component: 'preset-atom.paragraph'");
    // `blocks` is absent from SCALARS → unknown fallback; required → not optional.
    expect(out).toContain('content: unknown;');
  });

  it('emits the image interface with single media typed PressMedia (required) and optional caption', () => {
    expect(out).toContain("__component: 'preset-atom.image'");
    expect(out).toContain('image: PressMedia;');   // media single, required → not optional
    expect(out).toContain('caption?: string;');    // optional
  });

  it('maps the custom block enum field', () => {
    expect(out).toContain("__component: 'custom-organism.callout'");
    expect(out).toContain("variant?: 'info' | 'warning' | 'success';");
  });

  it('emits a PageBody union array over the DZ components and a Page interface', () => {
    expect(out).toContain('export type PageBody = (PresetAtomParagraph | PresetAtomImage | CustomOrganismCallout)[];');
    expect(out).toContain('export interface Page');
    expect(out).toContain('body: PageBody;');
    expect(out).toContain('title: string;');
    expect(out).toContain('documentId: string;');
  });

  it('starts with the do-not-edit banner', () => {
    expect(out.startsWith('// AUTO-GENERATED')).toBe(true);
  });
});

describe('generateTypes with organism sections', () => {
  // v1 sections are FLAT (scalar/media/enum), so the existing generator emits them
  // with zero change — this test pins that contract (Spec §7).
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['preset-organism.hero', 'preset-organism.cta'] },
        },
      },
    },
    components: {
      'preset-organism.hero': {
        uid: 'preset-organism.hero',
        attributes: {
          eyebrow: { type: 'string' },
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
          ctaLabel: { type: 'string' },
          ctaHref: { type: 'string' },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      },
      'preset-organism.cta': {
        uid: 'preset-organism.cta',
        attributes: {
          title: { type: 'string', required: true },
          subtitle: { type: 'text' },
          buttonLabel: { type: 'string', required: true },
          buttonHref: { type: 'string', required: true },
          align: { type: 'enumeration', enum: ['left', 'center'], default: 'left' },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('derives PascalCase interface names from the organism uids', () => {
    expect(pascalForUid('preset-organism.hero')).toBe('PresetOrganismHero');
    expect(pascalForUid('preset-organism.cta')).toBe('PresetOrganismCta');
  });

  it('emits a PresetOrganismHero interface with correctly optional/required flat fields', () => {
    expect(out).toContain("__component: 'preset-organism.hero'");
    expect(out).toContain('title: string;');                 // required → no ?
    expect(out).toContain('eyebrow?: string;');              // optional
    expect(out).toContain('subtitle?: string;');             // text → string, optional
    expect(out).toContain('image?: PressMedia;');            // single media, optional
    expect(out).toContain("align?: 'left' | 'center';");     // enum union, optional (default ≠ required)
  });

  it('emits a PresetOrganismCta interface with required button fields', () => {
    expect(out).toContain("__component: 'preset-organism.cta'");
    expect(out).toContain('buttonLabel: string;');
    expect(out).toContain('buttonHref: string;');
  });

  it('includes both organisms in the PageBody union', () => {
    expect(out).toContain('export type PageBody = (PresetOrganismHero | PresetOrganismCta)[];');
  });
});

describe('generateTypes with chrome organisms (site-setting DZs)', () => {
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['preset-atom.paragraph', 'preset-atom.button'] },
        },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: { singularName: 'site-setting' },
        attributes: {
          name: { type: 'string' },
          header: { type: 'dynamiczone', components: ['preset-organism.navbar', 'preset-atom.paragraph', 'custom-organism.callout'] },
          footer: { type: 'dynamiczone', components: ['preset-organism.footer'] },
        },
      },
    },
    components: {
      'preset-atom.paragraph': {
        uid: 'preset-atom.paragraph',
        attributes: { content: { type: 'blocks', required: true } },
      },
      'preset-atom.button': {
        uid: 'preset-atom.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      },
      'custom-organism.callout': {
        uid: 'custom-organism.callout',
        attributes: { message: { type: 'string', required: true } },
      },
      'preset-organism.navbar': {
        uid: 'preset-organism.navbar',
        attributes: {
          items: { type: 'component', repeatable: true, component: 'preset-molecule.nav-item' },
          cta: { type: 'component', repeatable: false, component: 'preset-atom.button' },
        },
      },
      'preset-organism.footer': {
        uid: 'preset-organism.footer',
        attributes: { text: { type: 'string' } },
      },
      'preset-molecule.nav-item': {
        uid: 'preset-molecule.nav-item',
        attributes: {
          label: { type: 'string', required: true },
          page: { type: 'relation' },
          url: { type: 'string' },
          newTab: { type: 'boolean', default: false },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('types nested component references (repeatable → array, single → plain)', () => {
    expect(out).toContain('items?: PresetMoleculeNavItem[];');
    expect(out).toContain('cta?: PresetAtomButton;');
  });

  it('emits a nested-only component WITHOUT __component — Strapi sends no discriminator for nested components (Spec §2)', () => {
    expect(out).toContain('export interface PresetMoleculeNavItem {');
    expect(out).not.toContain("__component: 'preset-molecule.nav-item'");
    // Its scalar fields survive with correct optionality.
    expect(out).toContain('label: string;');
    expect(out).toContain('url?: string;');
    expect(out).toContain('newTab?: boolean;');
  });

  it('keeps __component on a component that IS a DZ member somewhere (preset-atom.button in body)', () => {
    expect(out).toContain("__component: 'preset-atom.button'");
  });

  it('skips relation attributes — resolved at runtime by the web side, never consumed raw (Spec §2)', () => {
    expect(out).not.toContain('page?:');
    expect(out).not.toContain('page:');
  });

  it('emits HeaderBlocks and FooterBlocks unions alongside PageBody (Spec §2)', () => {
    expect(out).toContain('export type HeaderBlocks = (PresetOrganismNavbar | PresetAtomParagraph | CustomOrganismCallout)[];');
    expect(out).toContain('export type FooterBlocks = (PresetOrganismFooter)[];');
    expect(out).toContain('export type PageBody = (PresetAtomParagraph | PresetAtomButton)[];');
  });

  it('omits the chrome unions when the schema has no site-setting entry (version-skew tolerance)', () => {
    const pageOnly = { contentTypes: { 'plugin::press-cms.page': schema.contentTypes['plugin::press-cms.page'] }, components: { 'preset-atom.paragraph': schema.components['preset-atom.paragraph'], 'preset-atom.button': schema.components['preset-atom.button'] } };
    const legacy = generateTypes(pageOnly);
    expect(legacy).not.toContain('HeaderBlocks');
    expect(legacy).not.toContain('FooterBlocks');
    expect(legacy).toContain('export type PageBody');
  });
});

describe('generateTypes with the two-level columns chain (preset-organism.columns)', () => {
  // The navbar coverage above pins ONE level of nesting; the columns chain is the
  // first TWO-level one (DZ member → repeatable molecule → nested atom). Pins that
  // the generator needs zero code change for it (Spec §2 / §7).
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['preset-organism.columns'] },
        },
      },
    },
    components: {
      'preset-organism.columns': {
        uid: 'preset-organism.columns',
        attributes: {
          ratio: { type: 'enumeration', enum: ['50-50', '33-67', '67-33', '33-33-33', '25-25-25-25'], default: '50-50' },
          gap: { type: 'enumeration', enum: ['compact', 'normal', 'spacious'], default: 'normal' },
          verticalAlign: { type: 'enumeration', enum: ['top', 'center', 'bottom'], default: 'top' },
          columns: { type: 'component', repeatable: true, component: 'preset-molecule.column' },
        },
      },
      'preset-molecule.column': {
        uid: 'preset-molecule.column',
        attributes: {
          content: { type: 'blocks' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
          button: { type: 'component', repeatable: false, component: 'preset-atom.button' },
        },
      },
      'preset-atom.button': {
        uid: 'preset-atom.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      },
    },
  };

  const out = generateTypes(schema);

  it('emits the organism with the closed layout enums and the repeatable nested column array', () => {
    expect(out).toContain("__component: 'preset-organism.columns'");
    expect(out).toContain("ratio?: '50-50' | '33-67' | '67-33' | '33-33-33' | '25-25-25-25';");
    expect(out).toContain("gap?: 'compact' | 'normal' | 'spacious';");
    expect(out).toContain("verticalAlign?: 'top' | 'center' | 'bottom';");
    expect(out).toContain('columns?: PresetMoleculeColumn[];');
  });

  it('emits the nested-only column without __component, typing media and the nested button ref', () => {
    expect(out).toContain('export interface PresetMoleculeColumn {');
    expect(out).not.toContain("__component: 'preset-molecule.column'");
    expect(out).toContain('content?: unknown;');      // blocks → unknown fallback (documented)
    expect(out).toContain('image?: PressMedia;');     // media survives at nesting depth 2
    expect(out).toContain('button?: PresetAtomButton;');
  });

  it('keeps the DZ member alone in PageBody — nested components never enter the union', () => {
    expect(out).toContain('export type PageBody = (PresetOrganismColumns)[];');
  });
});
