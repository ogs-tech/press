import { describe, expect, it } from 'vitest';
import { buildThemeStyle } from './build-theme-style';
import { DEFAULT_THEME } from './default-theme';
import { mapCookieConsent } from '../plugins/cookie-consent/map-cookie-consent';
import type { ResolvedPressConfig } from './types';
import { DEFAULT_LAYOUT } from '@ogs-tech/press-shared';

const baseResolved: ResolvedPressConfig = {
  urn: 'urn:site-setting:default',
  brand: { name: 'Acme', favicon: '/favicon.ico' },
  site: { url: '', locale: 'en' },
  seo: { titleTemplate: '%s', defaultTitle: 'Acme', defaultDescription: '', defaultOgImage: undefined },
  routes: { home: 'home' },
  theme: {
    name: 'default',
    colors: { ...DEFAULT_THEME.colors },
    fonts: {},
    radius: { ...DEFAULT_THEME.radius },
  },
  pageDefaults: { header: [], footer: [] },
  layout: DEFAULT_LAYOUT,
  plugins: { cookieConsent: mapCookieConsent(null, 'home') },
};

/** Build a ResolvedPressConfig with theme overrides merged over DEFAULT_THEME. */
const withTheme = (over: Partial<ResolvedPressConfig['theme']>): ResolvedPressConfig => ({
  ...baseResolved,
  theme: { ...baseResolved.theme, ...over },
});

describe('buildThemeStyle', () => {
  it('emits a :root block with the Default colour, space, type, and radius tokens', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css.trimEnd().endsWith('}')).toBe(true);
    expect(css).toContain('--press-color-primary: #119350;');
    expect(css).toContain('--press-color-on-primary: #FFFFFF;'); // onPrimary → on-primary
    expect(css).toContain('--press-space-1: 4px;');
    expect(css).toContain('--press-space-9: 96px;');
    expect(css).toContain('--press-text-body: 16px;');
    expect(css).toContain('--press-text-h1: 40px;');
    expect(css).toContain('--press-radius-md: 14px;');
    expect(css).toContain('--press-radius-pill: 999px;');
  });

  it('applies a colour override', () => {
    const css = buildThemeStyle(withTheme({ colors: { ...DEFAULT_THEME.colors, primary: '#ff5500' } }));
    expect(css).toContain('--press-color-primary: #ff5500;');
  });

  it('applies a radius override', () => {
    const css = buildThemeStyle(withTheme({ radius: { ...DEFAULT_THEME.radius, md: '2px' } }));
    expect(css).toContain('--press-radius-md: 2px;');
  });

  it('omits font variables when not overridden', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css).not.toContain('--press-font-display:');
    expect(css).not.toContain('--press-font-body:');
    expect(css).not.toContain('--press-font-mono:');
  });

  it('emits a font variable only for the overridden family', () => {
    const css = buildThemeStyle(withTheme({ fonts: { body: 'Inter' } }));
    expect(css).toContain('--press-font-body: Inter;');
    expect(css).not.toContain('--press-font-display:');
  });

  it('never emits the theme name as a token', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css).not.toMatch(/--press-theme/);
    expect(css).not.toContain('data-theme');
    expect(css).not.toContain('default');
  });

  it('emits the container width tokens from FIXED_TOKENS.container.widths (Spec §6.2)', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css).toContain('--press-container-prose: 42rem;');
    expect(css).toContain('--press-container-sm: 640px;');
    expect(css).toContain('--press-container-md: 768px;');
    expect(css).toContain('--press-container-lg: 1024px;');
    expect(css).toContain('--press-container-xl: 1280px;');
  });

  it('emits --press-container-padding-x from FIXED_TOKENS.container.paddingX (Spec §6.2)', () => {
    expect(buildThemeStyle(baseResolved)).toContain('--press-container-padding-x: 24px;');
  });

  it('emits the grid gap tokens from FIXED_TOKENS.gridGap (Spec §6.2)', () => {
    const css = buildThemeStyle(baseResolved);
    expect(css).toContain('--press-grid-gap-sm: 12px;');
    expect(css).toContain('--press-grid-gap-md: 24px;');
    expect(css).toContain('--press-grid-gap-lg: 48px;');
  });
});
