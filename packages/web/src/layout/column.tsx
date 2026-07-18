import { createElement, type CSSProperties, type ReactNode } from 'react';
import { normalizeResponsive, type Responsive } from './breakpoints';
import type { FlowElement } from './container';

export type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface ColumnProps {
  span?: Responsive<Span>;
  start?: Responsive<Span>;
  as?: FlowElement;
  children: ReactNode;
}

/**
 * `<Column>` — a plain CSS-grid child that spans N of the 12 tracks (Spec §5.4).
 * Does NOT check its parent: `grid-column` styles are a no-op outside a grid
 * context, which is what lets an adopter compose a `<Column>` inside a
 * hand-rolled parent grid when the built-in `<Grid>` (12 tracks) is not the
 * right shape.
 *
 * Emits `--press-col-span[-md|-lg]` unconditionally at base (default 12) and
 * only for declared tiers on md/lg. `--press-col-start[-md|-lg]` is emitted
 * only when `start` is declared, so an undeclared start cleanly resolves to
 * `auto` via the CSS var() fallback (Spec §5.4).
 */
export function Column({ span, start, as = 'div', children }: ColumnProps) {
  const spanTiers = normalizeResponsive<Span>(span, 12);
  const style: CSSProperties & Record<string, string> = {
    ['--press-col-span' as any]: String(spanTiers.base),
  };
  if (spanTiers.md !== undefined) style['--press-col-span-md' as any] = String(spanTiers.md);
  if (spanTiers.lg !== undefined) style['--press-col-span-lg' as any] = String(spanTiers.lg);

  if (start !== undefined) {
    const startTiers = normalizeResponsive<Span>(start, 1);
    style['--press-col-start' as any] = String(startTiers.base);
    if (startTiers.md !== undefined) style['--press-col-start-md' as any] = String(startTiers.md);
    if (startTiers.lg !== undefined) style['--press-col-start-lg' as any] = String(startTiers.lg);
  }

  return createElement(as, { 'data-press-layout': 'column', style }, children);
}
