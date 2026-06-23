import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressMedia } from '../types/base';
import { Image } from './image';

// press.image is the engine's media-serialization example: it proves a media field
// crosses the REST contract. Each src is resolved ABSOLUTE against CMS_URL (unset
// here → engine default) so contract tests need no domain config.
const render = (props: { image?: PressMedia; caption?: string }): string =>
  renderToStaticMarkup(Image({ __component: 'press.image', id: 1, ...(props as any) }));

const img = (url: string, alternativeText?: string | null): PressMedia => ({ url, alternativeText });

describe('Image renderer', () => {
  it('wraps output in a data-block="press.image" figure', () => {
    expect(render({ image: img('/uploads/a.png') })).toContain('<figure data-block="press.image">');
  });

  it('resolves a relative image url absolute against CMS_URL', () => {
    expect(render({ image: img('/uploads/a.png') })).toContain('src="http://localhost:1337/uploads/a.png"');
  });

  it('keeps an already-absolute image url untouched', () => {
    expect(render({ image: img('https://cdn.example.com/a.png') })).toContain('src="https://cdn.example.com/a.png"');
  });

  it('uses the media alternativeText as alt, empty when null/absent', () => {
    expect(render({ image: img('/a.png', 'A cat') })).toContain('alt="A cat"');
    expect(render({ image: img('/a.png', null) })).toContain('alt=""');
  });

  it('renders the optional caption as <figcaption> when provided', () => {
    expect(render({ image: img('/a.png'), caption: 'Fig. 1' })).toContain('<figcaption>Fig. 1</figcaption>');
  });

  it('omits the caption when absent', () => {
    expect(render({ image: img('/a.png') })).not.toContain('<figcaption>');
  });

  it('tolerates a missing image without throwing (renders nothing)', () => {
    expect(() => render({ caption: 'orphan' })).not.toThrow();
    expect(render({ caption: 'orphan' })).toBe('');
  });
});
