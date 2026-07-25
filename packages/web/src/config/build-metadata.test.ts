import { describe, expect, it } from 'vitest';
import { buildMetadata } from './build-metadata';
import { mapCookieConsent } from '../plugins/cookie-consent/map-cookie-consent';
import type { ResolvedPressConfig } from './types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';

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
  pageDefaults: { header: [], footer: [] },
  layout: DEFAULT_LAYOUT,
  plugins: { cookieConsent: mapCookieConsent(null, 'home') },
};

describe('buildMetadata', () => {
  it('applies the title template to a page title (AC1)', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.title).toBe('E2E Home | Acme');
  });

  it('uses defaultTitle when there is no page (layout base)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.title).toBe('Acme');
  });

  it('derives the favicon icon from brand.favicon (AC2)', () => {
    const m = buildMetadata(resolved, null);
    expect(m.icons).toEqual({ icon: '/favicon.ico' });
  });

  it('omits the favicon when brand.favicon is empty', () => {
    const noFavicon: ResolvedPressConfig = { ...resolved, brand: { ...resolved.brand, favicon: '' } };
    const m = buildMetadata(noFavicon, null);
    expect(m.icons).toBeUndefined();
  });

  it('emits no SEO/social metadata — deferred to Plugin/SEO', () => {
    const m = buildMetadata(resolved, { title: 'E2E Home' });
    expect(m.description).toBeUndefined();
    expect(m.openGraph).toBeUndefined();
    expect(m.alternates).toBeUndefined();
  });
});
