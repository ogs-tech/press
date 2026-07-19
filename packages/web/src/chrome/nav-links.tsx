'use client';

import { usePathname } from 'next/navigation';
import type { ResolvedNavLink } from '../config/types';
import { Row } from '../layout/row';

/**
 * NavLinks — the navbar's internal link list (Spec §3). Refactored to a
 * `<Row as="nav">` (Spec §8.3): the row's flex + gap + wrap defaults give
 * the horizontal layout that the old handwritten `nav[data-press-nav="header"]
 * { display: flex; … }` CSS provided. `data-press-nav="header"` is preserved
 * as the identifying hook every existing rule (hover, aria-current) reads.
 *
 * A client component ONLY because it reads usePathname() to mark the active
 * link; the data is already fully resolved by mapSiteSettings. Empty list →
 * renders nothing.
 */
export function NavLinks({ links }: { links: ResolvedNavLink[] }) {
  const pathname = usePathname();
  if (links.length === 0) return null;
  return (
    <Row as="nav" align="center" gap="md" data-press-nav="header" aria-label="Primary">
      {links.map((link, i) => {
        const active = link.href === pathname;
        return (
          <a
            key={`${link.href}-${i}`}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            target={link.newTab ? '_blank' : undefined}
            rel={link.newTab ? 'noopener noreferrer' : undefined}
          >
            {link.label}
            {link.external ? (
              <span aria-hidden="true" data-press-nav-ext>
                {' '}
                ↗
              </span>
            ) : null}
          </a>
        );
      })}
    </Row>
  );
}
