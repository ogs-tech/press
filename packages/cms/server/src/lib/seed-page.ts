import type { Core } from '@strapi/strapi';
import { pluginStore } from './plugin-store';

/** UID of the engine's page collection type (plugin name `press-cms`). */
export const PAGE_UID = 'plugin::press-cms.page';

/**
 * Generic, idempotent page seed — the reusable primitive behind future
 * page-seeding consumers (Plugin/Legal, archetype templates). Base itself does
 * not call it yet: exported-but-unused public API by design.
 *
 * Three invariants, identical to the retired privacy-policy seed:
 *
 * 1. Flag-first: `opts.flagKey` in the plugin store makes the pass literal-once.
 *    After the single seeding pass the page is never written again — an
 *    editor-deleted page is respected forever.
 * 2. Slug collision → the adopter's own page wins: the seed marks itself done
 *    without writing.
 * 3. The page is created as a DRAFT (`documents.create` without publish) — the
 *    engine never publishes content on its own; an editor reviews and publishes.
 */
export async function seedPage(
  strapi: Core.Strapi,
  opts: { slug: string; title: string; body: unknown[]; flagKey: string },
): Promise<void> {
  const store = pluginStore(strapi);
  if (await store.get({ key: opts.flagKey })) return;

  const docs = strapi.documents(PAGE_UID);
  const existing = await docs.findFirst({ filters: { slug: opts.slug } } as any);
  if (!existing) {
    await docs.create({ data: { title: opts.title, slug: opts.slug, body: opts.body } as any });
  }

  await store.set({ key: opts.flagKey, value: true });
}
