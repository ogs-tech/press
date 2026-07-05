import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PresetAtomButton } from '../types/base';
import { Button } from './button';

const render = (props: { label: string; href: string; variant?: PresetAtomButton['variant'] }): string =>
  renderToStaticMarkup(Button({ __component: 'preset-atom.button', id: 1, ...(props as any) }));

describe('Button renderer', () => {
  it('renders an anchor with the label and href inside the data-block wrapper', () => {
    const html = render({ label: 'Get started', href: '/start', variant: 'primary' });
    expect(html).toContain('<div data-block="preset-atom.button">');
    expect(html).toContain('href="/start"');
    expect(html).toContain('>Get started</a>');
  });

  it('exposes the variant as a data-variant styling hook', () => {
    expect(render({ label: 'A', href: '#', variant: 'secondary' })).toContain('data-variant="secondary"');
  });

  it('defaults the variant to primary when absent (tolerant)', () => {
    expect(render({ label: 'A', href: '#' })).toContain('data-variant="primary"');
  });
});
