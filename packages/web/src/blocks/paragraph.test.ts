import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BlocksContent } from '../types/base';
import { Paragraph } from './paragraph';

const render = (content: BlocksContent): string =>
  renderToStaticMarkup(Paragraph({ __component: 'press.paragraph', id: 1, content }));

const para = (...children: any[]): any => ({ type: 'paragraph', children });
const text = (value: string, marks: Record<string, boolean> = {}): any => ({ type: 'text', text: value, ...marks });

describe('Paragraph renderer', () => {
  it('wraps output in a data-block="press.paragraph" section', () => {
    expect(render([para(text('hi'))])).toContain('<section data-block="press.paragraph">');
  });

  it('renders the prose through the shared in-house blocks renderer', () => {
    expect(render([para(text('Hello'), text(' world', { bold: true }))])).toContain('Hello<strong> world</strong>');
  });

  it('tolerates empty content without throwing', () => {
    expect(() => render([])).not.toThrow();
    expect(render([])).toBe('<section data-block="press.paragraph"></section>');
  });
});
