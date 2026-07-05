import type { PresetAtomSeparator } from '../types/base';

/**
 * Atom `preset-atom.separator` — a horizontal divider. The `variant`
 * (line/dots) is exposed as a `data-variant` styling hook in theme.css.
 */
export function Separator({ variant }: PresetAtomSeparator) {
  return <hr data-block="preset-atom.separator" data-variant={variant ?? 'line'} />;
}
