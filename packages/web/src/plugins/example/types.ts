/**
 * Wire + resolved shapes for the example plugin (base-plugin Spec §2/§3) — the
 * canonical plugin structure every future plugin author copies. `Raw` mirrors
 * the CMS component verbatim (every field optional, the wire is never
 * trusted); `Resolved` is TOTAL — the shape `ExamplePlugin` (the React shell)
 * and `ResolvedPressConfig.plugins.example` actually consume.
 */
export interface RawExamplePlugin {
  enabled?: boolean;
  message?: string;
}

export interface ResolvedExamplePlugin {
  enabled: boolean;
  message: string;
}
