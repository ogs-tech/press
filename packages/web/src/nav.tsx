'use client';

import { usePathname } from 'next/navigation';
import type { ResolvedNavLink } from './config/types';

/**
 * SiteNav — the editable header navigation (site chrome, Plane B). A client
 * component only because it reads usePathname() to mark the active link; the data
 * is already fully resolved by mapSiteSettings, so this renders plain <a> links
 * (matching the brand link in the host header). Empty list → renders nothing, so
 * a missing/unreachable CMS leaves the header showing just the logo (AC5).
 *
 * - Active link: exact href === pathname → aria-current="page" (also the CSS hook).
 * - newTab (editor opt-in): target="_blank" + rel="noopener noreferrer".
 * - external (http(s) URL): trailing ↗ affordance, independent of newTab.
 */
export function SiteNav({ links }: { links: ResolvedNavLink[] }) {
  const pathname = usePathname();
  if (links.length === 0) return null;
  return (
    <nav data-press-nav="header" aria-label="Primary">
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
    </nav>
  );
}
