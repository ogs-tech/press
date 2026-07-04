import type { ResolvedChromeNavbar } from '../config/types';
import { NavLinks } from './nav-links';

/**
 * Chrome block `chrome.navbar` (Spec §1): brand + nav links + optional CTA in
 * one engine-owned bar — the internal layout is renderer-owned so editors cannot
 * break the chrome (Spec §Decisions 6). Receives HYDRATED props (Spec §3):
 * mapSiteSettings resolved the links and injected the brand from Site Settings
 * identity, so this stays a dumb server component; only NavLinks is a client
 * component (active-link aria-current). Tolerant of an un-hydrated block
 * (direct BlockRenderer use): missing brand/links degrade, never crash.
 */
export function Navbar({ brand, links, cta }: ResolvedChromeNavbar) {
  const hasCta = Boolean(cta?.label && cta?.href);
  return (
    <div data-block="chrome.navbar">
      <a data-navbar="brand" href="/">
        {brand?.logo ? <img src={brand.logo} alt="" /> : null}
        <span>{brand?.name}</span>
      </a>
      <NavLinks links={links ?? []} />
      {hasCta ? (
        <a data-navbar="cta" data-variant={cta?.variant ?? 'primary'} href={cta?.href}>
          {cta?.label}
        </a>
      ) : null}
    </div>
  );
}
