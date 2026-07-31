import { describe, expect, it, vi } from 'vitest';
import page from './page';

const PAGE_UID = 'plugin::press-cms.page';

/**
 * `hydratePageDoc`/`hydratePageDocs` (lib/serve-hydrated) run for real here —
 * with no `body` on the fixture they pass the doc through unchanged (same
 * pattern site-setting.test.ts uses for hydrateSiteSetting), so these tests
 * only need to pin the controller's own populate/query contract.
 */
describe('page controller', () => {
  function run(docs: unknown[] = [{ id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' }]) {
    const findMany = vi.fn().mockResolvedValue(docs);
    const documents = vi.fn(() => ({ findMany }));
    const get = vi.fn(() => new Map()); // components registry (empty since no body in fixture)
    const strapi = { documents, get } as any;
    return { strapi, documents, findMany };
  }

  describe('find (list)', () => {
    it('reads published pages and returns them under { data }', async () => {
      const { strapi, documents } = run();
      const ctx: any = {};
      await page({ strapi }).find(ctx);
      expect(documents).toHaveBeenCalledWith(PAGE_UID);
      expect(ctx.body).toEqual({ data: [{ id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' }] });
    });

    it('populates seo (with its media field) alongside the published-only filter', async () => {
      const { strapi, findMany } = run();
      await page({ strapi }).find({} as any);
      expect(findMany).toHaveBeenCalledWith({
        status: 'published',
        populate: { seo: { populate: { ogImage: true } } },
      });
    });
  });

  describe('findOne', () => {
    it('returns notFound when no page matches the slug', async () => {
      const { strapi } = run([]);
      const ctx: any = { params: { slug: 'missing' }, notFound: vi.fn() };
      await page({ strapi }).findOne(ctx);
      expect(ctx.notFound).toHaveBeenCalled();
    });

    it('returns the matching page under { data }', async () => {
      const { strapi } = run([{ id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' }]);
      const ctx: any = { params: { slug: 'home' } };
      await page({ strapi }).findOne(ctx);
      expect(ctx.body).toEqual({ data: { id: 1, documentId: 'doc-1', title: 'Home', slug: 'home' } });
    });

    it('populates seo (with its media field) alongside the slug filter', async () => {
      const { strapi, findMany } = run();
      await page({ strapi }).findOne({ params: { slug: 'home' } } as any);
      expect(findMany).toHaveBeenCalledWith({
        filters: { slug: 'home' },
        status: 'published',
        limit: 1,
        populate: { seo: { populate: { ogImage: true } } },
      });
    });
  });
});
