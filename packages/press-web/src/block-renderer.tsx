import type { ComponentType } from 'react';
import { referenceBlocks } from './reference-blocks';

interface Block {
  __component: string;
  id: number;
  [key: string]: unknown;
}

interface BlockRendererProps {
  /** The page's dynamic-zone array (typed as PageBody at the call site). */
  blocks: Block[];
  /** Adopter custom blocks, passed EXPLICITLY (no global mutable registry — Spec §5.3). */
  components?: Record<string, ComponentType<any>>;
}

/**
 * Iterates the dynamic zone, picks a component by `__component`, renders it with
 * the block's typed props. Reference blocks merge first; adopter blocks override
 * by key. Unknown `__component` → tolerant fallback (render nothing + a dev-only
 * warning), never a crash — mirroring the engine's tolerant admission (Spec §5.3).
 */
export function BlockRenderer({ blocks, components = {} }: BlockRendererProps) {
  const registry = { ...referenceBlocks, ...components };
  return (
    <>
      {blocks.map((block, i) => {
        const Component = registry[block.__component];
        if (!Component) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[press/web] no component registered for block "${block.__component}" — skipping`);
          }
          return null;
        }
        return <Component key={block.id ?? i} {...block} />;
      })}
    </>
  );
}
