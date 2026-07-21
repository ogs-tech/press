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
