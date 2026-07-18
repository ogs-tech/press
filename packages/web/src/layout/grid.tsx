import { createElement, type CSSProperties, type ReactNode } from 'react';
import { normalizeResponsive, type Responsive } from './breakpoints';
import type { FlowElement } from './container';

export type GridGap = 'none' | 'sm' | 'md' | 'lg';
export type GridAlignItems = 'start' | 'center' | 'end' | 'stretch';

export interface GridProps {
  gap?: Responsive<GridGap>;
  alignItems?: GridAlignItems;
  as?: FlowElement;
  children: ReactNode;
}

/**
 * Resolves a `GridGap` symbolic value to the CSS expression stored in the
 * per-instance custom property (Spec §5.3). `'none'` short-circuits to `0`
 * so the DOM stays honest and `var(--press-grid-gap-none)` never leaks.
 */
function gapExpr(gap: GridGap): string {
  return gap === 'none' ? '0' : `var(--press-grid-gap-${gap})`;
}

/**
 * `<Grid>` — 12-column CSS grid with responsive gap (Spec §5.3). Always 12
 * tracks (`repeat(12, minmax(0, 1fr))` in theme.css); the `minmax(0, 1fr)`
 * form prevents child overflow from expanding a track (a common CSS-grid
 * footgun with long words / large images).
 *
 * `gap` normalizes to `--press-grid-gap-current[-md|-lg]` custom properties
 * inline; theme.css consumes them through `var(a, var(b, var(c, default)))`
 * so a missing `md` cleanly inherits `base` (Spec §6.3).
 */
export function Grid({ gap, alignItems = 'stretch', as = 'div', children }: GridProps) {
  const normalized = normalizeResponsive<GridGap>(gap, 'md');
  const style: CSSProperties & Record<string, string> = {
    ['--press-grid-gap-current' as any]: gapExpr(normalized.base),
  };
  if (normalized.md !== undefined) style['--press-grid-gap-current-md' as any] = gapExpr(normalized.md);
  if (normalized.lg !== undefined) style['--press-grid-gap-current-lg' as any] = gapExpr(normalized.lg);
  return createElement(
    as,
    {
      'data-press-layout': 'grid',
      'data-align-items': alignItems === 'stretch' ? undefined : alignItems,
      style,
    },
    children,
  );
}
