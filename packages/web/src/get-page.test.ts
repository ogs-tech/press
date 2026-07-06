import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPage } from './get-page';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...args: any[]) => Promise<any>) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('getPage', () => {
  it('fetches the page with the ISR revalidate option — never no-store (ISR intact)', async () => {
    const mock = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: null }),
    }));
    await getPage('home');
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/api/pages/home'),
      { next: { revalidate: 60 } },
    );
  });

  it('returns null for a 404 (missing/unpublished slug → notFound in the route)', async () => {
    stubFetch(async () => ({ ok: false, status: 404, json: async () => ({ data: null }) }));
    expect(await getPage('nope')).toBeNull();
  });

  it('maps a 200 body through mapPage, attaching the canonical urn', async () => {
    const raw = {
      id: 1,
      documentId: 'doc-abc',
      title: 'Home',
      slug: 'home',
      body: [{ __component: 'preset-atom.paragraph', id: 3 }],
    };
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ data: raw }) }));
    const page = await getPage('home');
    expect(page).toEqual({ ...raw, urn: 'urn:page:doc-abc' });
  });

  it('throws on a non-404 error status', async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(getPage('boom')).rejects.toThrow('getPage("boom") failed: 500');
  });
});
