import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { List } from './list';

describe('List', () => {
  it('renders one <li> per non-empty line, unordered by default', () => {
    const html = renderToStaticMarkup(createElement(List, { content: 'a\nb\n\nc' }));
    expect(html).toContain('data-block="preset-atom.list"');
    expect(html).toContain('<ul>');
    expect(html.match(/<li>/g)).toHaveLength(3);
  });

  it('renders <ol> for format ordered and nothing when empty', () => {
    expect(renderToStaticMarkup(createElement(List, { content: '1st', format: 'ordered' }))).toContain('<ol>');
    expect(renderToStaticMarkup(createElement(List, { content: '' }))).toBe('');
  });
});
