import { createElement, type ReactNode } from 'react';

/**
 * The closed union of semantic elements a layout primitive may render as
 * (Spec §5). Shared by every primitive so `as` is uniformly restricted at
 * compile time — an unknown element is refused by TS, never rendered.
 */
export type FlowElement =
  | 'div'
  | 'section'
  | 'header'
  | 'footer'
  | 'main'
  | 'article'
  | 'aside'
  | 'nav'
  | 'ul'
  | 'ol';

export type ContainerMaxWidth = 'prose' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Props for `<Container>` (Spec §5.2). `maxWidth` picks one of the fixed
 * container width tokens (or `'full'` for edge-to-edge); `padded` toggles
 * horizontal gutter via `--press-container-padding-x`. Extra `data-*` attrs
 * pass through to the root element so consumers can compose block hooks
 * (e.g. `<Container as="section" data-block="preset-organism.hero">`).
 */
export interface ContainerProps {
  maxWidth?: ContainerMaxWidth;
  padded?: boolean;
  as?: FlowElement;
  children: ReactNode;
  [dataAttr: `data-${string}`]: string | undefined;
}

/**
 * `<Container>` — width constraint + horizontal gutter (Spec §5.2). The one
 * primitive with no responsive prop: consumers pick a single tier of the
 * fixed width scale. Emits static `data-max-width` / `data-padded` attrs and
 * relies on `theme.css` to consume them via attribute selectors — no inline
 * style, no CSS vars beyond those already emitted by `buildThemeStyle`.
 *
 * `maxWidth="full"` deliberately emits no width token: the CSS just drops
 * `max-width` to `none`, avoiding an unused variable.
 */
export function Container({
  maxWidth = 'lg',
  padded = true,
  as = 'div',
  children,
  ...rest
}: ContainerProps) {
  return createElement(
    as,
    {
      ...rest,
      'data-press-layout': 'container',
      'data-max-width': maxWidth,
      'data-padded': padded ? '' : undefined,
    },
    children,
  );
}
