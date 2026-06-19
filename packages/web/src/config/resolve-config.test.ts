import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config';

describe('resolveConfig', () => {
  it('applies defaults when only brand.name is given', () => {
    const r = resolveConfig({ brand: { name: 'Acme' } });
    expect(r.seo.titleTemplate).toBe('%s'); // AC3: omitted → '%s'
    expect(r.site.locale).toBe('en');
    expect(r.brand.favicon).toBe('/favicon.ico');
    expect(r.seo.defaultTitle).toBe('Acme'); // falls back to brand.name
    expect(r.seo.defaultDescription).toBe('');
    expect(r.site.url).toBe('');
  });

  it('lets the adopter value win over the default (AC3 override)', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      seo: { titleTemplate: '%s | Acme' },
    });
    expect(r.seo.titleTemplate).toBe('%s | Acme');
  });

  it('resolves defaultOgImage absolute against site.url', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      site: { url: 'https://acme.test' },
      seo: { defaultOgImage: '/og.png' },
    });
    expect(r.seo.defaultOgImage).toBe('https://acme.test/og.png');
  });

  it('leaves defaultOgImage as-is when site.url is absent', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      seo: { defaultOgImage: '/og.png' },
    });
    expect(r.seo.defaultOgImage).toBe('/og.png');
  });

  it('defaults routes.home to "home" when omitted', () => {
    const r = resolveConfig({ brand: { name: 'Acme' } });
    expect(r.routes.home).toBe('home');
  });

  it('lets the adopter override routes.home', () => {
    const r = resolveConfig({ brand: { name: 'Acme' }, routes: { home: 'landing' } });
    expect(r.routes.home).toBe('landing');
  });

  it('passes defaultOgImage through (no throw) when site.url is malformed', () => {
    // 'not a url' has no scheme — URL.canParse returns false, so no resolution
    const r = resolveConfig({
      brand: { name: 'Acme' },
      site: { url: 'not a url' },
      seo: { defaultOgImage: '/og.png' },
    });
    expect(r.seo.defaultOgImage).toBe('/og.png');
  });

  it('keeps an already-absolute defaultOgImage when site.url is valid', () => {
    // new URL(absolute, base) ignores the base — documents expected behaviour
    const r = resolveConfig({
      brand: { name: 'Acme' },
      site: { url: 'https://acme.test' },
      seo: { defaultOgImage: 'https://cdn.example.com/og.png' },
    });
    expect(r.seo.defaultOgImage).toBe('https://cdn.example.com/og.png');
  });

  it('fills Default-theme values when theme is absent', () => {
    const r = resolveConfig({ brand: { name: 'Acme' } });
    expect(r.theme.name).toBe('default');
    expect(r.theme.colors.primary).toBe('#119350');
    expect(r.theme.colors.onPrimary).toBe('#FFFFFF');
    expect(r.theme.radius.md).toBe('14px');
    expect(r.theme.fonts).toEqual({}); // fonts default via next/font, not config
  });

  it('resolves the string form and the object form identically', () => {
    const fromString = resolveConfig({ brand: { name: 'Acme' }, theme: 'default' });
    const fromObject = resolveConfig({ brand: { name: 'Acme' }, theme: { name: 'default' } });
    expect(fromString.theme).toEqual(fromObject.theme);
  });

  it('defaults theme.name to "default" when the object omits it', () => {
    const r = resolveConfig({ brand: { name: 'Acme' }, theme: { colors: { primary: '#000000' } } });
    expect(r.theme.name).toBe('default');
  });

  it('merges a partial colour override over defaults, per group', () => {
    const r = resolveConfig({ brand: { name: 'Acme' }, theme: { colors: { primary: '#ff5500' } } });
    expect(r.theme.colors.primary).toBe('#ff5500'); // overridden
    expect(r.theme.colors.accent).toBe('#D9A12C'); // untouched default
  });

  it('merges a partial radius override and keeps font overrides verbatim', () => {
    const r = resolveConfig({
      brand: { name: 'Acme' },
      theme: { radius: { md: '2px' }, fonts: { body: 'Inter' } },
    });
    expect(r.theme.radius.md).toBe('2px');
    expect(r.theme.radius.xs).toBe('6px'); // untouched default
    expect(r.theme.fonts).toEqual({ body: 'Inter' }); // overrides only
  });
});
