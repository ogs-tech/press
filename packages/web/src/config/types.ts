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
}
