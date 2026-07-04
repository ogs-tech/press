import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Cta } from './cta';

const render = (props: Record<string, unknown>): string =>
  renderToStaticMarkup(Cta({ __component: 'section.cta', id: 1, ...(props as any) }));

describe('Cta renderer', () => {
  it('wraps output in a data-block="section.cta" section', () => {
    expect(render({ title: 'Start now', buttonLabel: 'Go', buttonHref: '/go' }))
      .toContain('<section data-block="section.cta"');
  });

  it('renders the title as an h2', () => {
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
    // Missing href → render heading/subtitle WITHOUT the button (no dead link).
    const noHref = render({ title: 'T', subtitle: 'Sub', buttonLabel: 'Go' });
    expect(noHref).toContain('<h2>T</h2>');
    expect(noHref).toContain('Sub');
    expect(noHref).not.toContain('data-cta="button"');
  });

  it('renders nothing when title is missing (tolerant draft, Spec §8)', () => {
    expect(render({ buttonLabel: 'Go', buttonHref: '/go' })).toBe('');
  });
});
