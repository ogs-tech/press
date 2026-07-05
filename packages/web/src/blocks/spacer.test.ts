import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PresetAtomSpacer } from '../types/base';
import { Spacer } from './spacer';

const render = (size?: PresetAtomSpacer['size']): string =>
  renderToStaticMarkup(Spacer({ __component: 'preset-atom.spacer', id: 1, size } as any));

describe('Spacer renderer', () => {
  it('renders a decorative, aria-hidden div carrying the data-block hook', () => {
    const html = render('md');
    expect(html).toContain('<div data-block="preset-atom.spacer"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('exposes the size as a data-size styling hook', () => {
    expect(render('xl')).toContain('data-size="xl"');
  });

  it('defaults the size to md when absent (tolerant)', () => {
    expect(render()).toContain('data-size="md"');
  });
});
