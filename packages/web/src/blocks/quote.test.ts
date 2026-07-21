import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Quote } from './quote';

describe('Quote', () => {
  it('renders paragraphs inside blockquote with optional cite', () => {
    const html = renderToStaticMarkup(createElement(Quote, { content: 'Wise words.', citation: 'Someone' }));
    expect(html).toContain('data-block="preset-atom.quote"');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Wise words.');
    expect(html).toContain('<cite>Someone</cite>');
  });

  it('renders nothing when empty and omits cite when absent', () => {
    expect(renderToStaticMarkup(createElement(Quote, { content: '' }))).toBe('');
    expect(renderToStaticMarkup(createElement(Quote, { content: 'x' }))).not.toContain('<cite>');
  });
});
