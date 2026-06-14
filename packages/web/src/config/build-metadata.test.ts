import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config';
import { buildMetadata } from './build-metadata';

const resolved = resolveConfig({
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: '/og.png',
  },
});

describe('buildMetadata', () => {
  it('applies the title template to a page title (AC1)', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.title).toBe('E2E Home | Acme');
    expect(m.openGraph?.title).toBe('E2E Home | Acme');
  });

  it('uses defaultTitle when there is no page (layout base)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.title).toBe('Acme');
  });

  it('falls back to defaultDescription when the page has none', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.description).toBe('An Acme content site.');
  });

  it('emits an absolute canonical and OG image', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.alternates?.canonical).toBe('https://acme.test');
    expect(m.openGraph?.images).toEqual([{ url: 'https://acme.test/og.png' }]);
  });

  it('derives the favicon icon from brand.favicon (AC2)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.icons).toEqual({ icon: '/favicon.ico' });
  });

  it('uses the page description when provided', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home', description: 'Custom desc' });
    expect(m.description).toBe('Custom desc');
    expect(m.openGraph?.description).toBe('Custom desc');
  });

  it('omits description when the resolved default is empty', () => {
    const noDesc = resolveConfig({ brand: { name: 'Acme' } });
    const m = buildMetadata(noDesc, null);
    expect(m.description).toBeUndefined();
    expect(m.openGraph?.description).toBeUndefined();
  });
});
