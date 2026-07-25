/**
 * Admin-side data for the builder: the schema catalog (form generation) and the
 * published pages list (pageRef dropdowns). Module-level promise cache — the
 * admin runs same-origin with the API, both routes are public engine routes.
 */
import type { PressSchema } from '@ogs-tech/press-shared';

export interface PageOption {
  documentId: string;
  title: string;
  slug: string;
}

let schemaPromise: Promise<PressSchema> | null = null;
let pagesPromise: Promise<PageOption[]> | null = null;

export function fetchPressSchema(): Promise<PressSchema> {
  schemaPromise ??= fetch('/api/press/schema').then((res) => {
    if (!res.ok) throw new Error(`schema fetch failed: ${res.status}`);
    return res.json() as Promise<PressSchema>;
  });
  return schemaPromise;
}

/**
 * Clears the cached schema promise and refetches. The module-level cache above
 * is sound for the PALETTE half of the payload (registry data — a change needs
 * a Strapi restart, which reloads the admin bundle anyway), but `layoutDefaults`
 * is EDITABLE Site Settings data: within one admin SPA session, an editor can
 * save a new site default, navigate to a page's Composition field, and still see
 * the builder name the pre-edit value off the stale cached promise. Call this on
 * every builder mount so a fresh form always names the current site default —
 * one request per open, which is exactly what the cache saves ACROSS mounts.
 */
export function refreshPressSchema(): Promise<PressSchema> {
  schemaPromise = null;
  return fetchPressSchema();
}

export function fetchPages(): Promise<PageOption[]> {
  pagesPromise ??= fetch('/api/pages')
    .then((res) => (res.ok ? res.json() : { data: [] }))
    .then((json: { data: Array<{ documentId: string; title?: string; slug?: string }> }) =>
      (json.data ?? []).map((p) => ({ documentId: p.documentId, title: p.title ?? p.slug ?? p.documentId, slug: p.slug ?? '' })),
    );
  return pagesPromise;
}

/** Test seam: reset the module cache between vitest cases. */
export function resetPressDataCache(): void {
  schemaPromise = null;
  pagesPromise = null;
}
