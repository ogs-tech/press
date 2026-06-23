import type { PressHeading } from '../types/base';

/**
 * Reference block `press.heading` — a standalone section heading (h1–h6). The
 * only genuinely atomic text block: it stores plain `text` plus a `level` enum
 * rather than a Strapi blocks field, so it maps 1:1 to a single `<h{level}>`.
 */
export function Heading({ text, level }: PressHeading) {
  const Tag = `h${level ?? '2'}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return <Tag data-block="press.heading">{text}</Tag>;
}
