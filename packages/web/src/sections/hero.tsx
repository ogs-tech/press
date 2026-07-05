import type { PresetOrganismHero } from '../types/base';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Engine organism `preset-organism.hero` — a hero band born branded by the
 * adopter's theme (theme.css consumes var(--press-*) tokens; no override required
 * — Spec §2/§5.2). Tolerant, mirroring preset-atom.image: a draft with no title
 * renders nothing, and the CTA renders only when BOTH label and href are present
 * (no dead links — Spec §8). Media is resolved ABSOLUTE against CMS_URL exactly
 * like preset-atom.image.
 */
export function Hero({ eyebrow, title, subtitle, image, ctaLabel, ctaHref, align }: PresetOrganismHero) {
  if (!title) return null;
  const hasCta = Boolean(ctaLabel && ctaHref);
  return (
    <section data-block="preset-organism.hero" data-align={align ?? 'left'}>
      <div data-hero="content">
        {eyebrow ? <p data-hero="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p data-hero="subtitle">{subtitle}</p> : null}
        {hasCta ? (
          <a data-hero="cta" href={ctaHref}>
            {ctaLabel}
          </a>
        ) : null}
      </div>
      {image?.url ? (
        <img src={new URL(image.url, CMS_URL).toString()} alt={image.alternativeText ?? ''} />
      ) : null}
    </section>
  );
}
