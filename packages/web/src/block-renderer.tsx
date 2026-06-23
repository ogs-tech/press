import type { ComponentType } from 'react';
import { referenceBlocks } from './reference-blocks';
import { blockKey } from './block-key';

// Minimal structural shape the renderer needs from a dynamic-zone entry. No index
// signature: the sync-generated component interfaces (PressParagraph, PressGallery, CustomCallout, …)
// have none, and a type with an index signature can't accept one without it — so
// `PageBody` (the call-site type) would fail to satisfy `Block[]`. The renderer only
// reads `__component` and `id` and spreads the rest, so the extra fields aren't typed here.
interface Block {
  __component: string;
  id: number;
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
        return <Component key={blockKey(block, i)} {...block} />;
      })}
    </>
  );
}
