// Engine-owned base types (hand-written, always present — never generated).
// These describe ONLY what the engine knows generically: the page envelope, a
// structural dynamic-zone entry, and the engine's reference blocks (`press.*`).
//
// The PROJECT's concrete content types (the `custom.*` blocks, the discriminated
// PageBody union) are NOT here — they are generated from the live CMS schema into
// the adopter's `core/types/` zone by `press dev` (sync-types). The engine never
// depends on a project's generated types; the project depends on these.

/** A media field as serialized by the CMS REST contract. */
export interface PressMedia {
  url: string;
  width?: number;
  height?: number;
  alternativeText?: string | null;
  name?: string;
  mime?: string;
}

/** Reference block `press.hero` — engine-owned (mirrors packages/cms hero.json). */
export interface PressHero {
  __component: 'press.hero';
  id: number;
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  image?: PressMedia;
}

/**
 * Structural shape every dynamic-zone entry satisfies. The renderer only reads
 * `__component`/`id` and spreads the rest, so the generic envelope is enough for
 * engine code; the adopter's generated types refine this per block.
 */
export interface Block {
  __component: string;
  id: number;
}

/** The page dynamic zone, generically typed for engine consumers. */
export type PageBody = Block[];

/** The page envelope the engine fetches and renders (generic over its blocks). */
export interface Page {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: PageBody;
}
