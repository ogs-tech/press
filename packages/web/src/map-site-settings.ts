import { resolveLayoutDefaults, validateNodeArray, type Node } from '@ogs-tech/press-shared';
import type { BuildTimeConfig, ResolvedPressConfig, SiteSettingsData } from './config/types';
import { DEFAULT_THEME } from './config/default-theme';
import { mapCookieConsent } from './plugins/cookie-consent/map-cookie-consent';
import { buildUrn } from './urn';

// Same module-level pattern as get-page.ts: read once, default to local Strapi.
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi media url absolute against CMS_URL; undefined when absent. */
function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}

/** One pageDefaults slot: fail-to-empty on invalid nodes (Spec §6.3), dev-only warning. */
function mapSlot(input: unknown, slot: string): Node[] {
  if (input === undefined || input === null) return [];
  const { value, errors } = validateNodeArray(input);
  if (!value) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[press/web] invalid pageDefaults.${slot} — rendering empty`, errors);
    }
    return [];
  }
  return value;
}

/**
 * Pure CMS-shape → ResolvedPressConfig (site-settings-cms spec §3.2). Same input
 * → same output, no I/O, no mutation — unit-testable without a server, safe in an
 * RSC. Identity/SEO come ONLY from the CMS: a present value is used as-is, a
 * missing value stays empty ('' / undefined) — NO inheritance, so "empty CMS
 * field" unambiguously means empty (AC2/AC3). Theme colours/radii resolve over
 * DEFAULT_THEME per key — the engine's shipped base, never empty (AC4). Build-time
 * anchors (routes, theme.name, theme.fonts) come from `buildTime` (AC8). The
 * pageDefaults slots are validated (fail-to-empty, Spec §6.3) but stored RAW —
 * engine-block hydration happens exactly once, in `resolveTree`.
 */
export function mapSiteSettings(
  buildTime: BuildTimeConfig,
  cms: SiteSettingsData | null,
): ResolvedPressConfig {
  const c = cms ?? {};
  const seo = c.seo ?? {};
  const brand = {
    name: c.name ?? '',
    logo: mediaUrl(c.logo),
    favicon: mediaUrl(c.favicon) ?? '',
  };
  return {
    // Synthetic singleton identity — constant, present even when the CMS is
    // down/empty (canonical-urn Spec §3).
    urn: buildUrn('site-setting', 'default'),
    brand,
    site: {
      url: c.url ?? '',
      locale: c.locale ?? '',
    },
    // CMS field names (title/description/image) translate to the engine's
    // internal "default*" SEO names — the values a page inherits when it sets none.
    seo: {
      titleTemplate: seo.titleTemplate ?? '',
      defaultTitle: seo.title ?? '',
      defaultDescription: seo.description ?? '',
      defaultOgImage: mediaUrl(seo.image),
    },
    routes: buildTime.routes,
    theme: {
      name: buildTime.theme.name,
      colors: { ...DEFAULT_THEME.colors, ...(c.themeColors ?? {}) },
      fonts: buildTime.theme.fonts,
      radius: { ...DEFAULT_THEME.radius, ...(c.themeRadius ?? {}) },
    },
    pageDefaults: {
      header: mapSlot(c.pageDefaults?.header, 'header'),
      footer: mapSlot(c.pageDefaults?.footer, 'footer'),
    },
    // Fail-to-DEFAULT (layout-defaults spec §5), like `theme` above and unlike
    // identity/SEO: an unreachable CMS renders with the engine's layout, not none.
    layout: resolveLayoutDefaults(c.layout),
    plugins: {
      // Fails OPEN (cookie-consent Spec §3) — unlike identity/SEO, an
      // unreachable CMS still yields an enabled banner with total default copy.
      cookieConsent: mapCookieConsent(c.cookieConsent, buildTime.routes.home),
    },
  };
}
