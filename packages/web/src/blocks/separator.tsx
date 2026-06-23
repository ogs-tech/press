import type { PressSeparator } from '../types/base';

/**
 * Reference block `press.separator` — a horizontal divider. The `variant`
 * (line/dots) is exposed as a `data-variant` styling hook in theme.css.
 */
export function Separator({ variant }: PressSeparator) {
  return <hr data-block="press.separator" data-variant={variant ?? 'line'} />;
}
