import { createElement, type CSSProperties, type ReactNode } from 'react';
import { normalizeResponsive, type Responsive } from './breakpoints';
import type { FlowElement } from './container';

export type RowGap = 'none' | 'sm' | 'md' | 'lg';
export type RowAlign = 'start' | 'center' | 'end' | 'baseline' | 'stretch';
export type RowJustify = 'start' | 'center' | 'end' | 'between' | 'around';

export interface RowProps {
  gap?: Responsive<RowGap>;
  align?: RowAlign;
  justify?: RowJustify;
  wrap?: boolean;
  as?: FlowElement;
  children: ReactNode;
  [dataOrAria: `data-${string}` | `aria-${string}`]: unknown;
}

/**
 * Resolves a `RowGap` to the CSS expression stored in the row's per-instance
 * custom property (Spec §5.5). Reuses the `--press-grid-gap-*` symbolic
 * tokens (single source of gap values in FIXED_TOKENS.gridGap) but writes to
 * a DISTINCT variable name (`--press-row-gap-current`) so a Row nested inside
 * a Grid does not accidentally inherit the grid's gap.
 */
function gapExpr(gap: RowGap): string {
  return gap === 'none' ? '0' : `var(--press-grid-gap-${gap})`;
}

/**
 * `<Row>` — flexbox horizontal container (Spec §5.5). Named for authoring
 * ergonomics ("give me a row of things") but implemented as `display: flex`
 * (theme.css) so it composes 1D content-sized children — the natural shape
 * for a navbar (brand · links · cta), the wrong shape for a 2-col hero
 * (that is what `<Grid>` + `<Column>` are for).
 *
 * `wrap` defaults to `true`; `data-wrap="false"` is the only wrap-related
 * attribute emitted, so the DOM stays clean for the default case. Align and
 * justify default to their flexbox defaults (`stretch`, `flex-start`) and
 * are elided when unset.
 */
export function Row({
  gap,
  align = 'stretch',
  justify = 'start',
  wrap = true,
  as = 'div',
  children,
  ...rest
}: RowProps) {
  const normalized = normalizeResponsive<RowGap>(gap, 'md');
  const style: CSSProperties & Record<string, string> = {
    ['--press-row-gap-current' as any]: gapExpr(normalized.base),
  };
  if (normalized.md !== undefined) style['--press-row-gap-current-md' as any] = gapExpr(normalized.md);
  if (normalized.lg !== undefined) style['--press-row-gap-current-lg' as any] = gapExpr(normalized.lg);
  return createElement(
    as,
    {
      ...rest,
      'data-press-layout': 'row',
      'data-align': align === 'stretch' ? undefined : align,
      'data-justify': justify === 'start' ? undefined : justify,
      'data-wrap': wrap === false ? 'false' : undefined,
      style,
    },
    children,
  );
}
