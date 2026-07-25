import type { Core } from '@strapi/strapi';
import { resolveLayoutDefaults, type LayoutDefaults } from '@ogs-tech/press-shared';

const SITE_SETTING_UID = 'plugin::press-cms.site-setting';

/**
 * The CMS-owned layout defaults, resolved TOTAL for the `/api/press/schema`
 * payload (layout-defaults spec §4). Deliberately NOT part of `serializeSchema`:
 * that function is synchronous and registry-only by design ("the generator can
 * never disagree with what Strapi actually serves") — a database read does not
 * belong there.
 *
 * FAILS TO DEFAULT, never throws. `resolveLayoutDefaults` already turns a missing
 * record or an unset group into DEFAULT_LAYOUT; the catch covers the read ITSELF
 * failing (no db yet, a mid-bootstrap boot) so a pre-bootstrap or wiped database
 * still serves a complete payload and the builder always has a value to name.
 * Passing `undefined` back through the resolver (rather than returning
 * DEFAULT_LAYOUT directly) keeps the shared const out of callers' hands.
 */
export async function readLayoutDefaults(strapi: Core.Strapi): Promise<LayoutDefaults> {
  try {
    const record = await strapi
      .documents(SITE_SETTING_UID as any)
      .findFirst({ populate: { layout: { populate: { page: true, row: true, column: true } } } as any });
    return resolveLayoutDefaults((record as { layout?: unknown } | null)?.layout);
  } catch {
    return resolveLayoutDefaults(undefined);
  }
}
