import type { RawSeoPlugin, RawSeoSocial, ResolvedSeoPlugin, ResolvedSeoSocial } from './types';
import { DEFAULT_SEO_PLUGIN } from './default-seo-plugin';
import { mediaUrl } from '../../media';

/** Non-empty social URLs only — feeds Organization.sameAs. */
function mapSameAs(raw: RawSeoSocial | null | undefined): string[] {
  return [raw?.twitterUrl, raw?.linkedinUrl, raw?.instagramUrl, raw?.facebookUrl].filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  );
}

function mapSocial(raw: RawSeoSocial | null | undefined): ResolvedSeoSocial {
  return {
    twitterHandle: raw?.twitterHandle,
    sameAs: mapSameAs(raw),
  };
}

/**
 * Pure CMS-shape → ResolvedSeoPlugin (plugin-seo Spec §2 mapper role):
 * FAIL-OPEN — a null/absent CMS component still resolves a total, well-typed
 * value (DEFAULT_SEO_PLUGIN), never throws, no I/O. A present field wins over
 * the default; an absent/undefined field keeps the default. `titleTemplate`'s
 * `{site}` placeholder is left unsubstituted — `buildSeoMetadata` does that.
 */
export function mapSeoPlugin(raw: RawSeoPlugin | null | undefined): ResolvedSeoPlugin {
  return {
    enabled: raw?.enabled ?? DEFAULT_SEO_PLUGIN.enabled,
    titleTemplate: raw?.titleTemplate ?? DEFAULT_SEO_PLUGIN.titleTemplate,
    metaDescription: raw?.metaDescription ?? DEFAULT_SEO_PLUGIN.metaDescription,
    ogImage: mediaUrl(raw?.ogImage),
    social: mapSocial(raw?.social),
  };
}
