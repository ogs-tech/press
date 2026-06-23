import type { ComponentType } from 'react';
import { Paragraph } from './blocks/paragraph';
import { Heading } from './blocks/heading';
import { List } from './blocks/list';
import { Quote } from './blocks/quote';
import { Image } from './blocks/image';
import { Button } from './blocks/button';
import { Separator } from './blocks/separator';
import { Spacer } from './blocks/spacer';
import { Gallery } from './blocks/gallery';

/**
 * Engine-owned reference block registry (Spec §5.3). The engine references
 * `press.*` ONLY — a Gutenberg-style core palette: atomic text blocks
 * (paragraph/heading/list/quote), media (image/gallery) and structural
 * (button/separator/spacer). Adopter `custom.*` blocks are never named here —
 * they arrive via the explicit `components` prop on <BlockRenderer/>.
 */
export const referenceBlocks: Record<string, ComponentType<any>> = {
  'press.paragraph': Paragraph,
  'press.heading': Heading,
  'press.list': List,
  'press.quote': Quote,
  'press.image': Image,
  'press.button': Button,
  'press.separator': Separator,
  'press.spacer': Spacer,
  'press.gallery': Gallery,
};
