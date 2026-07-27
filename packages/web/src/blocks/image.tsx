import type { PresetAtomImage } from '../types/base';
import { resolveMediaUrl } from '../media';

/**
 * Atom `preset-atom.image` — a single image, server-rendered for SEO. The
 * engine's media-serialization example: it proves a media field crosses the REST
 * contract. Each `src` is resolved ABSOLUTE against the CMS base (raw <img>, not
 * next/image) so no image-domain config is needed. Tolerant: a draft with no image
 * yet renders nothing rather than a broken <img>.
 */
export function Image({ image, caption }: PresetAtomImage) {
  if (!image?.url) return null;
  return (
    <figure data-block="preset-atom.image">
      <img src={resolveMediaUrl(image.url)} alt={image.alternativeText ?? ''} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
