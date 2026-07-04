import { describe, expect, it } from 'vitest';
import { pascalForUid, tsTypeForAttribute, generateTypes } from './generate';

describe('pascalForUid', () => {
  it('PascalCases each dotted segment and concatenates', () => {
    expect(pascalForUid('press.paragraph')).toBe('PressParagraph');
    expect(pascalForUid('custom.callout')).toBe('CustomCallout');
    expect(pascalForUid('custom.call-to-action')).toBe('CustomCallToAction');
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
    expect(tsTypeForAttribute({ type: 'component', component: 'press.nav-item', repeatable: true }))
      .toBe('PressNavItem[]');
    expect(tsTypeForAttribute({ type: 'component', component: 'press.button', repeatable: false }))
      .toBe('PressButton');
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
          body: { type: 'dynamiczone', components: ['press.paragraph', 'press.image', 'custom.callout'] },
        },
      },
    },
    components: {
      'press.paragraph': {
        uid: 'press.paragraph',
        attributes: {
          content: { type: 'blocks', required: true },
        },
      },
      'press.image': {
        uid: 'press.image',
        attributes: {
          image: { type: 'media', multiple: false, allowedTypes: ['images'], required: true },
          caption: { type: 'string' },
        },
      },
      'custom.callout': {
        uid: 'custom.callout',
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
    expect(out).toContain("__component: 'press.paragraph'");
    // `blocks` is absent from SCALARS → unknown fallback; required → not optional.
    expect(out).toContain('content: unknown;');
  });

  it('emits the image interface with single media typed PressMedia (required) and optional caption', () => {
    expect(out).toContain("__component: 'press.image'");
    expect(out).toContain('image: PressMedia;');   // media single, required → not optional
    expect(out).toContain('caption?: string;');    // optional
  });

  it('maps the custom block enum field', () => {
    expect(out).toContain("__component: 'custom.callout'");
    expect(out).toContain("variant?: 'info' | 'warning' | 'success';");
  });

  it('emits a PageBody union array over the DZ components and a Page interface', () => {
    expect(out).toContain('export type PageBody = (PressParagraph | PressImage | CustomCallout)[];');
    expect(out).toContain('export interface Page');
    expect(out).toContain('body: PageBody;');
    expect(out).toContain('title: string;');
    expect(out).toContain('documentId: string;');
  });

  it('starts with the do-not-edit banner', () => {
    expect(out.startsWith('// AUTO-GENERATED')).toBe(true);
  });
});

describe('generateTypes with section.* blocks', () => {
  // v1 sections are FLAT (scalar/media/enum), so the existing generator emits them
  // with zero change — this test pins that contract (Spec §7).
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['section.hero', 'section.cta'] },
        },
      },
    },
    components: {
      'section.hero': {
        uid: 'section.hero',
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
      'section.cta': {
        uid: 'section.cta',
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

  it('derives PascalCase interface names from the section uids', () => {
    expect(pascalForUid('section.hero')).toBe('SectionHero');
    expect(pascalForUid('section.cta')).toBe('SectionCta');
  });

  it('emits a SectionHero interface with correctly optional/required flat fields', () => {
    expect(out).toContain("__component: 'section.hero'");
    expect(out).toContain('title: string;');                 // required → no ?
    expect(out).toContain('eyebrow?: string;');              // optional
    expect(out).toContain('subtitle?: string;');             // text → string, optional
    expect(out).toContain('image?: PressMedia;');            // single media, optional
    expect(out).toContain("align?: 'left' | 'center';");     // enum union, optional (default ≠ required)
  });

  it('emits a SectionCta interface with required button fields', () => {
    expect(out).toContain("__component: 'section.cta'");
    expect(out).toContain('buttonLabel: string;');
    expect(out).toContain('buttonHref: string;');
  });

  it('includes both sections in the PageBody union', () => {
    expect(out).toContain('export type PageBody = (SectionHero | SectionCta)[];');
  });
});

describe('generateTypes with chrome blocks (site-setting DZs)', () => {
  const schema = {
    contentTypes: {
      'plugin::press-cms.page': {
        uid: 'plugin::press-cms.page',
        info: { singularName: 'page' },
        attributes: {
          title: { type: 'string', required: true },
          body: { type: 'dynamiczone', components: ['press.paragraph', 'press.button'] },
        },
      },
      'plugin::press-cms.site-setting': {
        uid: 'plugin::press-cms.site-setting',
        info: { singularName: 'site-setting' },
        attributes: {
          name: { type: 'string' },
          header: { type: 'dynamiczone', components: ['chrome.navbar', 'press.paragraph', 'custom.callout'] },
          footer: { type: 'dynamiczone', components: ['chrome.footer'] },
        },
      },
    },
    components: {
      'press.paragraph': {
        uid: 'press.paragraph',
        attributes: { content: { type: 'blocks', required: true } },
      },
      'press.button': {
        uid: 'press.button',
        attributes: {
          label: { type: 'string', required: true },
          href: { type: 'string', required: true },
          variant: { type: 'enumeration', enum: ['primary', 'secondary'], default: 'primary', required: true },
        },
      },
      'custom.callout': {
        uid: 'custom.callout',
        attributes: { message: { type: 'string', required: true } },
      },
      'chrome.navbar': {
        uid: 'chrome.navbar',
        attributes: {
          items: { type: 'component', repeatable: true, component: 'press.nav-item' },
          cta: { type: 'component', repeatable: false, component: 'press.button' },
        },
      },
      'chrome.footer': {
        uid: 'chrome.footer',
        attributes: { text: { type: 'string' } },
      },
      'press.nav-item': {
        uid: 'press.nav-item',
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
    expect(out).toContain('items?: PressNavItem[];');
    expect(out).toContain('cta?: PressButton;');
  });

  it('emits a nested-only component WITHOUT __component — Strapi sends no discriminator for nested components (Spec §2)', () => {
    expect(out).toContain('export interface PressNavItem {');
    expect(out).not.toContain("__component: 'press.nav-item'");
    // Its scalar fields survive with correct optionality.
    expect(out).toContain('label: string;');
    expect(out).toContain('url?: string;');
    expect(out).toContain('newTab?: boolean;');
  });

  it('keeps __component on a component that IS a DZ member somewhere (press.button in body)', () => {
    expect(out).toContain("__component: 'press.button'");
  });

  it('skips relation attributes — resolved at runtime by the web side, never consumed raw (Spec §2)', () => {
    expect(out).not.toContain('page?:');
    expect(out).not.toContain('page:');
  });

  it('emits HeaderBlocks and FooterBlocks unions alongside PageBody (Spec §2)', () => {
    expect(out).toContain('export type HeaderBlocks = (ChromeNavbar | PressParagraph | CustomCallout)[];');
    expect(out).toContain('export type FooterBlocks = (ChromeFooter)[];');
    expect(out).toContain('export type PageBody = (PressParagraph | PressButton)[];');
  });

  it('omits the chrome unions when the schema has no site-setting entry (version-skew tolerance)', () => {
    const pageOnly = { contentTypes: { 'plugin::press-cms.page': schema.contentTypes['plugin::press-cms.page'] }, components: { 'press.paragraph': schema.components['press.paragraph'], 'press.button': schema.components['press.button'] } };
    const legacy = generateTypes(pageOnly);
    expect(legacy).not.toContain('HeaderBlocks');
    expect(legacy).not.toContain('FooterBlocks');
    expect(legacy).toContain('export type PageBody');
  });
});
