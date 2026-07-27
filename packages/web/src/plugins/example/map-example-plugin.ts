import type { RawExamplePlugin, ResolvedExamplePlugin } from './types';
import { DEFAULT_EXAMPLE_PLUGIN } from './default-example-plugin';

/**
 * Pure CMS-shape → ResolvedExamplePlugin (base-plugin Spec §2 mapper role):
 * FAIL-OPEN — a null/absent CMS component still resolves a total, well-typed
 * value (DEFAULT_EXAMPLE_PLUGIN), never throws, no I/O. A present field wins
 * over the default; an absent/undefined field keeps the default.
 */
export function mapExamplePlugin(raw: RawExamplePlugin | null | undefined): ResolvedExamplePlugin {
  return {
    enabled: raw?.enabled ?? DEFAULT_EXAMPLE_PLUGIN.enabled,
    message: raw?.message ?? DEFAULT_EXAMPLE_PLUGIN.message,
  };
}
