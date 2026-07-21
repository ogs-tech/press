/**
 * The engine's ONE link concept (locked decision 2026-07-20): the hydrated wire
 * shape of `preset-molecule.link` and its pure resolver. Precedence page > url;
 * an internal page collapses to '/' when its slug is the home slug (the same
 * routes.home anchor as the /home → / redirect); a page ref without a slug
 * (unpublished/deleted) falls back to url, else the link drops. Everything that
 * links — nav items, button atom, hero/cta, adopter blocks via <PressLink> —
 * resolves through here, nowhere else.
 */

export interface PressLinkData {
  label?: string;
  page?: { documentId?: string; slug?: string } | null;
  url?: string;
  newTab?: boolean;
}

export interface ResolvedLink {
  label: string;
  href: string;
  external: boolean;
  newTab: boolean;
}

/** Neutralizes executable protocols an editor could type (blocks-content safeHref precedent). */
function safeHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '#';
  return /^(?:javascript|data|vbscript):/i.test(trimmed) ? '#' : trimmed;
}

export function resolveLink(link: PressLinkData | null | undefined, homeSlug?: string): ResolvedLink | null {
  if (!link || typeof link !== 'object') return null;
  const label = link.label ?? '';
  const newTab = link.newTab ?? false;
  const slug = link.page?.slug;
  if (slug) {
    return { label, href: homeSlug !== undefined && slug === homeSlug ? '/' : `/${slug}`, external: false, newTab };
  }
  if (link.url) {
    const href = safeHref(link.url);
    return { label, href, external: /^https?:/i.test(href), newTab };
  }
  return null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Accepts either an already-resolved link (hydrated engine block) or raw PressLinkData. */
export function coerceLink(value: unknown, homeSlug?: string): ResolvedLink | null {
  if (!isRecord(value)) return null;
  if (typeof value.href === 'string') {
    return {
      label: typeof value.label === 'string' ? value.label : '',
      href: value.href,
      external: value.external === true,
      newTab: value.newTab === true,
    };
  }
  return resolveLink(value as PressLinkData, homeSlug);
}
