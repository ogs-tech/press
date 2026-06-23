import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BlocksContent } from '../types/base';
import { Quote } from './quote';

const render = (props: { content: BlocksContent; citation?: string }): string =>
  renderToStaticMarkup(Quote({ __component: 'press.quote', id: 1, ...props }));

const content: BlocksContent = [{ type: 'paragraph', children: [{ type: 'text', text: 'To be, or not to be.' }] }];

describe('Quote renderer', () => {
  it('wraps the prose in a <blockquote> inside the data-block section', () => {
    const html = render({ content });
    expect(html).toContain('<section data-block="press.quote">');
    expect(html).toContain('<blockquote><p>To be, or not to be.</p></blockquote>');
  });

  it('renders the optional citation as <cite> when provided', () => {
    expect(render({ content, citation: 'W. Shakespeare' })).toContain('<cite>W. Shakespeare</cite>');
  });

  it('omits <cite> when citation is absent', () => {
    expect(render({ content })).not.toContain('<cite>');
  });
});
