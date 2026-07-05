import { describe, expect, it, vi } from 'vitest';
import siteSetting from './site-setting';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * The engine owns the wire shape: the controller computes the populate
 * server-side and `ctx.query` is never honored. `populate: '*'` is SHALLOW — it
 * would leave `preset-organism.navbar's items.page` (and `seo.image`) unpopulated, so every internal
 * nav link silently falls back to its raw `url` and an internal page link 404s.
 * These tests pin the deep-populate contract the web resolver (mapSiteSettings)
 * depends on.
 */
describe('site-setting controller', () => {
  function run(record: unknown = { name: 'Acme' }) {
    const findFirst = vi.fn().mockResolvedValue(record);
    const documents = vi.fn(() => ({ findFirst }));
    const contentType = vi.fn(() => ({
      uid: SITE_SETTING_UID,
      attributes: {
        header: { type: 'dynamiczone', components: ['preset-organism.navbar', 'preset-atom.paragraph', 'custom-organism.callout'] },
        footer: { type: 'dynamiczone', components: ['preset-organism.footer', 'custom-organism.callout'] },
      },
    }));
    const strapi = { documents, contentType } as any;
    const ctx: any = {};
    return { strapi, ctx, documents, findFirst };
  }

  it('reads the single Site Settings record and returns it under { data }', async () => {
    const { strapi, ctx, documents } = run({ name: 'Acme' });
    await siteSetting({ strapi }).find(ctx);
    expect(documents).toHaveBeenCalledWith(SITE_SETTING_UID);
    expect(ctx.body).toEqual({ data: { name: 'Acme' } });
  });

  it('populates both chrome DZs with a per-component `on` map read from the live content-type', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    // custom-* flows through with the same shallow '*' as body blocks.
    expect(populate.header.on['preset-atom.paragraph']).toEqual({ populate: '*' });
    expect(populate.header.on['custom-organism.callout']).toEqual({ populate: '*' });
    expect(populate.footer.on['preset-organism.footer']).toEqual({ populate: '*' });
  });

  it('deep-populates preset-organism.navbar (items.page slug + cta) so internal nav links resolve to their slug', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.header.on['preset-organism.navbar']).toEqual({
      populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true },
    });
  });

  it('no longer populates the removed headerNav (BREAKING, Spec §Migration)', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.headerNav).toBeUndefined();
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

  it('deep-populates cookieConsent (nested categories + privacy page slug) — cookie-consent Spec §1', async () => {
    const { strapi, ctx, findFirst } = run();
    await siteSetting({ strapi }).find(ctx);
    const { populate } = findFirst.mock.calls[0][0];
    expect(populate.cookieConsent).toEqual({
      populate: {
        necessary: true,
        analytics: true,
        marketing: true,
        privacyPage: { fields: ['slug'] },
      },
    });
  });
});
