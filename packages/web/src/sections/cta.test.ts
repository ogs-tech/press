import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cta } from './cta';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Cta({ __component: 'preset-organism.cta', id: 1, ...(props as any) }));

describe('Cta renderer', () => {
  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ buttonLabel: 'Go', buttonHref: '/go' })).toBe('');
  });

  it('wraps output in a <section> Container that carries data-block (Spec §8.2)', () => {
    const html = render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' });
    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-press-layout="container"');
    expect(html).toContain('data-block="preset-organism.cta"');
  });

  it('emits an inner data-cta="frame" wrapper for the boxy visual (Spec §8.2)', () => {
    const html = render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' });
    expect(html).toContain('data-cta="frame"');
    // The frame wraps the heading/subtitle/button — assert on order.
    const frameIdx = html.indexOf('data-cta="frame"');
    const h2Idx = html.indexOf('<h2>');
    expect(frameIdx).toBeGreaterThan(-1);
    expect(h2Idx).toBeGreaterThan(frameIdx);
  });

  it('renders the title as an h2 inside the frame', () => {
    expect(render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('<h2>Start now</h2>');
  });

  it('renders the optional subtitle when present', () => {
    expect(render({ title: 'Start now', subtitle: 'No credit card', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('No credit card');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go' })).toContain('data-align="left"');
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go', align: 'center' }))
      .toContain('data-align="center"');
  });

  it('renders the button only when BOTH buttonLabel and buttonHref are present (Spec §8)', () => {
    expect(render({ title: 'T', buttonLabel: 'Go', buttonHref: '/go' })).toContain('href="/go"');
    const noHref = render({ title: 'T', subtitle: 'Sub', buttonLabel: 'Go' });
    expect(noHref).toContain('<h2>T</h2>');
    expect(noHref).toContain('Sub');
    expect(noHref).not.toContain('data-cta="button"');
  });
});
