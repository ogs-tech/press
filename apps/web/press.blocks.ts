import type { ComponentType } from 'react';
import { Callout } from './blocks/custom/Callout';

/**
 * The single Project-zone extension point on the web side (Spec §5.3): an
 * explicit map of `custom.*` blocks the adopter owns. Passed as a prop to
 * <BlockRenderer/> — not a global mutable registry — so render is deterministic
 * under RSC/SSR.
 */
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom.callout': Callout,
};
