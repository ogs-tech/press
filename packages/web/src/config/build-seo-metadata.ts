import type { Metadata } from 'next';
import type { ResolvedPressConfig } from './types';
import type { PageSeo } from '../types/base';

type PageMeta = { title?: string; seo?: PageSeo } | null;

/** `new URL` throws on a malformed value — an editor-typed Site URL is free text, never trusted raw. */
function safeUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/**
 * Produces the Next `Metadata` object for a route (plugin-seo Spec §3),
 * replacing the old title+favicon-only `buildMetadata` — its own comment
 * already deferred everything else to this plugin. `path` is the
 * browser-visible URL path the caller already resolved (e.g. '/about');
 * callers must pass `undefined` whenever `page` is `null` so a 404/
 * layout-fallback response never carries a self-referencing canonical.
 * Pure — no I/O, never throws even on a malformed Site URL.
 */
export function buildSeoMetadata(resolved: ResolvedPressConfig, page: PageMeta, path?: string): Metadata {
  const { brand, site } = resolved;
  const seo = resolved.plugins.seo;

  if (!seo.enabled) {
    return {
      title: page?.title ?? brand.name,
      ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    };
  }

  const metadataBase = safeUrl(site.url);
  const template = seo.titleTemplate.replace('{site}', brand.name);
  const title = page ? page.seo?.metaTitle || page.title || brand.name : { template, default: brand.name };
  const description = page?.seo?.metaDescription || seo.metaDescription || undefined;
  const canonical = path && site.url ? `${site.url}${path}` : undefined;
  const alternates = canonical
    ? { canonical, ...(site.locale ? { languages: { [site.locale]: canonical } } : {}) }
    : undefined;

  return {
    ...(brand.favicon ? { icons: { icon: brand.favicon } } : {}),
    ...(metadataBase ? { metadataBase } : {}),
    title,
    ...(description ? { description } : {}),
    ...(alternates ? { alternates } : {}),
    ...(page?.seo?.noindex ? { robots: { index: false } } : {}),
  };
}
