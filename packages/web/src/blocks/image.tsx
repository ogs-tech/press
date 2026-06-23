import type { PressImage } from '../types/base';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Reference block `press.image` — a single image, server-rendered for SEO. Like
 * press.gallery, each `src` is resolved ABSOLUTE against the CMS base (raw <img>,
 * not next/image) so no image-domain config is needed. Tolerant: a draft with no
 * image yet renders nothing rather than a broken <img>.
 */
export function Image({ image, caption }: PressImage) {
  if (!image?.url) return null;
  return (
    <figure data-block="press.image">
      <img src={new URL(image.url, CMS_URL).toString()} alt={image.alternativeText ?? ''} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
