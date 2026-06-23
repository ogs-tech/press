import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressSeparator } from '../types/base';
import { Separator } from './separator';

const render = (variant?: PressSeparator['variant']): string =>
  renderToStaticMarkup(Separator({ __component: 'press.separator', id: 1, variant } as any));

describe('Separator renderer', () => {
  it('renders an <hr> carrying the data-block hook', () => {
    expect(render('line')).toContain('<hr data-block="press.separator"');
  });

  it('exposes the variant as a data-variant styling hook', () => {
    expect(render('dots')).toContain('data-variant="dots"');
  });

  it('defaults the variant to line when absent (tolerant)', () => {
    expect(render()).toContain('data-variant="line"');
  });
});
