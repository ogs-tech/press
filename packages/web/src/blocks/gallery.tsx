import type { PressGallery } from '../types/base';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

/**
 * Reference block `press.gallery` (Spec §5.2). A plain server component — HTML is
 * rendered on the server for SEO. Inherits Hero's old role as the
 * media-serialization contract example: it proves media crosses the REST contract,
 * now with MULTIPLE images. Each `src` is resolved ABSOLUTE against the CMS base
 * (raw <img>, not next/image) so the contract test needs no image-domain config.
 */
export function Gallery({ heading, images, caption }: PressGallery) {
  return (
    <section data-block="press.gallery">
      {heading ? <h2>{heading}</h2> : null}
      <div>
        {(images ?? []).map((image, i) => (
          <img key={i} src={new URL(image.url, CMS_URL).toString()} alt={image.alternativeText ?? ''} />
        ))}
      </div>
      {caption ? <p>{caption}</p> : null}
    </section>
  );
}
