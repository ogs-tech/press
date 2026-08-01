import { describe, expect, it, vi } from 'vitest';
import siteSetting from './site-setting';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * The engine owns the wire shape: the controller computes the populate
 * server-side and `ctx.query` is never honored. `populate: '*'` is SHALLOW — it
 * would leave `basicSettings`'s media fields and nested `themeAdvanced`
 * unpopulated. `header`/`footer` are gone (Spec §4: the composition-builder
 * JSON custom field replaces the chrome Dynamic Zones); these tests pin the
 * remaining deep-populate contract the web resolver (mapSiteSettings) depends on.
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

  it('no longer populates the removed header/footer dynamic zones (BREAKING, Spec §4)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.header).toBeUndefined();
    expect(populate.footer).toBeUndefined();
    expect(populate.headerNav).toBeUndefined();
    // pageDefaults is a JSON custom field scalar — no populate key at all.
    expect(populate.pageDefaults).toBeUndefined();
  });

  it('deep-populates basicSettings (media + nested themeAdvanced) — not reached by populate:*', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.basicSettings).toEqual({
      populate: { logo: true, favicon: true, themeAdvanced: true },
    });
    // never the shallow wildcard that caused the 404
    expect(populate).not.toBe('*');
  });

  it('deep-populates layout — one component per tree level sits below a shallow populate', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.layout).toEqual({ populate: { page: true, row: true, column: true } });
  });

  it('populates examplePlugin as a shallow scalar component (no media/nested component to deep-populate)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.examplePlugin).toBe(true);
  });

  it('deep-populates seo (share image + nested social component)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.seo).toEqual({ populate: { ogImage: true, social: true } });
  });

  it('populates legalPages as a shallow scalar component (no media/nested component to deep-populate)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.legalPages).toBe(true);
  });

  it('deep-populates cookieConsent (three nested cookie-category components)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.cookieConsent).toEqual({
      populate: { necessaryCategory: true, analyticsCategory: true, marketingCategory: true },
    });
  });
});
