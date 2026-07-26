import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSiteConfig } from './get-site-config';
import type { BuildTimeConfig } from './config/types';

const buildTime: BuildTimeConfig = { routes: { home: 'home' }, theme: { name: 'default', fonts: {} } };

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...args: any[]) => Promise<any>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('getSiteConfig', () => {
  it('maps a 200 body into the resolved config', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ data: { basicSettings: { name: 'Acme' } } }) }));
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe('Acme');
    expect(r.theme.colors.primary).toBe('#119350'); // DEFAULT_THEME base
  });

  it('passes the ISR revalidate option to the Site Settings endpoint (AC11)', async () => {
    const mock = stubFetch(async () => ({ ok: true, json: async () => ({ data: null }) }));
    await getSiteConfig(buildTime);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/site-setting'),
      { next: { revalidate: 60 } },
    );
  });

  it('maps a non-OK response as an empty record (AC6)', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({ data: { name: 'IGNORED' } }) }));
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe(''); // empty identity, not the response body
    expect(r.theme.colors.primary).toBe('#119350');
  });

  it('maps a thrown fetch as an empty record — CMS down (AC6)', async () => {
    stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe('');
    expect(r.theme.radius.md).toBe('14px'); // DEFAULT_THEME base
  });

  it('maps malformed JSON as an empty record (AC6)', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));
    const r = await getSiteConfig(buildTime);
    expect(r.brand.name).toBe('');
  });

  it('maps a body with pageDefaults through end-to-end (raw — hydration happens at resolveTree)', async () => {
    const navbarNode = {
      id: 'nav', type: 'block', component: 'preset-organism.navbar',
      data: { items: [{ label: 'About', page: { slug: 'about' }, newTab: false }] },
    };
    const footerNode = { id: 'f', type: 'block', component: 'preset-organism.footer', data: {} };
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        data: {
          name: 'Acme',
          pageDefaults: { header: [navbarNode], footer: [footerNode] },
        },
      }),
    }));
    const r = await getSiteConfig(buildTime);
    expect(r.pageDefaults.header).toEqual([navbarNode]);
    expect(r.pageDefaults.footer).toEqual([footerNode]);
  });
});
