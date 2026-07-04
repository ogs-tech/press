import type {
  BuildTimeConfig,
  ChromeBlock,
  ResolvedNavLink,
  ResolvedPressConfig,
  SiteSettingsData,
} from './config/types';
import { DEFAULT_THEME } from './config/default-theme';

// Same module-level pattern as get-page.ts: read once, default to local Strapi.
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi media url absolute against CMS_URL; undefined when absent. */
function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}

/** A raw `chrome.navbar` nav item as populated by the site-setting controller. */
interface RawNavItem {
  label?: string;
  page?: { slug?: string } | null;
  url?: string;
  newTab?: boolean;
}

/**
 * Resolves a CMS nav item into a final link (Spec §3). Precedence: `page` wins
 * over `url`. An internal page collapses to '/' when its slug is the home slug
 * (reusing the same routes.home anchor as the /home → / redirect —
 * CMS-independent). An item with neither page nor url is dropped (returns null).
 * The external flag is true only for http(s) URLs.
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
 * Hydrates one chrome dynamic zone (Spec §3): `chrome.navbar` gains the resolved
 * brand + links (page > url precedence, home slug → '/', external flag) and
 * `chrome.footer` gains the brand for its copyright fallback — identity is never
 * stored on a block (Spec §1). Every other block passes through untouched so
 * BlockRenderer stays intentionally dumb.
 */
function hydrateChromeBlocks(
  blocks: ChromeBlock[] | null | undefined,
  brand: ResolvedPressConfig['brand'],
  homeSlug: string,
): ChromeBlock[] {
  return (blocks ?? []).map((block) => {
    if (block.__component === 'chrome.navbar') {
      const items = (block.items as RawNavItem[] | null | undefined) ?? [];
      return {
        ...block,
        brand: { name: brand.name, logo: brand.logo },
        links: items
          .map((item) => resolveNavItem(item, homeSlug))
          .filter((link): link is ResolvedNavLink => link !== null),
      };
    }
    if (block.__component === 'chrome.footer') {
      return { ...block, brand: { name: brand.name } };
    }
    return block;
  });
}

/**
 * Pure CMS-shape → ResolvedPressConfig (site-settings-cms spec §3.2). Same input
 * → same output, no I/O, no mutation — unit-testable without a server, safe in an
 * RSC. Identity/SEO come ONLY from the CMS: a present value is used as-is, a
 * missing value stays empty ('' / undefined) — NO inheritance, so "empty CMS
 * field" unambiguously means empty (AC2/AC3). Theme colours/radii resolve over
 * DEFAULT_THEME per key — the engine's shipped base, never empty (AC4). Build-time
 * anchors (routes, theme.name, theme.fonts) come from `buildTime` (AC8). The
 * chrome DZs are hydrated here (chrome-blocks Spec §3) so the renderers stay dumb.
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
    chrome: {
      header: hydrateChromeBlocks(c.header, brand, buildTime.routes.home),
      footer: hydrateChromeBlocks(c.footer, brand, buildTime.routes.home),
    },
  };
}
