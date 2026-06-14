import type { PressConfig } from './types';

/**
 * Identity helper. Returns its argument unchanged at runtime; its value is at
 * compile time — it gives the adopter autocomplete and type-checking at the
 * `press.config.ts` call site, which is where a destructive change to the
 * engine's `PressConfig` type fails loud (Spec §4.2, AC4).
 */
export function defineConfig(config: PressConfig): PressConfig {
  return config;
}
