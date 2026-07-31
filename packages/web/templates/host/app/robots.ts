import type { MetadataRoute } from 'next';
import { getSiteConfig } from '@ogs-tech/press-web';
import { buildTime } from '../press-config';

/**
 * Never blocks the site (plugin-seo Spec §4) — a fail-to-empty CMS state must
 * never silently turn into "hide from search engines"; that failure mode is
 * categorically worse than "no rich metadata." Only adds the sitemap pointer
 * when the SEO plugin is enabled and the site has a URL. Per-page blocking
 * stays exactly the `noindex` meta tag from buildSeoMetadata.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteConfig(buildTime);
  const base: MetadataRoute.Robots = { rules: { userAgent: '*', allow: '/' } };
  if (!site.plugins.seo.enabled || !site.site.url) return base;
  return { ...base, sitemap: `${site.site.url}/sitemap.xml` };
}
