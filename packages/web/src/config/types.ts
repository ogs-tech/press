import type { LayoutDefaults, Node } from '@ogs-tech/press-shared';
import type { Canonical } from '../urn';
import type { RawCookieConsent, ResolvedCookieConsentPlugin } from '../plugins/cookie-consent/types';
import type { ResolvedLink } from '../link';

/** The only embedded theme this phase. The union exists so a second theme is additive, not breaking (Spec §2). */
export type ThemeName = 'default';

/** Adopter-overridable colour tokens (Spec §4). `onPrimary` maps to `--press-color-on-primary`. */
export interface ThemeColors {
  primary: string;
  accent: string;
  secondary: string;
  ink: string;
  surface: string;
  muted: string;
  danger: string;
  onPrimary: string;
  border: string;
}

/** Font family *strings* (Spec §6). Overriding sets the family name only; loading it is the adopter's job. */
export interface ThemeFonts {
  display: string;
  body: string;
  mono: string;
}

/** Adopter-overridable corner radii (Spec §4). `pill` is engine-fixed and not part of this type. */
export interface ThemeRadius {
  xs: string;
  sm: string;
  md: string;
  lg: string;
}

/**
 * Adopter-facing build-time anchors (site-settings-cms spec §6). Identity, SEO,
 * and theme colour/radius VALUES no longer live here — they are edited in the CMS
 * "Site Settings" single type and fetched at runtime by getSiteConfig. This file
 * keeps ONLY what the build needs deterministically: the home-route slug, the
 * theme NAME (the <html data-theme> selector + ThemeName guard), and theme FONTS
 * (which next/font must know at build time). A destructive change to ThemeName
 * fails tsc at the defineConfig call site.
 */
export interface PressConfig {
  routes?: {
    /** Slug of the page served at the site root ('/'). Defaults to 'home'. */
    home?: string;
  };
  theme?:
    | ThemeName
    | {
        name?: ThemeName;
        fonts?: Partial<ThemeFonts>;
      };
}

/** A fully-resolved navigation link (page relation already collapsed to an href). */
export type ResolvedNavLink = ResolvedLink;

/** Hydrated `preset-organism.navbar` — the exact props the Navbar renderer receives (Spec §3). */
export interface ResolvedChromeNavbar {
  /** Injected from Site Settings identity — never stored on the block (Spec §1). */
  brand: { name: string; logo?: string };
  /** `items` resolved: page > url precedence, home slug → '/', external flag. */
  links: ResolvedLink[];
  cta?: (ResolvedLink & { variant?: 'primary' | 'secondary' }) | null;
}

/**
 * Fully-resolved config: every default applied, ready for the engine helpers.
 * A canonical entity with a SYNTHETIC identity (canonical-urn Spec §3): Site
 * Settings is a Strapi single type with no id in this wire contract, so the id
 * segment is the constant 'default' — attached by mapSiteSettings even when
 * the CMS is unreachable (identity is never CMS-sourced data here).
 */
export interface ResolvedPressConfig extends Canonical<'site-setting'> {
  brand: {
    name: string;
    logo?: string;
    favicon: string;
  };
  site: {
    url: string;
    locale: string;
  };
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    defaultOgImage?: string;
  };
  routes: {
    /** Slug served at the site root. The engine resolves '/' to this slug. */
    home: string;
  };
  /**
   * Fully-resolved theme. `colors` and `radius` are total (defaults filled);
   * `fonts` carries ONLY adopter overrides — font defaults arrive via `next/font`
   * variables on `<html>` (Spec §6), so an absent key means "use the next/font
   * default", which `buildThemeStyle` signals by omitting the var.
   */
  theme: {
    name: ThemeName;
    colors: ThemeColors;
    fonts: Partial<ThemeFonts>;
    radius: ThemeRadius;
  };
  /**
   * The two Site-Settings pageDefaults slots (Spec §3/§6), RAW nodes — engine
   * blocks are hydrated exactly once, by `resolveTree` (tree/resolve-slots.ts),
   * never here. Empty when the CMS is empty/unreachable/malformed (unbranded
   * over synthetic — Spec §4).
   */
  pageDefaults: {
    header: Node[];
    footer: Node[];
  };
  /**
   * Site-level layout defaults (layout-defaults spec §5), TOTAL — the baseline
   * `container-attrs.ts` resolves an undeclared node attr against. A fail-to-DEFAULT
   * key (joining `theme` and `plugins.cookieConsent`, NOT the identity/SEO
   * fail-to-empty rule): a site with an unreachable CMS should render with the
   * engine's layout, not with no layout. Required, hence a press-web major — the
   * same discipline as `urn` / `pageDefaults` / `plugins`.
   */
  layout: LayoutDefaults;
  /**
   * Engine plugins (cookie-consent Spec §1): a NAMED map — one required key
   * per plugin, resolved TOTAL (defaults applied) even when the CMS is empty
   * or unreachable. Not an array: plugins are fixed engine features, not
   * editor-composed content (that is what the Dynamic Zones are for). Each
   * new plugin adds a required key — a deliberate press-web major, the same
   * discipline as `urn`/`pageDefaults`.
   */
  plugins: {
    cookieConsent: ResolvedCookieConsentPlugin;
  };
}

/**
 * Build-time-only slice resolved from press.config.ts. Deterministic and
 * CMS-independent: `routes` (routing + the /home → / redirect), `theme.name`
 * (the <html data-theme> selector + ThemeName guard), and `theme.fonts` (which
 * next/font must know at build time). Identity, SEO, and theme colour/radius
 * VALUES are layered on at runtime by getSiteConfig (site-settings-cms spec §6).
 */
export interface BuildTimeConfig {
  routes: { home: string };
  theme: { name: ThemeName; fonts: Partial<ThemeFonts> };
}

/** A Strapi 5 media object (flattened), only the field the engine consumes. */
interface CmsMedia {
  url?: string;
}

/**
 * The Site Settings single-type payload as returned by GET /api/site-setting
 * (Strapi 5 flattened, explicit populate owned by the site-setting controller).
 * EVERY field is optional: an unfilled record and an unreachable CMS both map as
 * if absent (site-settings-cms spec §3.2, §7).
 */
export interface SiteSettingsData {
  name?: string;
  url?: string;
  locale?: string;
  logo?: CmsMedia | null;
  favicon?: CmsMedia | null;
  seo?: {
    titleTemplate?: string;
    title?: string;
    description?: string;
    image?: CmsMedia | null;
  } | null;
  themeColors?: Partial<ThemeColors> | null;
  themeRadius?: Partial<ThemeRadius> | null;
  cookieConsent?: RawCookieConsent | null;
  /** The two page-default slots (Spec §6): bare Node[] arrays, validated by mapSiteSettings. */
  pageDefaults?: { header?: unknown; footer?: unknown } | null;
  /** The `preset-config.layout` group, RAW: sanitized downstream by
   *  `resolveLayoutDefaults`, so the wire shape is never trusted here. */
  layout?: unknown;
}
