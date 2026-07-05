import type { PresetOrganismCta } from '../types/base';

/**
 * Engine organism `preset-organism.cta` — a call-to-action banner, born branded
 * by the adopter's theme (theme.css token consumer — Spec §2/§5.2). Tolerant: a
 * draft with no title renders nothing, and the button renders only when BOTH
 * label and href are present, so a half-filled draft never emits a dead link
 * (Spec §8).
 */
export function Cta({ title, subtitle, buttonLabel, buttonHref, align }: PresetOrganismCta) {
  if (!title) return null;
  const hasButton = Boolean(buttonLabel && buttonHref);
  return (
    <section data-block="preset-organism.cta" data-align={align ?? 'left'}>
      <h2>{title}</h2>
      {subtitle ? <p data-cta="subtitle">{subtitle}</p> : null}
      {hasButton ? (
        <a data-cta="button" href={buttonHref}>
          {buttonLabel}
        </a>
      ) : null}
    </section>
  );
}
