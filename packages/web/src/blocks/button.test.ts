import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Button } from './button';

describe('Button', () => {
  it('renders the resolved link with the variant hook', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { link: { label: 'Go', url: '/go' }, variant: 'secondary' }),
    );
    expect(html).toContain('data-block="preset-atom.button"');
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('href="/go"');
    expect(html).toContain('Go');
  });

  it('renders a hydrated (already-resolved) link and nothing when unresolvable', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { link: { label: 'Home', href: '/', external: false, newTab: false } as any }),
    );
    expect(html).toContain('href="/"');
    expect(renderToStaticMarkup(createElement(Button, {}))).toBe('');
  });
});
