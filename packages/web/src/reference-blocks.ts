import type { ComponentType } from 'react';
import { Hero } from './blocks/hero';

/**
 * Engine-owned reference block registry (Spec §5.3). The engine references
 * `press.*` ONLY. Adopter `custom.*` blocks are never named here — they arrive
 * via the explicit `components` prop on <BlockRenderer/>.
 */
export const referenceBlocks: Record<string, ComponentType<any>> = {
  'press.hero': Hero,
};
