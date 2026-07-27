import type { ResolvedExamplePlugin } from './types';

/**
 * The example plugin's React shell (base-plugin Spec §2/§3) — a plain server
 * component, not a `'use client'` shell: it carries no client interactivity,
 * a better structural precedent for most future plugins than
 * cookie-consent's client-heavy banner was. Receives the already-resolved
 * message and renders; never re-resolves DEFAULT_EXAMPLE_PLUGIN itself — the
 * mapper already did that, and the `enabled` gate lives at the mount call
 * site (host layout.tsx), not here.
 */
export function ExamplePlugin({ message }: Pick<ResolvedExamplePlugin, 'message'>) {
  return <div data-press-plugin="example">{message}</div>;
}
