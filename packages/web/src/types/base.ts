// Engine-owned base types (hand-written, always present — never generated).
// These describe ONLY what the engine knows generically: the page envelope, a
// structural dynamic-zone entry, and the engine's atom blocks (`preset-atom.*`).
//
// The PROJECT's concrete content types (the `custom-*` blocks, the discriminated
// PageBody union) are NOT here — they are generated from the live CMS schema into
// the adopter's `shared/types/` zone by `press dev` (sync-types). The engine never
// depends on a project's generated types; the project depends on these.

import type { Canonical } from '../urn';

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

/** Atom `preset-atom.paragraph` — engine-owned (mirrors cms atoms/paragraph.json). */
export interface PresetAtomParagraph {
  __component: 'preset-atom.paragraph';
  id: number;
  content: BlocksContent;
}

/** Atom `preset-atom.heading` — engine-owned (mirrors cms atoms/heading.json). */
export interface PresetAtomHeading {
  __component: 'preset-atom.heading';
  id: number;
  text: string;
  level: '1' | '2' | '3' | '4' | '5' | '6';
}

/** Atom `preset-atom.list` — engine-owned (mirrors cms atoms/list.json). */
export interface PresetAtomList {
  __component: 'preset-atom.list';
  id: number;
  content: BlocksContent;
}

/** Atom `preset-atom.quote` — engine-owned (mirrors cms atoms/quote.json). */
export interface PresetAtomQuote {
  __component: 'preset-atom.quote';
  id: number;
  content: BlocksContent;
  citation?: string;
}

/** Atom `preset-atom.image` — engine-owned (mirrors cms atoms/image.json). */
export interface PresetAtomImage {
  __component: 'preset-atom.image';
  id: number;
  image: PressMedia;
  caption?: string;
}

/** Atom `preset-atom.button` — engine-owned (mirrors cms atoms/button.json). */
export interface PresetAtomButton {
  __component: 'preset-atom.button';
  id: number;
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/** Atom `preset-atom.separator` — engine-owned (mirrors cms atoms/separator.json). */
export interface PresetAtomSeparator {
  __component: 'preset-atom.separator';
  id: number;
  variant: 'line' | 'dots';
}

/** Atom `preset-atom.spacer` — engine-owned (mirrors cms atoms/spacer.json). */
export interface PresetAtomSpacer {
  __component: 'preset-atom.spacer';
  id: number;
  size: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Organism `preset-organism.hero` — engine-owned (mirrors cms organisms/hero.json).
 * Hand-written here so the engine can type its own renderer; ALSO generated into
 * the adopter's generated.ts by the type-sync loop (Spec §5.2).
 */
export interface PresetOrganismHero {
  __component: 'preset-organism.hero';
  id: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: PressMedia;
  ctaLabel?: string;
  ctaHref?: string;
  align?: 'left' | 'center';
}

/** Organism `preset-organism.cta` — engine-owned (mirrors cms organisms/cta.json). */
export interface PresetOrganismCta {
  __component: 'preset-organism.cta';
  id: number;
  title: string;
  subtitle?: string;
  buttonLabel: string;
  buttonHref: string;
  align?: 'left' | 'center';
}

/**
 * Molecule `preset-molecule.column` — nested-only inside preset-organism.columns
 * (mirrors cms molecules/column.json). Never a DZ member; the wire omits
 * `__component` on nested component instances (the navbar `cta` situation), but
 * the shared PresetAtomButton shape is kept for consistency with the generated
 * types — the renderer reads only label/href/variant.
 */
export interface PresetMoleculeColumn {
  id: number;
  content?: BlocksContent;
  image?: PressMedia;
  button?: PresetAtomButton;
}

/** Organism `preset-organism.columns` — engine-owned (mirrors cms organisms/columns.json). */
export interface PresetOrganismColumns {
  __component: 'preset-organism.columns';
  id: number;
  ratio?: '50-50' | '33-67' | '67-33' | '33-33-33' | '25-25-25-25';
  gap?: 'compact' | 'normal' | 'spacious';
  verticalAlign?: 'top' | 'center' | 'bottom';
  columns?: PresetMoleculeColumn[];
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

/**
 * The page envelope the engine fetches and renders (generic over its blocks).
 * A canonical entity (canonical-urn Spec §2): `urn:page:{documentId}` is
 * attached at the mapping boundary (map-page.ts) — derived web-side, never
 * part of the CMS wire shape.
 */
export interface Page extends Canonical<'page'> {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: PageBody;
}
