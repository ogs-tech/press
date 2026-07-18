import type { PresetOrganismHero } from '../types/base';
import { Container } from '../layout/container';
import { Grid } from '../layout/grid';
import { Column } from '../layout/column';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Engine organism `preset-organism.hero` — a hero band born branded by the
 * adopter's theme (Spec §5.2). Refactored to consume the layout primitives
 * (Spec §8.1): outer `<Container as="section">` owns width + gutter; inner
 * `<Grid>` composes the 2-column responsive layout (text 7 / image 5 on md+,
 * stacked at base). Passthrough `data-*` on `<Container>` preserves
 * `data-block="preset-organism.hero"` + `data-align` so the existing
 * inner-markup rules (`[data-hero="eyebrow"]` etc) keep applying.
 *
 * Tolerant, mirroring preset-atom.image: a draft with no title renders
 * nothing, and the CTA renders only when BOTH label and href are present.
 * Media is resolved ABSOLUTE against CMS_URL exactly like preset-atom.image.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  image,
  ctaLabel,
  ctaHref,
  align,
}: PresetOrganismHero) {
  if (!title) return null;
  const hasCta = Boolean(ctaLabel && ctaHref);
  const hasImage = Boolean(image?.url);
  return (
    <Container
      as="section"
      maxWidth="lg"
      data-block="preset-organism.hero"
      data-align={align ?? 'left'}
    >
      <Grid gap="lg" alignItems="center">
        <Column span={{ base: 12, md: hasImage ? 7 : 12 }}>
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
        </Column>
        {hasImage ? (
          <Column span={{ base: 12, md: 5 }}>
            <img src={new URL(image!.url, CMS_URL).toString()} alt={image!.alternativeText ?? ''} />
          </Column>
        ) : null}
      </Grid>
    </Container>
  );
}
