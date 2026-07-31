/**
 * Wire + resolved shapes for the SEO plugin (plugin-seo Spec §2) — head
 * metadata (ranking + social share) as an opt-in engine plugin. `Raw` mirrors
 * the CMS component verbatim (every field optional); `Resolved` is TOTAL —
 * the shape `buildSeoMetadata`/`buildJsonLd` and
 * `ResolvedPressConfig.plugins.seo` actually consume. `titleTemplate`'s
 * `{site}` placeholder is intentionally left unsubstituted here —
 * `buildSeoMetadata` substitutes it, where `brand.name` is in scope
 * alongside the template.
 */
interface RawMedia {
  url?: string;
}

export interface RawSeoSocial {
  twitterHandle?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export interface RawSeoPlugin {
  enabled?: boolean;
  titleTemplate?: string;
  metaDescription?: string;
  ogImage?: RawMedia | null;
  social?: RawSeoSocial | null;
}

export interface ResolvedSeoSocial {
  twitterHandle?: string;
  /** Non-empty social profile URLs, already filtered — feeds Organization.sameAs. */
  sameAs: string[];
}

export interface ResolvedSeoPlugin {
  enabled: boolean;
  titleTemplate: string;
  metaDescription: string;
  ogImage?: string;
  social: ResolvedSeoSocial;
}
