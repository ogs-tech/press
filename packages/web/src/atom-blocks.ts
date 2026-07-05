import type { ComponentType } from 'react';
import { Paragraph } from './blocks/paragraph';
import { Heading } from './blocks/heading';
import { List } from './blocks/list';
import { Quote } from './blocks/quote';
import { Image } from './blocks/image';
import { Button } from './blocks/button';
import { Separator } from './blocks/separator';
import { Spacer } from './blocks/spacer';

/**
 * Engine-owned ATOM registry — the Atomic Design base layer: atomic text blocks
 * (paragraph/heading/list/quote), media (image) and structural
 * (button/separator/spacer). Adopter `custom-*` blocks are never named here —
 * they arrive via the explicit `components` prop on <BlockRenderer/>.
 */
export const atomBlocks: Record<string, ComponentType<any>> = {
  'preset-atom.paragraph': Paragraph,
  'preset-atom.heading': Heading,
  'preset-atom.list': List,
  'preset-atom.quote': Quote,
  'preset-atom.image': Image,
  'preset-atom.button': Button,
  'preset-atom.separator': Separator,
  'preset-atom.spacer': Spacer,
};
