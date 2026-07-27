import type { ResolvedExamplePlugin } from './types';

/**
 * Ships DISABLED by default (base-plugin Spec §3): a fresh adopter site shows
 * nothing extra out of the box, fully wired and provably works once toggled
 * on in Site Settings.
 */
export const DEFAULT_EXAMPLE_PLUGIN: ResolvedExamplePlugin = {
  enabled: false,
  message: 'Hello from the example plugin!',
};
