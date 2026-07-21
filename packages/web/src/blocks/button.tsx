import type { PresetAtomButton } from '../types/base';
import { coerceLink } from '../link';
import { PressLink } from '../press-link';

/** Atom `preset-atom.button` — a call-to-action anchor resolved through the one link concept. */
export function Button({ link, variant }: PresetAtomButton) {
  if (!coerceLink(link)) return null;
  return (
    <div data-block="preset-atom.button">
      <PressLink link={link} data-variant={variant ?? 'primary'} />
    </div>
  );
}
