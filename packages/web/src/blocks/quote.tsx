import type { PresetAtomQuote } from '../types/base';
import { renderBlocks } from './blocks-content';

/**
 * Atom `preset-atom.quote` — a block quotation with an optional citation.
 * The quoted prose lives in a Strapi blocks field (rendered in-house); the
 * `<blockquote>`/`<cite>` semantics come from this wrapper, not from a `quote`
 * AST node, so the editor just writes paragraphs.
 */
export function Quote({ content, citation }: PresetAtomQuote) {
  return (
    <section data-block="preset-atom.quote">
      <blockquote>{renderBlocks(content)}</blockquote>
      {citation ? <cite>{citation}</cite> : null}
    </section>
  );
}
