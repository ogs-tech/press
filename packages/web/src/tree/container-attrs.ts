/**
 * Curated container attrs → layout-primitive props (Spec §5). This module is
 * where editorial intent meets the responsive system: the JSON never carries
 * breakpoints — RATIO_SPANS/GAP_TIERS (inherited verbatim from the retired
 * columns organism) own the base/md/lg mapping, so the 11-gap floor and the
 * 25-25-25-25 two-stage md/lg behavior stay engine-owned and untouchable.
 * Every picker treats an ABSENT attr as the engine default (Spec §3).
 */
import type { ContainerAttrs, Gap, Ratio } from '@ogs-tech/press-shared';
import type { Responsive } from '../layout/breakpoints';
import type { Span } from '../layout/column';
import type { ContainerMaxWidth } from '../layout/container';
import type { GridAlignItems, GridGap } from '../layout/grid';

export const RATIO_SPANS: Record<Ratio, Responsive<Span>[]> = {
  '50-50': [{ base: 12, md: 6 }, { base: 12, md: 6 }],
  '33-67': [{ base: 12, md: 4 }, { base: 12, md: 8 }],
  '67-33': [{ base: 12, md: 8 }, { base: 12, md: 4 }],
  '33-33-33': [{ base: 12, md: 4 }, { base: 12, md: 4 }, { base: 12, md: 4 }],
  '25-25-25-25': [
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
    { base: 12, md: 6, lg: 3 },
  ],
};

/** Column i of a row: extra columns beyond the ratio's slots reuse the last span (columns tolerance). */
export function spanFor(ratio: Ratio | undefined, index: number): Responsive<Span> {
  const spans = (ratio && RATIO_SPANS[ratio]) || RATIO_SPANS['50-50'];
  return spans[Math.min(index, spans.length - 1)];
}

/** Semantic gap → GridGap tiers: a 12-track grid carries 11 interior gaps, so 'spacious' tier-scales. */
const GAP_TIERS: Record<Gap, Responsive<GridGap>> = {
  compact: 'sm',
  normal: 'md',
  spacious: { base: 'md', lg: 'lg' },
};

export const rowGap = (attrs?: ContainerAttrs): Responsive<GridGap> => GAP_TIERS[attrs?.gap ?? 'normal'];

const ALIGN_ITEMS: Record<NonNullable<ContainerAttrs['verticalAlign']>, GridAlignItems> = {
  top: 'start',
  center: 'center',
  bottom: 'end',
};

export const rowAlign = (attrs?: ContainerAttrs): GridAlignItems => ALIGN_ITEMS[attrs?.verticalAlign ?? 'top'];

export const rowWidth = (attrs?: ContainerAttrs): ContainerMaxWidth => attrs?.width ?? 'lg';

/** Stack rhythm (layout root / column cells): a CSS space token consumed by theme.css stack rules. */
export const STACK_GAPS: Record<Gap, string> = {
  compact: 'var(--press-space-3)',
  normal: 'var(--press-space-5)',
  spacious: 'var(--press-space-7)',
};

/** undefined when undeclared — the renderer then emits NO stack attr and legacy per-block margins apply. */
export const stackGap = (attrs?: ContainerAttrs): string | undefined =>
  attrs?.gap ? STACK_GAPS[attrs.gap] : undefined;

/** Cell content placement; 'top' is the flex default so it emits nothing. */
export const cellAlign = (attrs?: ContainerAttrs): 'center' | 'end' | undefined =>
  attrs?.verticalAlign === 'center' ? 'center' : attrs?.verticalAlign === 'bottom' ? 'end' : undefined;
