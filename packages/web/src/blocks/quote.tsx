import type { PressQuote } from '../types/base';
import { renderBlocks } from './blocks-content';

/**
 * Reference block `press.quote` — a block quotation with an optional citation.
 * The quoted prose lives in a Strapi blocks field (rendered in-house); the
 * `<blockquote>`/`<cite>` semantics come from this wrapper, not from a `quote`
 * AST node, so the editor just writes paragraphs.
 */
export function Quote({ content, citation }: PressQuote) {
  return (
    <section data-block="press.quote">
      <blockquote>{renderBlocks(content)}</blockquote>
      {citation ? <cite>{citation}</cite> : null}
    </section>
  );
}
