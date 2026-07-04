import { describe, expect, it } from 'vitest';
import { buildMetadata } from './build-metadata';
import type { ResolvedPressConfig } from './types';

const resolved: ResolvedPressConfig = {
  urn: 'urn:site-setting:default',
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: 'https://acme.test', locale: 'en' },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: 'https://acme.test/og.png',
  },
  routes: { home: 'home' },
  theme: {
    name: 'default',
    colors: {
      primary: '#119350', accent: '#D9A12C', secondary: '#3D5CC2', ink: '#142036',
      surface: '#FAF8F3', muted: '#7A7E89', danger: '#C0392B', onPrimary: '#FFFFFF',
      border: 'rgba(20,32,54,0.12)',
    },
    fonts: {},
    radius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
  },
  chrome: { header: [], footer: [] },
};

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
    const noDesc: ResolvedPressConfig = { ...resolved, seo: { ...resolved.seo, defaultDescription: '' } };
    const m = buildMetadata(noDesc, null);
    expect(m.description).toBeUndefined();
    expect(m.openGraph?.description).toBeUndefined();
  });
});
