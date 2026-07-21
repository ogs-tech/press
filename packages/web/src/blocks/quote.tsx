import type { PresetAtomQuote } from '../types/base';
import { splitParagraphs } from './paragraph';

/** Atom `preset-atom.quote` — blockquote paragraphs + optional citation. */
export function Quote({ content, citation }: PresetAtomQuote) {
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length === 0) return null;
  return (
    <figure data-block="preset-atom.quote">
      <blockquote>
        {paragraphs.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </blockquote>
      {citation ? <cite>{citation}</cite> : null}
    </figure>
  );
}
