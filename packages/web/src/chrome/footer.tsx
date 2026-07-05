import type { ResolvedChromeFooter } from '../config/types';

/**
 * Chrome organism `preset-organism.footer` (Spec §1): a single copyright line. Empty `text`
 * falls back to "brand · currentYear" — exactly what the old hardcoded footer
 * rendered. The brand arrives via hydration (mapSiteSettings, Spec §3), never
 * stored on the block. Tolerant of an un-hydrated block: a missing brand
 * degrades to "· year", never a crash.
 */
export function Footer({ text, brand }: ResolvedChromeFooter) {
  return (
    <small data-block="preset-organism.footer">
      {text || `${brand?.name ?? ''} · ${new Date().getFullYear()}`}
    </small>
  );
}
