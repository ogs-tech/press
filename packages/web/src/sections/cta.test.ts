import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cta } from './cta';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Cta({ __component: 'preset-organism.cta', id: 1, ...(props as any) }));

describe('Cta renderer', () => {
  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ button: { label: 'Go', url: '/go' } })).toBe('');
  });

  it('wraps output in a <section> Container that carries data-block (Spec §8.2)', () => {
    const html = render({ title: 'Start now', button: { label: 'Go', url: '/go' } });
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
    expect(render({ title: 'Start now', button: { label: 'Go', url: '/go' } }))
      .toContain('<h2>Start now</h2>');
  });

  it('renders the optional subtitle when present', () => {
    expect(render({ title: 'Start now', subtitle: 'No credit card', button: { label: 'Go', url: '/go' } }))
      .toContain('No credit card');
  });

  it('defaults align to "left" and honors "center"', () => {
    expect(render({ title: 'T', button: { label: 'Go', url: '/go' } })).toContain('data-align="left"');
    expect(render({ title: 'T', button: { label: 'Go', url: '/go' }, align: 'center' }))
      .toContain('data-align="center"');
  });

  it('renders the button only when a complete link is present (Spec §8)', () => {
    expect(render({ title: 'T', button: { label: 'Go', url: '/go' } })).toContain('href="/go"');
    const noHref = render({ title: 'T', subtitle: 'Sub', button: { label: 'Go' } });
    expect(noHref).toContain('<h2>T</h2>');
    expect(noHref).toContain('Sub');
    expect(noHref).not.toContain('data-cta="button"');
  });
});
