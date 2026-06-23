import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressHeading } from '../types/base';
import { Heading } from './heading';

const render = (level: PressHeading['level'], text: string): string =>
  renderToStaticMarkup(Heading({ __component: 'press.heading', id: 1, level, text }));

describe('Heading renderer', () => {
  it('renders an <h{level}> carrying the data-block hook and text', () => {
    expect(render('2', 'Section title')).toContain('<h2 data-block="press.heading">Section title</h2>');
  });

  it('honors each level 1–6', () => {
    for (const level of ['1', '2', '3', '4', '5', '6'] as const) {
      expect(render(level, 'X')).toContain(`<h${level} data-block="press.heading">X</h${level}>`);
    }
  });

  it('falls back to h2 when level is missing (tolerant)', () => {
    expect(renderToStaticMarkup(Heading({ __component: 'press.heading', id: 1, text: 'Untitled' } as any)))
      .toContain('<h2 data-block="press.heading">Untitled</h2>');
  });
});
