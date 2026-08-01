import { resolveLayoutDefaults, validateNodeArray, type Node } from '@ogs-tech/press-shared';
import type { BuildTimeConfig, ResolvedPressConfig, SiteSettingsData, ThemeColors, ThemeRadius } from './config/types';
import { DEFAULT_THEME } from './config/default-theme';
import { buildUrn } from './urn';
import { mediaUrl } from './media';
import { mapExamplePlugin } from './plugins/example/map-example-plugin';
import { mapSeoPlugin } from './plugins/seo/map-seo-plugin';
import { mapLegal } from './plugins/legal/map-legal';

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
 * Picks only the DEFINED keys of a partial raw object — an absent/null field
 * means "keep the DEFAULT_THEME value", not "override with null/undefined".
 * Needed because the basic/advanced token split (Ajustes básicos) means a
 * single ThemeColors/ThemeRadius value is now assembled from two raw sources.
 */
function definedKeys<T extends object>(raw: Partial<T>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * Pure CMS-shape → ResolvedPressConfig (site-settings-cms spec §3.2). Same input
 * → same output, no I/O, no mutation — unit-testable without a server, safe in an
 * RSC. Identity comes ONLY from the CMS: a present value is used as-is, a
 * missing value stays empty ('' / undefined) — NO inheritance, so "empty CMS
 * field" unambiguously means empty (AC2/AC3). Theme colours/radii resolve over
 * DEFAULT_THEME per key — the engine's shipped base, never empty (AC4) — from
 * the curated basics (`basicSettings`) plus the overflow (`themeAdvanced`).
 * Build-time anchors (routes, theme.name, theme.fonts) come from `buildTime`
 * (AC8). The pageDefaults slots are validated (fail-to-empty, Spec §6.3) but
 * stored RAW — engine-block hydration happens exactly once, in `resolveTree`.
 */
export function mapSiteSettings(
  buildTime: BuildTimeConfig,
  cms: SiteSettingsData | null,
): ResolvedPressConfig {
  const c = cms ?? {};
  const basics = c.basicSettings ?? {};
  const advanced = basics.themeAdvanced ?? {};
  const brand = {
    name: basics.name ?? '',
    logo: mediaUrl(basics.logo),
    favicon: mediaUrl(basics.favicon) ?? '',
  };
  const rawColors = definedKeys<ThemeColors>({
    primary: basics.primary,
    accent: basics.accent,
    ink: basics.ink,
    surface: basics.surface,
    secondary: advanced.secondary,
    muted: advanced.muted,
    danger: advanced.danger,
    onPrimary: advanced.onPrimary,
    border: advanced.border,
  });
  const rawRadius = definedKeys<ThemeRadius>({
    md: basics.radius,
    xs: advanced.radiusXs,
    sm: advanced.radiusSm,
    lg: advanced.radiusLg,
  });
  return {
    // Synthetic singleton identity — constant, present even when the CMS is
    // down/empty (canonical-urn Spec §3).
    urn: buildUrn('site-setting', 'default'),
    brand,
    site: {
      // Strips trailing slash(es) — a free-form Strapi string with no
      // validation, and every consumer (canonical, JSON-LD url, sitemap,
      // robots) concatenates `${site.url}${path}` raw, so an editor-typed
      // 'https://acme.test/' would otherwise double-slash into every URL.
      url: (basics.url ?? '').replace(/\/+$/, ''),
      locale: basics.locale ?? '',
    },
    routes: buildTime.routes,
    theme: {
      name: buildTime.theme.name,
      colors: { ...DEFAULT_THEME.colors, ...rawColors },
      fonts: buildTime.theme.fonts,
      radius: { ...DEFAULT_THEME.radius, ...rawRadius },
    },
    pageDefaults: {
      header: mapSlot(c.pageDefaults?.header, 'header'),
      footer: mapSlot(c.pageDefaults?.footer, 'footer'),
    },
    // Fail-to-DEFAULT (layout-defaults spec §5), like `theme` above and unlike
    // identity: an unreachable CMS renders with the engine's layout, not none.
    layout: resolveLayoutDefaults(c.layout),
    plugins: {
      example: mapExamplePlugin(c.examplePlugin),
      seo: mapSeoPlugin(c.seo),
      legal: mapLegal(c.legalPages, c.cookieConsent),
    },
  };
}
