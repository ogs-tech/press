import { describe, expect, it, vi } from 'vitest';
import siteSetting from './site-setting';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * The engine owns the wire shape: the controller computes the populate
 * server-side and `ctx.query` is never honored. `populate: '*'` is SHALLOW — it
 * would leave `headerNav.page` (and `seo.image`) unpopulated, so every internal
 * nav link silently falls back to its raw `url` and an internal page link 404s.
 * These tests pin the deep-populate contract the web resolver (mapSiteSettings)
 * depends on.
 */
describe('site-setting controller', () => {
  function run(record: unknown = { name: 'Acme' }) {
    const findFirst = vi.fn().mockResolvedValue(record);
    const documents = vi.fn(() => ({ findFirst }));
    const strapi = { documents } as any;
    const ctx: any = {};
    return { strapi, ctx, documents, findFirst };
  }

  it('reads the single Site Settings record and returns it under { data }', async () => {
    const { strapi, ctx, documents } = run({ name: 'Acme' });
    await siteSetting({ strapi }).find(ctx);
    expect(documents).toHaveBeenCalledWith(SITE_SETTING_UID);
    expect(ctx.body).toEqual({ data: { name: 'Acme' } });
  });

  it('deep-populates headerNav.page (slug only) so internal nav links resolve to their slug', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.headerNav).toEqual({ populate: { page: { fields: ['slug'] } } });
  });

  it('deep-populates seo.image — media nested in a component is not reached by populate:*', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.seo).toEqual({ populate: { image: true } });
  });

  it('populates every field mapSiteSettings consumes (media + config components)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate).toMatchObject({ logo: true, favicon: true, themeColors: true, themeRadius: true });
    // never the shallow wildcard that caused the 404
    expect(populate).not.toBe('*');
  });
});
