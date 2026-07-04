import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Footer } from './footer';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Footer({ __component: 'chrome.footer', id: 1, ...(props as any) }));

describe('Footer renderer', () => {
  it('wraps output in a data-block="chrome.footer" element', () => {
    expect(render({ text: 'hi', brand: { name: 'Acme' } })).toContain('data-block="chrome.footer"');
  });

  it('renders the editor text verbatim when present', () => {
    expect(render({ text: '© Acme Corp — all rights reserved', brand: { name: 'Acme' } }))
      .toContain('© Acme Corp — all rights reserved');
  });

  it('falls back to "brand · currentYear" when text is empty (Spec §1: today\'s behavior)', () => {
    const year = String(new Date().getFullYear());
    const empty = render({ text: '', brand: { name: 'Acme' } });
    expect(empty).toContain('Acme');
    expect(empty).toContain(year);
    const absent = render({ brand: { name: 'Acme' } });
    expect(absent).toContain('Acme');
    expect(absent).toContain(year);
  });

  it('tolerates an un-hydrated block (no brand) without crashing', () => {
    expect(() => render({})).not.toThrow();
    expect(render({})).toContain(String(new Date().getFullYear()));
  });
});
