import type { PressList } from '../types/base';
import { renderBlocks } from './blocks-content';

/**
 * Reference block `press.list` — an ordered/unordered list, server-rendered.
 * `content` is a Strapi blocks field; the shared renderer turns its `list` node
 * into the matching `<ul>`/`<ol>` markup.
 */
export function List({ content }: PressList) {
  return <section data-block="press.list">{renderBlocks(content)}</section>;
}
