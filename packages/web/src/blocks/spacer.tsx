import type { PressSpacer } from '../types/base';

/**
 * Reference block `press.spacer` — vertical whitespace, sized via the engine's
 * space scale through a `data-size` hook in theme.css. Decorative, so it is
 * `aria-hidden` and carries no content.
 */
export function Spacer({ size }: PressSpacer) {
  return <div data-block="press.spacer" data-size={size ?? 'md'} aria-hidden="true" />;
}
