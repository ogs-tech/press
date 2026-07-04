// Engine-owned base types (hand-written, always present — never generated).
// These describe ONLY what the engine knows generically: the page envelope, a
// structural dynamic-zone entry, and the engine's reference blocks (`press.*`).
//
// The PROJECT's concrete content types (the `custom.*` blocks, the discriminated
// PageBody union) are NOT here — they are generated from the live CMS schema into
// the adopter's `shared/types/` zone by `press dev` (sync-types). The engine never
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

/** A single inline text run in the Strapi blocks tree (boolean marks omitted when false). */
export interface BlocksText {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
}

/** A block/inline node in the Strapi blocks tree. Structural — the renderer
 *  switches on `type`; unknown types are tolerated. Hand-written (no dependency). */
export interface BlocksNode {
  type: string; // 'paragraph' | 'heading' | 'list' | 'list-item' | 'quote' | 'code' | 'link' | …
  level?: number; // heading 1–6
  format?: 'ordered' | 'unordered'; // list
  url?: string; // link
  children?: Array<BlocksNode | BlocksText>;
}

/** The inline-formatted prose carried by a text block: the top-level blocks array. */
export type BlocksContent = BlocksNode[];

/** Reference block `press.paragraph` — engine-owned (mirrors cms paragraph.json). */
export interface PressParagraph {
  __component: 'press.paragraph';
  id: number;
  content: BlocksContent;
}

/** Reference block `press.heading` — engine-owned (mirrors cms heading.json). */
export interface PressHeading {
  __component: 'press.heading';
  id: number;
  text: string;
  level: '1' | '2' | '3' | '4' | '5' | '6';
}

/** Reference block `press.list` — engine-owned (mirrors cms list.json). */
export interface PressList {
  __component: 'press.list';
  id: number;
  content: BlocksContent;
}

/** Reference block `press.quote` — engine-owned (mirrors cms quote.json). */
export interface PressQuote {
  __component: 'press.quote';
  id: number;
  content: BlocksContent;
  citation?: string;
}

/** Reference block `press.image` — engine-owned (mirrors cms image.json). */
export interface PressImage {
  __component: 'press.image';
  id: number;
  image: PressMedia;
  caption?: string;
}

/** Reference block `press.button` — engine-owned (mirrors cms button.json). */
export interface PressButton {
  __component: 'press.button';
  id: number;
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/** Reference block `press.separator` — engine-owned (mirrors cms separator.json). */
export interface PressSeparator {
  __component: 'press.separator';
  id: number;
  variant: 'line' | 'dots';
}

/** Reference block `press.spacer` — engine-owned (mirrors cms spacer.json). */
export interface PressSpacer {
  __component: 'press.spacer';
  id: number;
  size: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Engine section `section.hero` — engine-owned (mirrors cms section/hero.json).
 * Hand-written here so the engine can type its own renderer; ALSO generated into
 * the adopter's generated.ts by the type-sync loop (Spec §5.2).
 */
export interface SectionHero {
  __component: 'section.hero';
  id: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: PressMedia;
  ctaLabel?: string;
  ctaHref?: string;
  align?: 'left' | 'center';
}

/** Engine section `section.cta` — engine-owned (mirrors cms section/cta.json). */
export interface SectionCta {
  __component: 'section.cta';
  id: number;
  title: string;
  subtitle?: string;
  buttonLabel: string;
  buttonHref: string;
  align?: 'left' | 'center';
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
