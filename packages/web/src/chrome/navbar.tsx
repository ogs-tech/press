import type { ResolvedChromeNavbar } from '../config/types';
import { Container } from '../layout/container';
import { Row } from '../layout/row';
import { NavLinks } from './nav-links';
import { MobileNav } from './mobile-nav';
import { coerceLink } from '../link';
import { PressLink } from '../press-link';

/**
 * Chrome organism `preset-organism.navbar` (Spec §1, §8.3): brand + nav links
 * + optional CTA in one engine-owned bar. Refactored to consume the layout
 * primitives: outer `<Container maxWidth="full">` owns padding (edge-to-edge
 * width for a chrome bar); the outer `<Row justify="between">` separates the
 * brand from the right-side group; a nested `<Row>` groups the links + CTA.
 *
 * Mobile UX is added in a companion `<MobileNav>` client component
 * (Task 13) — this file's desktop-row is hidden below `md` via CSS and the
 * hamburger drawer takes over. Both surfaces receive the same
 * `links` + `cta` data.
 *
 * Receives HYDRATED props (Spec §3): mapSiteSettings resolved the links and
 * injected the brand, so this stays a dumb server component. Tolerant of an
 * un-hydrated block (direct BlockRenderer use): missing brand/links degrade,
 * never crash.
 */
export function Navbar({ brand, links, cta }: ResolvedChromeNavbar) {
  const resolvedCta = coerceLink(cta);
  const hasCta = Boolean(resolvedCta?.label && resolvedCta?.href);
  return (
    <Container as="div" maxWidth="full" padded data-block="preset-organism.navbar">
      <Row align="center" justify="between" gap="md">
        <a data-navbar="brand" href="/">
          {brand?.logo ? <img src={brand.logo} alt="" /> : null}
          <span>{brand?.name}</span>
        </a>
        <Row align="center" gap="lg" data-navbar-desktop>
          <NavLinks links={links ?? []} />
          {hasCta ? (
            <PressLink data-navbar="cta" data-variant={(cta as any)?.variant ?? 'primary'} link={cta} />
          ) : null}
        </Row>
        <MobileNav
          links={links ?? []}
          cta={hasCta ? { ...resolvedCta!, variant: (cta as any)?.variant } : undefined}
        />
      </Row>
    </Container>
  );
}
