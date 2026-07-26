import type { Canonical } from './urn';

/**
 * Base shape of every engine plugin: an optional, engine-owned capability
 * configured through Site Settings and mounted explicitly by the host
 * template. NOT a runtime registry — each plugin is wired by hand (config
 * component → pure mapper → ResolvedPressConfig.plugins.<key> → explicit
 * mount in the host layout), mirroring the chrome.* precedent. This interface
 * fixes only what every plugin shares:
 *
 * - a SYNTHETIC canonical identity `urn:plugin:{id}` — the id is a
 *   compile-time constant per plugin, never CMS-sourced, mirroring
 *   `urn:site-setting:default` (canonical-urn Spec §3);
 * - the `enabled` flag every plugin needs for the "seed active,
 *   editor-disable respected forever" pattern.
 *
 * RESERVED today — no plugin implements this contract (cookie-consent, the
 * first, was retired; legal/SEO are expected to be the next ones). Kept
 * deliberately, the same "declared ahead of components" precedent as
 * `preset-template` in the CMS palette.
 */
export interface PressPlugin<Id extends string = string> extends Canonical<'plugin'> {
  readonly id: Id;
  enabled: boolean;
}
