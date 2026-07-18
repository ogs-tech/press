import type { PresetOrganismCta } from '../types/base';
import { Container } from '../layout/container';

/**
 * Engine organism `preset-organism.cta` — a call-to-action banner (Spec §5.2).
 * Refactored per Spec §8.2: the outer element becomes a `<Container>` (owns
 * width + gutter), and the boxy visual (border + padding + background) moves
 * onto an inner `<div data-cta="frame">` — the Container is not the right seat
 * for chrome once it also owns horizontal padding.
 *
 * Tolerant: a draft with no title renders nothing; the button renders only
 * when BOTH label and href are present (no dead links — Spec §8).
 */
export function Cta({ title, subtitle, buttonLabel, buttonHref, align }: PresetOrganismCta) {
  if (!title) return null;
  const hasButton = Boolean(buttonLabel && buttonHref);
  return (
    <Container
      as="section"
      maxWidth="lg"
      data-block="preset-organism.cta"
      data-align={align ?? 'left'}
    >
      <div data-cta="frame">
        <h2>{title}</h2>
        {subtitle ? <p data-cta="subtitle">{subtitle}</p> : null}
        {hasButton ? (
          <a data-cta="button" href={buttonHref}>
            {buttonLabel}
          </a>
        ) : null}
      </div>
    </Container>
  );
}
