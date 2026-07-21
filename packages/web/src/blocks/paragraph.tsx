import type { PresetAtomParagraph } from '../types/base';

/** Curated plain-text splitting (locked decision 2026-07-20): a blank line starts a new paragraph. */
export function splitParagraphs(content: string | undefined): string[] {
  return (content ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Atom `preset-atom.paragraph` — editorial prose from a curated plain-text
 * string. Server-rendered, zero JS; the blocks AST left the wire with the
 * composition-builder refactor.
 */
export function Paragraph({ content }: PresetAtomParagraph) {
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length === 0) return null;
  return (
    <div data-block="preset-atom.paragraph">
      {paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
    </div>
  );
}
