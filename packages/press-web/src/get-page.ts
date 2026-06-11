import type { Page } from './types/generated';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Fetches a PUBLISHED page by slug over REST (Spec §5.1). Runs server-side (RSC),
 * so there is no browser CORS surface for the data fetch. A missing/unpublished
 * slug yields the engine's 404 → returns null, which the route turns into
 * notFound(). `cache: 'no-store'` keeps the contract test deterministic.
 */
export async function getPage(slug: string): Promise<Page | null> {
  const res = await fetch(`${CMS_URL}/api/pages/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPage("${slug}") failed: ${res.status}`);
  const json = (await res.json()) as { data: Page | null };
  return json.data ?? null;
}
