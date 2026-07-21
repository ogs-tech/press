import type { ReactNode } from 'react';
import { coerceLink } from './link';

interface PressLinkProps {
  /** Raw PressLinkData (block prop) or an already-resolved link (hydrated). */
  link: unknown;
  homeSlug?: string;
  children?: ReactNode;
  [dataAttr: `data-${string}`]: unknown;
}

/**
 * The one anchor renderer for CMS links. Server component, zero JS: resolves
 * via coerceLink and emits a plain <a>. Unresolvable → renders nothing (the
 * hero/cta "CTA renders only when complete" tolerance, generalized).
 */
export function PressLink({ link, homeSlug, children, ...rest }: PressLinkProps) {
  const resolved = coerceLink(link, homeSlug);
  // Unresolvable → nothing; a neutralized '#' href still renders (safe no-op).
  if (!resolved || !resolved.href) return null;
  return (
    <a
      {...rest}
      href={resolved.href}
      target={resolved.newTab ? '_blank' : undefined}
      rel={resolved.newTab ? 'noreferrer' : undefined}
    >
      {children ?? resolved.label}
    </a>
  );
}
