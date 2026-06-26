import type { BuildTimeConfig, ResolvedPressConfig, SiteSettingsData } from './config/types';
import { DEFAULT_THEME } from './config/default-theme';

// Same module-level pattern as get-page.ts: read once, default to local Strapi.
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi media url absolute against CMS_URL; undefined when absent. */
function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}

type RawNavItem = NonNullable<SiteSettingsData['headerNav']>[number];
type ResolvedNavLink = ResolvedPressConfig['nav']['header'][number];

/**
 * Resolves a CMS nav item into a final link (site-settings spec §5.2).
 * Precedence: `page` wins over `url`. An internal page collapses to '/' when its
 * slug is the home slug (reusing the same routes.home anchor as the /home → /
 * redirect — CMS-independent). An item with neither page nor url is dropped
 * (returns null). The external flag is true only for http(s) URLs.
 */
function resolveNavItem(item: RawNavItem, homeSlug: string): ResolvedNavLink | null {
  const label = item.label ?? '';
  const newTab = item.newTab ?? false;
  const slug = item.page?.slug;
  if (slug) {
    return { label, href: slug === homeSlug ? '/' : `/${slug}`, external: false, newTab };
  }
  if (item.url) {
    return { label, href: item.url, external: item.url.startsWith('http'), newTab };
  }
  return null;
}

/**
 * Pure CMS-shape → ResolvedPressConfig (site-settings-cms spec §3.2). Same input
 * → same output, no I/O, no mutation — unit-testable without a server, safe in an
 * RSC. Identity/SEO come ONLY from the CMS: a present value is used as-is, a
 * missing value stays empty ('' / undefined) — NO inheritance, so "empty CMS
 * field" unambiguously means empty (AC2/AC3). Theme colours/radii resolve over
 * DEFAULT_THEME per key — the engine's shipped base, never empty (AC4). Build-time
 * anchors (routes, theme.name, theme.fonts) come from `buildTime` (AC8). The
 * output is the exact shape buildMetadata/buildThemeStyle already accept.
 */
export function mapSiteSettings(
  buildTime: BuildTimeConfig,
  cms: SiteSettingsData | null,
): ResolvedPressConfig {
  const c = cms ?? {};
  const seo = c.seo ?? {};
  return {
    brand: {
      name: c.name ?? '',
      logo: mediaUrl(c.logo),
      favicon: mediaUrl(c.favicon) ?? '',
    },
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
    nav: {
      header: (c.headerNav ?? [])
        .map((item) => resolveNavItem(item, buildTime.routes.home))
        .filter((link): link is ResolvedNavLink => link !== null),
    },
  };
}
