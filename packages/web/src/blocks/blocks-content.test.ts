import { describe, expect, it } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BlocksContent } from '../types/base';
import { renderBlocks } from './blocks-content';

// The engine's in-house Strapi-blocks renderer, extracted from the retired
// press.rich-text so the decomposed text blocks (paragraph/list/quote) can share
// it. This is the most test-worthy surface in the feature: the ~50–80 lines of
// owned rendering that replace the rejected `@strapi/blocks-react-renderer`
// dependency. Rendered to static HTML (a true server function — no hooks, no
// hydration), then asserted on the markup.
const render = (content: BlocksContent): string =>
  renderToStaticMarkup(createElement(Fragment, null, renderBlocks(content)));

const para = (...children: any[]): any => ({ type: 'paragraph', children });
const text = (value: string, marks: Record<string, boolean> = {}): any => ({ type: 'text', text: value, ...marks });

describe('renderBlocks', () => {
  describe('block nodes', () => {
    it('renders a paragraph', () => {
      expect(render([para(text('Hello world'))])).toContain('<p>Hello world</p>');
    });

    it('renders headings at their level (1–6)', () => {
      for (let level = 1; level <= 6; level++) {
        const html = render([{ type: 'heading', level, children: [text(`H${level}`)] }]);
        expect(html).toContain(`<h${level}>H${level}</h${level}>`);
      }
    });

    it('renders an unordered list', () => {
      const html = render([
        { type: 'list', format: 'unordered', children: [
          { type: 'list-item', children: [text('a')] },
          { type: 'list-item', children: [text('b')] },
        ] },
      ]);
      expect(html).toContain('<ul><li>a</li><li>b</li></ul>');
    });

    it('renders an ordered list', () => {
      const html = render([
        { type: 'list', format: 'ordered', children: [
          { type: 'list-item', children: [text('one')] },
        ] },
      ]);
      expect(html).toContain('<ol><li>one</li></ol>');
    });

    it('renders a blockquote', () => {
      expect(render([{ type: 'quote', children: [text('to be')] }])).toContain('<blockquote>to be</blockquote>');
    });

    it('renders a code block inside <pre><code>', () => {
      expect(render([{ type: 'code', children: [text('const x = 1')] }])).toContain('<pre><code>const x = 1</code></pre>');
    });
  });

  describe('inline nodes', () => {
    it('renders an external inline link with its href and a hardening rel', () => {
      const html = render([para(text('see '), { type: 'link', url: 'https://example.com', children: [text('docs')] })]);
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('>docs</a>');
    });

    it('keeps an internal/anchor link clean (no rel)', () => {
      const html = render([para({ type: 'link', url: '/about', children: [text('about')] } as any)]);
      expect(html).toContain('href="/about"');
      expect(html).not.toContain('rel=');
    });

    it('neutralizes a javascript: URL to # (no executable href)', () => {
      const html = render([para({ type: 'link', url: 'javascript:alert(1)', children: [text('x')] } as any)]);
      expect(html).not.toContain('javascript:');
      expect(html).toContain('href="#"');
    });
  });

  describe('text marks', () => {
    it('renders bold as <strong>', () => {
      expect(render([para(text('b', { bold: true }))])).toContain('<strong>b</strong>');
    });
    it('renders italic as <em>', () => {
      expect(render([para(text('i', { italic: true }))])).toContain('<em>i</em>');
    });
    it('renders underline as <u>', () => {
      expect(render([para(text('u', { underline: true }))])).toContain('<u>u</u>');
    });
    it('renders strikethrough as <s>', () => {
      expect(render([para(text('s', { strikethrough: true }))])).toContain('<s>s</s>');
    });
    it('renders inline code as <code>', () => {
      expect(render([para(text('c', { code: true }))])).toContain('<code>c</code>');
    });
    it('combines multiple marks on one run (both tags present, nesting order free)', () => {
      const html = render([para(text('x', { bold: true, italic: true }))]);
      expect(html).toContain('<strong>');
      expect(html).toContain('<em>');
      expect(html).toContain('x');
    });
    it('renders plain text with no mark wrapper', () => {
      const html = render([para(text('plain'))]);
      expect(html).toContain('<p>plain</p>');
      expect(html).not.toContain('<strong>');
    });
  });

  describe('tolerance (mirrors BlockRenderer: unknown → skip, never throw)', () => {
    it('skips an unknown block node without throwing', () => {
      expect(() => render([{ type: 'mystery', children: [text('?')] } as any, para(text('ok'))])).not.toThrow();
      expect(render([{ type: 'mystery', children: [text('?')] } as any, para(text('ok'))])).toContain('<p>ok</p>');
    });
    it('skips an embedded image node (images belong in press.image)', () => {
      const html = render([{ type: 'image', image: { url: '/x.png' } } as any, para(text('caption-less'))]);
      expect(html).not.toContain('<img');
      expect(html).toContain('<p>caption-less</p>');
    });
  });
});
