import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Grid } from './grid';

const render = (props: Parameters<typeof Grid>[0]): string =>
  renderToStaticMarkup(createElement(Grid, props));

describe('<Grid>', () => {
  it('renders a <div data-press-layout="grid"> by default', () => {
    expect(render({ children: 'x' })).toContain('data-press-layout="grid"');
  });

  it('honors as="section"', () => {
    expect(render({ as: 'section', children: 'x' })).toContain('<section');
  });

  it('defaults alignItems to "stretch" (elided from the DOM)', () => {
    expect(render({ children: 'x' })).not.toContain('data-align-items');
  });

  it('emits data-align-items for non-default values', () => {
    expect(render({ alignItems: 'center', children: 'x' })).toContain('data-align-items="center"');
    expect(render({ alignItems: 'start', children: 'x' })).toContain('data-align-items="start"');
    expect(render({ alignItems: 'end', children: 'x' })).toContain('data-align-items="end"');
  });

  it('emits --press-grid-gap-current from a bare scalar gap', () => {
    expect(render({ gap: 'lg', children: 'x' })).toContain('--press-grid-gap-current:var(--press-grid-gap-lg)');
  });

  it('defaults gap to "md"', () => {
    expect(render({ children: 'x' })).toContain('--press-grid-gap-current:var(--press-grid-gap-md)');
  });

  it('emits per-tier grid gap vars for a Responsive gap (Spec §5.3)', () => {
    const html = render({ gap: { base: 'sm', md: 'md', lg: 'lg' }, children: 'x' });
    expect(html).toContain('--press-grid-gap-current:var(--press-grid-gap-sm)');
    expect(html).toContain('--press-grid-gap-current-md:var(--press-grid-gap-md)');
    expect(html).toContain('--press-grid-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('skips missing tiers so the CSS var() cascade inherits', () => {
    const html = render({ gap: { base: 'sm', lg: 'lg' }, children: 'x' });
    expect(html).not.toContain('--press-grid-gap-current-md');
    expect(html).toContain('--press-grid-gap-current-lg:var(--press-grid-gap-lg)');
  });

  it('emits gap "none" as 0', () => {
    expect(render({ gap: 'none', children: 'x' })).toContain('--press-grid-gap-current:0');
  });
});
