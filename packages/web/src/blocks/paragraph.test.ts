import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Paragraph, splitParagraphs } from './paragraph';

describe('splitParagraphs', () => {
  it('splits on blank lines and drops empties', () => {
    expect(splitParagraphs('One.\n\nTwo.\n\n\n')).toEqual(['One.', 'Two.']);
    expect(splitParagraphs(undefined)).toEqual([]);
    expect(splitParagraphs('  \n ')).toEqual([]);
  });
});

describe('Paragraph', () => {
  it('renders one <p> per blank-line-separated paragraph inside the data-block wrapper', () => {
    const html = renderToStaticMarkup(createElement(Paragraph, { content: 'First.\n\nSecond.' }));
    expect(html).toContain('data-block="preset-atom.paragraph"');
    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).toContain('First.');
  });

  it('renders nothing for empty content (tolerance)', () => {
    expect(renderToStaticMarkup(createElement(Paragraph, { content: '' }))).toBe('');
  });
});
