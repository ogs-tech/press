import type { Page } from './types/base';
import { mapPage, type RawPage } from './map-page';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Fetches a PUBLISHED page by slug over REST (Spec §5.1). Runs server-side (RSC),
 * so there is no browser CORS surface for the data fetch. A missing/unpublished
 * slug yields the engine's 404 → returns null, which the route turns into
 * notFound(). `cache: 'no-store'` keeps the contract test deterministic.
 * Thin fetcher: identity attachment lives in mapPage (canonical-urn Spec §2).
 */
export async function getPage(slug: string): Promise<Page | null> {
  const res = await fetch(`${CMS_URL}/api/pages/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage("${slug}") failed: ${res.status}`);
  const json = (await res.json()) as { data: RawPage | null };
  return json.data ? mapPage(json.data) : null;
}
