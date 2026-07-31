import type { Page, PageSeo } from './types/base';
import { buildUrn } from './urn';
import { mediaUrl } from './media';

/** `preset-config.seo-page`'s `ogImage` as it arrives on the wire — a raw Strapi media reference, not yet resolved absolute. */
interface RawPageSeo {
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: { url?: string } | null;
  noindex?: boolean;
}

/**
 * The page envelope exactly as GET /api/pages/:slug serves it — everything
 * `Page` has except the derived `urn`, and `seo`, which arrives with a raw
 * (unresolved) media reference rather than the absolute url `Page.seo` carries.
 */
export type RawPage = Omit<Page, 'urn' | 'seo'> & { seo?: RawPageSeo | null };

function mapPageSeo(raw: RawPageSeo | null | undefined): PageSeo | undefined {
  if (!raw) return undefined;
  return {
    metaTitle: raw.metaTitle,
    metaDescription: raw.metaDescription,
    ogImage: mediaUrl(raw.ogImage),
    noindex: raw.noindex,
  };
}

/**
 * Pure wire-shape → Page mapper (canonical-urn Spec §2), mirroring the
 * mapSiteSettings pure-mapper + thin-fetcher split. Attaches the canonical
 * stored identity `urn:page:{documentId}` — documentId is Strapi 5's stable
 * document key (survives draft/publish and locale variants) and is always
 * present on a served document, so no defensive fallback. `seo.ogImage`
 * resolves to an absolute URL (plugin-seo Spec §2), the same treatment
 * `basicSettings.logo` gets in mapSiteSettings — everything else on `seo`
 * passes through unchanged (mapPage stays structural, never fills a
 * business default). Same input → same output, no I/O.
 */
export function mapPage(raw: RawPage): Page {
  return { ...raw, urn: buildUrn('page', raw.documentId), seo: mapPageSeo(raw.seo) };
}
