import type { ResolvedChromeFooter } from '../config/types';
import { Container } from '../layout/container';

/**
 * Chrome organism `preset-organism.footer` (Spec §1). Refactored per Spec §8.4:
 * the outer element is now a `<Container>` (owns width + gutter — the shell's
 * `<footer>` keeps only vertical padding + the border stroke after the Task 14
 * shell rewrite). Empty `text` falls back to "brand · currentYear" — exactly
 * what the old hardcoded footer rendered. Brand arrives via hydration; missing
 * brand degrades to "· year", never a crash.
 */
export function Footer({ text, brand }: ResolvedChromeFooter) {
  return (
    <Container as="div" maxWidth="lg" padded data-block="preset-organism.footer">
      <small>{text || `${brand?.name ?? ''} · ${new Date().getFullYear()}`}</small>
    </Container>
  );
}
