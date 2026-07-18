import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Column } from './column';
import { Grid } from './grid';

const render = (props: Parameters<typeof Column>[0]): string =>
  renderToStaticMarkup(createElement(Column, props));

describe('<Column>', () => {
  it('renders a <div data-press-layout="column"> by default', () => {
    expect(render({ children: 'x' })).toContain('data-press-layout="column"');
  });

  it('honors as="section"', () => {
    expect(render({ as: 'section', children: 'x' })).toContain('<section');
  });

  it('defaults span to 12 (emitted as --press-col-span:12)', () => {
    expect(render({ children: 'x' })).toContain('--press-col-span:12');
  });

  it('emits only --press-col-span for a bare scalar (Spec §12)', () => {
    const html = render({ span: 6, children: 'x' });
    expect(html).toContain('--press-col-span:6');
    expect(html).not.toContain('--press-col-span-md');
    expect(html).not.toContain('--press-col-span-lg');
  });

  it('emits per-tier vars for a Responsive span', () => {
    const html = render({ span: { base: 12, md: 6, lg: 4 }, children: 'x' });
    expect(html).toContain('--press-col-span:12');
    expect(html).toContain('--press-col-span-md:6');
    expect(html).toContain('--press-col-span-lg:4');
  });

  it('skips missing tiers so the CSS cascade inherits', () => {
    const html = render({ span: { base: 12, lg: 4 }, children: 'x' });
    expect(html).not.toContain('--press-col-span-md');
    expect(html).toContain('--press-col-span-lg:4');
  });

  it('emits --press-col-start only when start is declared', () => {
    expect(render({ children: 'x' })).not.toContain('--press-col-start');
    expect(render({ start: 3, children: 'x' })).toContain('--press-col-start:3');
  });

  it('emits per-tier start vars', () => {
    const html = render({ start: { base: 1, md: 2, lg: 3 }, children: 'x' });
    expect(html).toContain('--press-col-start:1');
    expect(html).toContain('--press-col-start-md:2');
    expect(html).toContain('--press-col-start-lg:3');
  });

  it('renders correctly nested inside <Grid> (Spec §5.4 — plain grid child)', () => {
    const html = renderToStaticMarkup(
      createElement(Grid, { children: createElement(Column, { span: 6, children: 'cell' }) }),
    );
    expect(html).toContain('data-press-layout="grid"');
    expect(html).toContain('data-press-layout="column"');
    expect(html).toContain('--press-col-span:6');
  });
});
