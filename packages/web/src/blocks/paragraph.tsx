import type { PresetAtomParagraph } from '../types/base';
import { renderBlocks } from './blocks-content';

/**
 * Atom `preset-atom.paragraph` — editorial prose, server-rendered for SEO.
 * `content` is a Strapi blocks field rendered by the engine's in-house renderer
 * (no client hydration, zero runtime deps).
 */
export function Paragraph({ content }: PresetAtomParagraph) {
  return <section data-block="preset-atom.paragraph">{renderBlocks(content)}</section>;
}
