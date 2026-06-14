// .press/web/press-config.ts (materialized) — resolves the adopter's web-zone
// whitelabel config ONCE into an immutable module constant (deterministic under
// RSC/SSR, the Spec 2 boundary). `../../web/config` is the web zone from the
// materialized .press/web/ depth (two levels up → project root → web/).
import userConfig from '../../web/config';
import { resolveConfig } from '@press/web';

export const config = resolveConfig(userConfig);
