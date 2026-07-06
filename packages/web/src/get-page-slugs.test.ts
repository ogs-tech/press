import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPageSlugs, getStaticPageParams } from './get-page-slugs';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...args: any[]) => Promise<any>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('getPageSlugs', () => {
  it('fetches the page list with the ISR revalidate option — never no-store', async () => {
    const mock = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    await getPageSlugs();
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/pages'),
      { next: { revalidate: 60 } },
    );
  });

  it('returns the slugs of every published page', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ documentId: 'd1', slug: 'home' }, { documentId: 'd2', slug: 'about' }] }),
    }));
    expect(await getPageSlugs()).toEqual(['home', 'about']);
  });

  it('skips entries with a missing or empty slug', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ slug: 'about' }, { documentId: 'no-slug' }, { slug: '' }] }),
    }));
    expect(await getPageSlugs()).toEqual(['about']);
  });

  it('fails to empty on a non-OK response — build stays green, pages render on-demand', async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await getPageSlugs()).toEqual([]);
  });

  it('fails to empty on a network error — CMS unreachable at build', async () => {
    stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await getPageSlugs()).toEqual([]);
  });

  it('tolerates a null data body', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ data: null }) }));
    expect(await getPageSlugs()).toEqual([]);
  });

  it('fails to empty on a malformed (non-JSON) body', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }));
    expect(await getPageSlugs()).toEqual([]);
  });
});

describe('getStaticPageParams', () => {
  it('maps the home slug to the site root ({ slug: [] }) and others to path segments', async () => {
    stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ slug: 'home' }, { slug: 'about' }, { slug: 'legal/privacy' }] }),
    }));
    expect(await getStaticPageParams('home')).toEqual([
      { slug: [] },
      { slug: ['about'] },
      { slug: ['legal', 'privacy'] },
    ]);
  });

  it('returns [] when the CMS is unavailable at build — every page then renders on-demand', async () => {
    stubFetch(async () => {
      throw new Error('down');
    });
    expect(await getStaticPageParams('home')).toEqual([]);
  });
});
