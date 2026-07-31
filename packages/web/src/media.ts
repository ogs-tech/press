/**
 * The one place that reads `process.env.CMS_URL` for a running web host (the
 * `press dev`/`build` commands set the env var itself — a different concern —
 * and keep their own literal default). Every fetch/render call site imports
 * `CMS_URL` from here instead of re-declaring the same fallback.
 */
export const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/** Resolves a Strapi-relative asset url absolute against `base` (defaults to
 *  CMS_URL) — the raw `<img>` src contract preset-atom.image and preset-organism.hero
 *  share. Throws on a malformed url, matching `new URL`'s own contract. */
export function resolveMediaUrl(url: string, base: string = CMS_URL): string {
  return new URL(url, base).toString();
}

/**
 * Resolves a Strapi media url absolute against CMS_URL; undefined when
 * absent. Unlike `resolveMediaUrl` this never throws — a mapper-facing
 * helper for optional media fields (`basicSettings.logo`, `seo.ogImage`, …)
 * where "no media" is a normal, valid state, not an error.
 */
export function mediaUrl(media: { url?: string } | null | undefined): string | undefined {
  const url = media?.url;
  if (!url) return undefined;
  return url.startsWith('http') ? url : `${CMS_URL}${url}`;
}
