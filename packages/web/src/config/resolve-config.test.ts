import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolve-config';

describe('resolveConfig', () => {
  it('defaults routes.home to "home" when omitted', () => {
    expect(resolveConfig({}).routes.home).toBe('home');
  });

  it('lets the adopter override routes.home', () => {
    expect(resolveConfig({ routes: { home: 'landing' } }).routes.home).toBe('landing');
  });

  it('defaults theme.name to "default" when theme is absent', () => {
    const r = resolveConfig({});
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({}); // fonts default via next/font, not config
  });

  it('resolves the string form and the object form identically', () => {
    expect(resolveConfig({ theme: 'default' }).theme).toEqual(resolveConfig({ theme: { name: 'default' } }).theme);
  });

  it('keeps font overrides verbatim and defaults the name', () => {
    const r = resolveConfig({ theme: { fonts: { body: 'Inter' } } });
    expect(r.theme.name).toBe('default');
    expect(r.theme.fonts).toEqual({ body: 'Inter' });
  });

  it('returns only the build-time slice — no brand/site/seo keys', () => {
    const r = resolveConfig({ theme: 'default' }) as unknown as Record<string, unknown>;
    expect(Object.keys(r).sort()).toEqual(['routes', 'theme']);
  });
});
