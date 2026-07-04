import type { Page } from './types/base';
import { buildUrn } from './urn';

/**
 * The page envelope exactly as GET /api/pages/:slug serves it — everything
 * Page has except the derived `urn`, which is never sent or stored on the wire.
 */
export type RawPage = Omit<Page, 'urn'>;

/**
 * Pure wire-shape → Page mapper (canonical-urn Spec §2), mirroring the
 * mapSiteSettings pure-mapper + thin-fetcher split. Attaches the canonical
 * stored identity `urn:page:{documentId}` — documentId is Strapi 5's stable
 * document key (survives draft/publish and locale variants) and is always
 * present on a served document, so no defensive fallback. Same input → same
 * output, no I/O — unit-testable without a server.
 */
export function mapPage(raw: RawPage): Page {
  return { ...raw, urn: buildUrn('page', raw.documentId) };
}
