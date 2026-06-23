import type { PressButton } from '../types/base';

/**
 * Reference block `press.button` — a call-to-action link styled as a button. The
 * `variant` drives theming via a `data-variant` hook in theme.css (primary fills
 * with the brand colour, secondary is an outline). Plain <a>, no JS.
 */
export function Button({ label, href, variant }: PressButton) {
  return (
    <div data-block="press.button">
      <a href={href} data-variant={variant ?? 'primary'}>
        {label}
      </a>
    </div>
  );
}
