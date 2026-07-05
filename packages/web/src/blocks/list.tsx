import type { PresetAtomList } from '../types/base';
import { renderBlocks } from './blocks-content';

/**
 * Atom `preset-atom.list` — an ordered/unordered list, server-rendered.
 * `content` is a Strapi blocks field; the shared renderer turns its `list` node
 * into the matching `<ul>`/`<ol>` markup.
 */
export function List({ content }: PresetAtomList) {
  return <section data-block="preset-atom.list">{renderBlocks(content)}</section>;
}
