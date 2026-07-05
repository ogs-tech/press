import type { ComponentType } from 'react';
import { Hero } from './sections/hero';
import { Cta } from './sections/cta';

/**
 * Engine-owned SECTION registry (Spec §5.2). Kept SEPARATE from referenceBlocks
 * so the documented invariant "referenceBlocks is press.* only" holds, and the
 * three-palette split (press.* atoms / section.* sections / custom.* adopter) is
 * mirrored in code. BlockRenderer merges this between reference and adopter maps.
 */
export const sectionBlocks: Record<string, ComponentType<any>> = {
  'section.hero': Hero,
  'section.cta': Cta,
};
