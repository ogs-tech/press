import type { BuildTimeConfig, ResolvedPressConfig, SiteSettingsData } from './config/types';
import { mapSiteSettings } from './map-site-settings';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

// Next.js augments RequestInit with `next.revalidate` at the host; the engine
// package typechecks with only @types/node, so name the option locally.
type RevalidateInit = RequestInit & { next?: { revalidate?: number } };

/**
 * Fetches the Site Settings single type and maps it into the full
 * ResolvedPressConfig, combining it with the build-time anchors (routes,
 * theme.name, theme.fonts). The populate tree (media + config components +
 * chrome DZs → navbar items' page slugs) is owned by the site-setting controller, not requested
 * here (spec §5.1) — the engine owns the wire shape. ISR-cached (~60s) so editor
 * changes appear without a deploy. Any failure — non-OK, network error, malformed
 * body — maps as if the record were EMPTY: engine-default theme (DEFAULT_THEME) +
 * empty identity. There is NO press.config fallback for identity/SEO by design
 * (spec §0). The site renders (unbranded, default-themed) rather than crashing (AC6).
 *
 * Multi-tenant seam: a later `tenantKey` argument selects a row from a `Site`
 * collection with the SAME return shape — no consumer changes (AC9).
 */
export async function getSiteConfig(buildTime: BuildTimeConfig): Promise<ResolvedPressConfig> {
  try {
    const init: RevalidateInit = { next: { revalidate: 60 } };
    const res = await fetch(`${CMS_URL}/api/site-setting`, init);
    const data = res.ok ? ((await res.json()) as { data: SiteSettingsData | null }).data : null;
    return mapSiteSettings(buildTime, data);
  } catch {
    return mapSiteSettings(buildTime, null);
  }
}
