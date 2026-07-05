import type { PresetAtomSpacer } from '../types/base';

/**
 * Atom `preset-atom.spacer` — vertical whitespace, sized via the engine's
 * space scale through a `data-size` hook in theme.css. Decorative, so it is
 * `aria-hidden` and carries no content.
 */
export function Spacer({ size }: PresetAtomSpacer) {
  return <div data-block="preset-atom.spacer" data-size={size ?? 'md'} aria-hidden="true" />;
}
