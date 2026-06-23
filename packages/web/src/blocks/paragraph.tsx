import type { PressParagraph } from '../types/base';
import { renderBlocks } from './blocks-content';

/**
 * Reference block `press.paragraph` — editorial prose, server-rendered for SEO.
 * `content` is a Strapi blocks field rendered by the engine's in-house renderer
 * (no client hydration, zero runtime deps). The decomposed counterpart of the
 * retired press.rich-text's paragraph nodes.
 */
export function Paragraph({ content }: PressParagraph) {
  return <section data-block="press.paragraph">{renderBlocks(content)}</section>;
}
