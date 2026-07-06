import type { Page } from './types/base';
import { mapPage, type RawPage } from './map-page';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

// Next.js augments RequestInit with `next.revalidate` at the host; the engine
// package typechecks with only @types/node, so name the option locally.
type RevalidateInit = RequestInit & { next?: { revalidate?: number } };

/**
 * Fetches a PUBLISHED page by slug over REST (Spec §5.1). Runs server-side (RSC),
 * so there is no browser CORS surface for the data fetch. A missing/unpublished
 * slug yields the engine's 404 → returns null, which the route turns into
 * notFound(). ISR-cached (`revalidate: 60`, mirroring getSiteConfig): a cached
 * fetch keeps the route eligible for static generation + ISR instead of forcing
 * it dynamic per request. Published pages are prerendered at build via the
 * route's generateStaticParams (getPageSlugs); a slug added later renders
 * on-demand and caches. Thin fetcher: identity attachment lives in mapPage
 * (canonical-urn Spec §2).
 */
export async function getPage(slug: string): Promise<Page | null> {
  const init: RevalidateInit = { next: { revalidate: 60 } };
  const res = await fetch(`${CMS_URL}/api/pages/${encodeURIComponent(slug)}`, init);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage("${slug}") failed: ${res.status}`);
  const json = (await res.json()) as { data: RawPage | null };
  return json.data ? mapPage(json.data) : null;
}
