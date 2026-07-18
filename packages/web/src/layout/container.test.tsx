import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Container } from './container';

const render = (props: Parameters<typeof Container>[0]): string =>
  renderToStaticMarkup(createElement(Container, props));

describe('<Container>', () => {
  it('renders a <div> by default with data-press-layout="container"', () => {
    const html = render({ children: 'x' });
    expect(html.startsWith('<div data-press-layout="container"')).toBe(true);
  });

  it('honors as="section"', () => {
    expect(render({ as: 'section', children: 'x' })).toContain('<section');
  });

  it('defaults maxWidth to "lg"', () => {
    expect(render({ children: 'x' })).toContain('data-max-width="lg"');
  });

  it('emits every maxWidth value', () => {
    for (const size of ['prose', 'sm', 'md', 'lg', 'xl', 'full'] as const) {
      expect(render({ maxWidth: size, children: 'x' })).toContain(`data-max-width="${size}"`);
    }
  });

  it('defaults padded to true and emits data-padded', () => {
    expect(render({ children: 'x' })).toContain('data-padded');
  });

  it('omits data-padded when padded={false}', () => {
    expect(render({ padded: false, children: 'x' })).not.toContain('data-padded');
  });

  it('passes through extra data-* attributes (Spec §5)', () => {
    const html = render({
      as: 'section',
      children: 'x',
      'data-block': 'preset-organism.hero',
      'data-align': 'center',
    } as any);
    expect(html).toContain('data-block="preset-organism.hero"');
    expect(html).toContain('data-align="center"');
  });

  it('renders children', () => {
    expect(render({ children: 'hello' })).toContain('hello');
  });
});
