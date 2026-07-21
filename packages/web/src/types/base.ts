// Engine-owned base types (hand-written, always present — never generated).
// These describe ONLY what the engine knows generically: the page envelope and
// the engine's atom/organism data shapes (`preset-atom.*` / `preset-organism.*`).
//
// The PROJECT's concrete content types (the `custom-*` blocks) are NOT here —
// they are generated from the live CMS schema into the adopter's
// `shared/types/` zone by `press dev` (sync-types). The engine never depends on
// a project's generated types; the project depends on these.

import type { PressTree } from '@ogs-tech/press-shared';
import type { Canonical } from '../urn';
import type { PressLinkData } from '../link';

/** A media field as serialized by the CMS REST contract. */
export interface PressMedia {
  url: string;
  width?: number;
  height?: number;
  alternativeText?: string | null;
  name?: string;
  mime?: string;
}

/**
 * Atom `preset-atom.paragraph` — curated plain-text prose; a blank line starts
 * a new paragraph (Spec §5 composition-builder: the blocks AST left the wire).
 */
export interface PresetAtomParagraph {
  content: string;
}

/** Atom `preset-atom.heading` — engine-owned. */
export interface PresetAtomHeading {
  text: string;
  level: '1' | '2' | '3' | '4' | '5' | '6';
}

/** Atom `preset-atom.list` — one item per non-empty line of curated text. */
export interface PresetAtomList {
  content?: string;
  format?: 'unordered' | 'ordered';
}

/** Atom `preset-atom.quote` — curated plain-text paragraphs + optional citation. */
export interface PresetAtomQuote {
  content?: string;
  citation?: string;
}

/** Atom `preset-atom.image` — engine-owned. */
export interface PresetAtomImage {
  image: PressMedia;
  caption?: string;
}

/** Atom `preset-atom.button` — a call-to-action resolved through the one link concept. */
export interface PresetAtomButton {
  link?: PressLinkData;
  variant?: 'primary' | 'secondary';
}

/** Atom `preset-atom.separator` — engine-owned. */
export interface PresetAtomSeparator {
  variant: 'line' | 'dots';
}

/** Atom `preset-atom.spacer` — engine-owned. */
export interface PresetAtomSpacer {
  size: 'sm' | 'md' | 'lg' | 'xl';
}

/** Organism `preset-organism.hero` — engine-owned. */
export interface PresetOrganismHero {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  image?: PressMedia;
  cta?: PressLinkData;
  align?: 'left' | 'center';
}

/** Organism `preset-organism.cta` — engine-owned. */
export interface PresetOrganismCta {
  title: string;
  subtitle?: string;
  button?: PressLinkData;
  align?: 'left' | 'center';
}

/** The page body IS the composition tree now (Spec §5 type-sync). */
export type PageBody = PressTree;

/**
 * The page envelope the engine fetches and renders. A canonical entity
 * (canonical-urn Spec §2): `urn:page:{documentId}` is attached at the mapping
 * boundary (map-page.ts) — derived web-side, never part of the CMS wire shape.
 */
export interface Page extends Canonical<'page'> {
  id: number;
  documentId: string;
  title: string;
  slug?: string;
  body: PageBody;
}
