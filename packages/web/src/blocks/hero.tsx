import type { PressHero } from '../types/generated';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Reference block `press.hero` (Spec §5.3). A plain server component — HTML is
 * rendered on the server for SEO. Uses a raw <img> (not next/image) so the
 * contract test needs no image-domain config; the src is resolved ABSOLUTE
 * against the CMS base, proving media serialization crosses the contract (AC1).
 */
export function Hero(props: PressHero) {
  const { heading, subheading, ctaLabel, image } = props;
  const src = image?.url ? new URL(image.url, CMS_URL).toString() : undefined;
  return (
    <section data-block="press.hero">
      {src ? <img src={src} alt={image?.alternativeText ?? ''} /> : null}
      <h1>{heading}</h1>
      {subheading ? <p>{subheading}</p> : null}
      {ctaLabel ? <a href="#">{ctaLabel}</a> : null}
    </section>
  );
}
