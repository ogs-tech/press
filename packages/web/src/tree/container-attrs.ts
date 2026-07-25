/**
 * Curated container attrs → layout-primitive props. Editorial intent meets the
 * responsive system here: `container` attrs map to Responsive<T> props, and a
 * column's stored `span` (the ONE responsive value on the wire) passes straight
 * through to the <Column> primitive.
 * Resolution order per attr: the NODE's own value, then the site default for that
 * tree level (CMS-owned `LayoutDefaults`, layout-defaults spec §5), then a trailing
 * literal that exists ONLY as a type terminator — `ContainerAttrs` keys are
 * optional, so TS needs a total value. The literal is never a second source of
 * truth; `DEFAULT_LAYOUT` is.
 */
import type { ColumnNode, ContainerAttrs, Gap, LayoutDefaults } from '@ogs-tech/press-shared';
import type { Responsive } from '../layout/breakpoints';
import type { Span } from '../layout/column';
import type { ContainerMaxWidth } from '../layout/container';
import type { GridAlignItems, GridGap } from '../layout/grid';

/** A column's stored span → the Responsive<Span> the <Column> primitive consumes.
 *  `base` is guaranteed by the validator; md/lg cascade up via the CSS var() chain.
 *  Cast is safe: the validator has already constrained every tier to 1..12. */
export function spanFor(column: ColumnNode): Responsive<Span> {
  return column.span as Responsive<Span>;
}

/** Semantic gap → GridGap tiers: a 12-track grid carries 11 interior gaps, so 'spacious' tier-scales. */
const GAP_TIERS: Record<Gap, Responsive<GridGap>> = {
  compact: 'sm',
  normal: 'md',
  spacious: { base: 'md', lg: 'lg' },
};

export const rowGap = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): Responsive<GridGap> =>
  GAP_TIERS[attrs?.gap ?? d.gap ?? 'normal'];

const ALIGN_ITEMS: Record<NonNullable<ContainerAttrs['verticalAlign']>, GridAlignItems> = {
  top: 'start',
  center: 'center',
  bottom: 'end',
};

export const rowAlign = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): GridAlignItems =>
  ALIGN_ITEMS[attrs?.verticalAlign ?? d.verticalAlign ?? 'top'];

export const rowWidth = (attrs: ContainerAttrs | undefined, d: LayoutDefaults['row']): ContainerMaxWidth =>
  attrs?.width ?? d.width ?? 'lg';

/** Stack rhythm (layout root / column cells): a CSS space token consumed by theme.css stack rules. */
export const STACK_GAPS: Record<Gap, string> = {
  compact: 'var(--press-space-3)',
  normal: 'var(--press-space-5)',
  spacious: 'var(--press-space-7)',
};

/** undefined when neither the node nor the site declares a gap — the renderer then
 *  emits NO stack attr and legacy per-block margins apply. `d` is deliberately the
 *  narrow `Pick`: this serves BOTH `layout.page` and `layout.column`. */
export const stackGap = (attrs: ContainerAttrs | undefined, d: Pick<ContainerAttrs, 'gap'>): string | undefined => {
  const gap = attrs?.gap ?? d.gap;
  return gap ? STACK_GAPS[gap] : undefined;
};

/** Cell content placement; 'top' is the flex default so it emits nothing. */
export const cellAlign = (
  attrs: ContainerAttrs | undefined,
  d: LayoutDefaults['column'],
): 'center' | 'end' | undefined => {
  const align = attrs?.verticalAlign ?? d.verticalAlign;
  return align === 'center' ? 'center' : align === 'bottom' ? 'end' : undefined;
};
