import type { ComponentType } from 'react';
import { Callout } from './Callout';

/**
 * The Project-zone block map (spec §4.1). The materialized host re-exports this
 * as `customBlocks` and passes it to <BlockRenderer/>. Add an entry per custom
 * block: 'custom-<layer>.<name>' -> Component.
 */
export const customBlocks: Record<string, ComponentType<any>> = {
  'custom-organism.callout': Callout,
};
