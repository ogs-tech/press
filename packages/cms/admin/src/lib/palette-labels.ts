/**
 * Presentation-only mapping from a component uid → a human label + an icon, for
 * the composition builder's palette and node cards. Labels never touch the wire:
 * a uid is DB/contract and unchanged for display (same rule as index.ts's
 * category trads). Anything not explicitly mapped degrades gracefully — the last
 * uid segment is title-cased and the atomic layer picks a fallback icon — so a
 * brand-new preset or an adopter `custom-*` block gets a sensible label + glyph
 * with zero edits here.
 */
import type { ComponentType, SVGProps } from 'react';
import {
  ArrowsOut, BulletList, Cursor, Feather, HeadingOne, Image, Layout, Link,
  Minus, Paragraph, PuzzlePiece, Quotes, SquaresFour, Stack, Star,
} from '@strapi/icons';
import type { ContainerKey } from '@ogs-tech/press-shared';

export type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/** Structural (non-block) node glyphs — rows and columns are minted, never placed. */
export const ROW_ICON: IconType = SquaresFour;
export const COLUMN_ICON: IconType = Stack;

/** Exact uid → icon. Falls through to the per-layer default below. */
const BLOCK_ICONS: Record<string, IconType> = {
  'preset-atom.paragraph': Paragraph,
  'preset-atom.heading': HeadingOne,
  'preset-atom.list': BulletList,
  'preset-atom.quote': Quotes,
  'preset-atom.image': Image,
  'preset-atom.button': Cursor,
  'preset-atom.separator': Minus,
  'preset-atom.spacer': ArrowsOut,
  'preset-molecule.link': Link,
  'preset-organism.hero': Star,
  'preset-organism.cta': Cursor,
  'preset-organism.navbar': Layout,
  'preset-organism.footer': Layout,
};

const LAYER_ICONS: Record<string, IconType> = {
  atom: Feather,
  molecule: Link,
  organism: Layout,
};

export function blockIcon(uid: string): IconType {
  const exact = BLOCK_ICONS[uid];
  if (exact) return exact;
  const [category] = uid.split('.');
  const [owner, layer] = category.split('-');
  if (owner === 'custom') return PuzzlePiece;
  return LAYER_ICONS[layer] ?? PuzzlePiece;
}

/** Acronyms/proper spellings the title-caser would otherwise mangle. */
const NAME_OVERRIDES: Record<string, string> = {
  cta: 'CTA',
  seo: 'SEO',
};

const titleize = (raw: string): string =>
  raw
    .replace(/[-_]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** "preset-organism.hero" → "Hero"; "custom-organism.callout" → "Callout". */
export function blockLabel(uid: string): string {
  const name = uid.split('.')[1] ?? uid;
  return NAME_OVERRIDES[name] ?? titleize(name);
}

/** A component attribute name → a friendlier form label ("newTab" → "New Tab"). */
export function fieldLabel(name: string): string {
  return NAME_OVERRIDES[name] ?? titleize(name);
}

const CATEGORY_LABELS: Record<string, string> = {
  'preset-atom': 'Atoms',
  'preset-molecule': 'Molecules',
  'preset-organism': 'Organisms',
  'preset-config': 'Configuration',
  'preset-layout': 'Layout',
  'preset-template': 'Templates',
  'custom-atom': 'Custom atoms',
  'custom-molecule': 'Custom molecules',
  'custom-organism': 'Custom organisms',
  'custom-layout': 'Custom layout',
  'custom-template': 'Custom templates',
};

/** "preset-organism" → "Organisms"; unmapped categories show their raw uid segment. */
export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/**
 * Per-LEVEL container field labels. `gap` is two different physical axes — space
 * BETWEEN columns on a row versus vertical rhythm WITHIN a page/column stack — so
 * there is one label per (node type, key), never one shared label.
 *
 * These strings must match the Site Settings "Layout" field labels verbatim
 * (`preset-config.layout-*`): that correspondence is what makes a builder
 * placeholder like `Site default · Normal` traceable to the field an editor set.
 */
const CONTAINER_FIELD_LABELS: Record<'layout' | 'row' | 'column', Partial<Record<ContainerKey, string>>> = {
  layout: { gap: 'Vertical rhythm' },
  row: { width: 'Width', gap: 'Column gap', verticalAlign: 'Vertical align' },
  column: { gap: 'Vertical rhythm', verticalAlign: 'Content align' },
};

export function containerFieldLabel(nodeType: 'layout' | 'row' | 'column', key: ContainerKey): string {
  return CONTAINER_FIELD_LABELS[nodeType][key] ?? fieldLabel(key);
}

/** Wire token → editorial name. The wire keeps `lg`; an editor reads "Content width". */
const CONTAINER_OPTION_LABELS: Record<ContainerKey, Record<string, string>> = {
  width: { prose: 'Reading width', lg: 'Content width', full: 'Full bleed' },
  gap: { compact: 'Compact', normal: 'Normal', spacious: 'Spacious' },
  verticalAlign: { top: 'Top', center: 'Center', bottom: 'Bottom' },
};

/** `undefined` is a real, nameable state (page/column gap): no stack attribute is
 *  emitted and every block keeps its own margins. */
export function containerOptionLabel(key: ContainerKey, value: string | undefined): string {
  if (value === undefined) return 'per-block spacing';
  return CONTAINER_OPTION_LABELS[key][value] ?? titleize(value);
}
