import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExamplePlugin } from './example-plugin';

describe('ExamplePlugin renderer', () => {
  it('renders the resolved message inside a data-press-plugin="example" wrapper', () => {
    const html = renderToStaticMarkup(ExamplePlugin({ message: 'Hello from the example plugin!' }));
    expect(html).toBe('<div data-press-plugin="example">Hello from the example plugin!</div>');
  });

  it('renders whatever message it is given — it never re-resolves a default itself', () => {
    const html = renderToStaticMarkup(ExamplePlugin({ message: 'Custom toggled-on copy' }));
    expect(html).toContain('Custom toggled-on copy');
  });
});
