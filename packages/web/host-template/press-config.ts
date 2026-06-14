// .press/web/press-config.ts (materialized) — resolves the adopter's root
// whitelabel config ONCE into an immutable module constant (deterministic under
// RSC/SSR, the Spec 2 boundary). `../../press.config` is the project root from
// the materialized .press/web/ depth.
import userConfig from '../../press.config';
import { resolveConfig } from '@press/web';

export const config = resolveConfig(userConfig);
