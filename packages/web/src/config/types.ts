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
 * Adopter-facing whitelabel input (Spec §6). Only `brand.name` is required;
 * every other field has an engine default applied by `resolveConfig`. This is a
 * STATIC engine type — hand-authored and versioned with @ogs-tech/press-web — distinct
 * from the CMS-schema-derived generated types of Spec 1 (Spec §4.3).
 */
export interface PressConfig {
  brand: {
    name: string;
    logo?: string;
    favicon?: string;
  };
  site?: {
    url?: string;
    locale?: string;
  };
  seo?: {
    titleTemplate?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultOgImage?: string;
  };
  routes?: {
    /** Slug of the page served at the site root ('/'). Defaults to 'home'. */
    home?: string;
  };
  /**
   * Appearance: the third class of whitelabel data (Spec §0). The string form
   * (`theme: 'default'`) selects the embedded theme with no overrides; the object
   * form adds per-group overrides over the Default-theme values.
   */
  theme?:
    | ThemeName
    | {
        name?: ThemeName;
        colors?: Partial<ThemeColors>;
        fonts?: Partial<ThemeFonts>;
        radius?: Partial<ThemeRadius>;
      };
}

/** Fully-resolved config: every default applied, ready for the engine helpers. */
export interface ResolvedPressConfig {
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
 * (Strapi 5 flattened, populate=*). EVERY field is optional: an unfilled record
 * and an unreachable CMS both map as if absent (site-settings-cms spec §3.2, §7).
 */
export interface SiteSettingsData {
  name?: string;
  url?: string;
  locale?: string;
  logo?: CmsMedia | null;
  favicon?: CmsMedia | null;
  seo?: {
    titleTemplate?: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultOgImage?: CmsMedia | null;
  } | null;
  themeColors?: Partial<ThemeColors> | null;
  themeRadius?: Partial<ThemeRadius> | null;
}
