import { CMS_URL } from './media';

// Next.js augments RequestInit with `next.revalidate` at the host; the engine
// package typechecks with only @types/node, so name the option locally.
type RevalidateInit = RequestInit & { next?: { revalidate?: number } };

/**
 * Fetches the slugs of every PUBLISHED page from the engine list route
 * (GET /api/pages), for build-time prerendering via the route's
 * generateStaticParams. ISR-cached (`revalidate: 60`, mirroring
 * getPage/getSiteConfig).
 *
 * FAIL-TO-EMPTY (the engine's identity/SEO precedent — mirrors getSiteConfig's
 * empty-on-failure mapping): any failure — CMS unreachable at build, non-OK,
 * malformed body — yields []. With
 * no params the build prerenders nothing and every page renders on-demand via
 * ISR (the route keeps dynamicParams at its default, true). So a reachable CMS
 * is a build-time OPTIMIZATION that prerenders known pages, never a hard build
 * dependency.
 */
export async function getPageSlugs(): Promise<string[]> {
  try {
    const init: RevalidateInit = { next: { revalidate: 60 } };
    const res = await fetch(`${CMS_URL}/api/pages`, init);
    if (!res.ok) return [];
    const json = (await res.json()) as { data: Array<{ slug?: string }> | null };
    return (json.data ?? [])
      .map((p) => p?.slug)
      .filter((slug): slug is string => typeof slug === 'string' && slug.length > 0);
  } catch {
    return [];
  }
}

/**
 * Build-time params for the catch-all page route's generateStaticParams. The
 * home page's content is served at the site root ('/'), so its slug maps to
 * `{ slug: [] }`; a direct hit on its own slug permanentRedirects to '/' and is
 * intentionally not prerendered. Every other slug maps to its path segments.
 * Empty when the CMS is unavailable at build (see getPageSlugs) — the route
 * then renders entirely on-demand via ISR.
 */
export async function getStaticPageParams(homeSlug: string): Promise<{ slug: string[] }[]> {
  const slugs = await getPageSlugs();
  return slugs.map((slug) => (slug === homeSlug ? { slug: [] } : { slug: slug.split('/') }));
}

/**
 * Fetches slug + noindex for every PUBLISHED page (plugin-seo Spec §4) — the
 * data source for app/sitemap.ts. FAIL-TO-EMPTY like `getPageSlugs`: any
 * failure yields [], and an empty sitemap is never a build failure.
 */
export async function getSitemapEntries(): Promise<{ slug: string; noindex: boolean }[]> {
  try {
    const init: RevalidateInit = { next: { revalidate: 60 } };
    const res = await fetch(`${CMS_URL}/api/pages`, init);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data: Array<{ slug?: string; seo?: { noindex?: boolean } | null }> | null;
    };
    return (json.data ?? [])
      .filter((p): p is { slug: string; seo?: { noindex?: boolean } | null } => typeof p?.slug === 'string' && p.slug.length > 0)
      .map((p) => ({ slug: p.slug, noindex: p.seo?.noindex ?? false }));
  } catch {
    return [];
  }
}
