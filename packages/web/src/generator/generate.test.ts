import { describe, expect, it } from 'vitest';
import { pascalForUid, tsTypeForAttribute, generateTypes } from './generate';

describe('pascalForUid', () => {
  it('PascalCases each dotted segment and concatenates', () => {
    expect(pascalForUid('press.hero')).toBe('PressHero');
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
          body: { type: 'dynamiczone', components: ['press.hero', 'custom.callout'] },
        },
      },
    },
    components: {
      'press.hero': {
        uid: 'press.hero',
        attributes: {
          heading: { type: 'string', required: true },
          subheading: { type: 'string' },
          ctaLabel: { type: 'string' },
          image: { type: 'media', multiple: false, allowedTypes: ['images'] },
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

  it('emits a discriminated component interface with __component and required/optional fields', () => {
    expect(out).toContain("__component: 'press.hero'");
    expect(out).toContain('heading: string;');        // required → not optional
    expect(out).toContain('subheading?: string;');    // optional
    expect(out).toContain('image?: PressMedia;');      // media single, optional
  });

  it('maps the custom block enum field', () => {
    expect(out).toContain("__component: 'custom.callout'");
    expect(out).toContain("variant?: 'info' | 'warning' | 'success';");
  });

  it('emits a PageBody union array over the DZ components and a Page interface', () => {
    expect(out).toContain('export type PageBody = (PressHero | CustomCallout)[];');
    expect(out).toContain('export interface Page');
    expect(out).toContain('body: PageBody;');
    expect(out).toContain('title: string;');
    expect(out).toContain('documentId: string;');
  });

  it('starts with the do-not-edit banner', () => {
    expect(out.startsWith('// AUTO-GENERATED')).toBe(true);
  });
});
