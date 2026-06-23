import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BlocksContent } from '../types/base';
import { List } from './list';

const render = (content: BlocksContent): string =>
  renderToStaticMarkup(List({ __component: 'press.list', id: 1, content }));

const li = (value: string): any => ({ type: 'list-item', children: [{ type: 'text', text: value }] });

describe('List renderer', () => {
  it('wraps output in a data-block="press.list" section', () => {
    expect(render([{ type: 'list', format: 'unordered', children: [li('a')] }]))
      .toContain('<section data-block="press.list">');
  });

  it('renders an unordered list as <ul>', () => {
    expect(render([{ type: 'list', format: 'unordered', children: [li('a'), li('b')] }]))
      .toContain('<ul><li>a</li><li>b</li></ul>');
  });

  it('renders an ordered list as <ol>', () => {
    expect(render([{ type: 'list', format: 'ordered', children: [li('one')] }]))
      .toContain('<ol><li>one</li></ol>');
  });

  it('tolerates empty content without throwing', () => {
    expect(() => render([])).not.toThrow();
  });
});
