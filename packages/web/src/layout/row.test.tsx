import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Row } from './row';

const render = (props: Parameters<typeof Row>[0]): string =>
  renderToStaticMarkup(createElement(Row, props));

describe('<Row>', () => {
  it('renders a <div data-press-layout="row"> by default', () => {
    expect(render({ children: 'x' })).toContain('data-press-layout="row"');
  });

  it('honors as="nav"', () => {
    expect(render({ as: 'nav', children: 'x' })).toContain('<nav');
  });

  it('defaults gap to "md" via --press-row-gap-current', () => {
    expect(render({ children: 'x' })).toContain('--press-row-gap-current:var(--press-grid-gap-md)');
  });

  it('reuses --press-grid-gap-* symbolic tokens for scalar gaps', () => {
    expect(render({ gap: 'lg', children: 'x' })).toContain('--press-row-gap-current:var(--press-grid-gap-lg)');
  });

  it('emits per-tier row gap vars for a Responsive gap (distinct var name from Grid, Spec §5.5)', () => {
    const html = render({ gap: { base: 'sm', md: 'md', lg: 'lg' }, children: 'x' });
    expect(html).toContain('--press-row-gap-current:var(--press-grid-gap-sm)');
    expect(html).toContain('--press-row-gap-current-md:var(--press-grid-gap-md)');
    expect(html).toContain('--press-row-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('emits gap "none" as 0', () => {
    expect(render({ gap: 'none', children: 'x' })).toContain('--press-row-gap-current:0');
  });

  it('elides default align/justify from the DOM (Spec §5.5)', () => {
    const html = render({ children: 'x' });
    expect(html).not.toContain('data-align');
    expect(html).not.toContain('data-justify');
  });

  it('emits data-align and data-justify for non-default values', () => {
    const html = render({ align: 'center', justify: 'between', children: 'x' });
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-justify="between"');
  });

  it('defaults wrap to true (elided) and emits data-wrap="false" when off (Spec §5.5)', () => {
    expect(render({ children: 'x' })).not.toContain('data-wrap');
    expect(render({ wrap: false, children: 'x' })).toContain('data-wrap="false"');
  });
});
