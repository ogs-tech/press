import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PressMedia } from '../types/base';
import { Gallery } from './gallery';

// Gallery inherits Hero's old role as the media-serialization contract example
// (Spec §5.2): it proves media crosses the REST boundary — now with *multiple*
// images. Each src is resolved ABSOLUTE against CMS_URL so contract tests need no
// next/image domain config. CMS_URL is unset here → the engine default applies.
const render = (props: { heading?: string; images?: PressMedia[]; caption?: string }): string =>
  renderToStaticMarkup(Gallery({ __component: 'press.gallery', id: 1, ...props }));

const img = (url: string, alternativeText?: string | null): PressMedia => ({ url, alternativeText });

describe('Gallery renderer', () => {
  it('wraps output in a data-block="press.gallery" section', () => {
    expect(render({ images: [img('/uploads/a.png')] })).toContain('<section data-block="press.gallery">');
  });

  it('resolves a relative image url absolute against CMS_URL', () => {
    expect(render({ images: [img('/uploads/a.png')] })).toContain('src="http://localhost:1337/uploads/a.png"');
  });

  it('keeps an already-absolute image url untouched', () => {
    expect(render({ images: [img('https://cdn.example.com/a.png')] })).toContain('src="https://cdn.example.com/a.png"');
  });

  it('renders one <img> per image with its alt text', () => {
    const html = render({ images: [img('/a.png', 'First'), img('/b.png', 'Second')] });
    expect(html).toContain('alt="First"');
    expect(html).toContain('alt="Second"');
    expect((html.match(/<img/g) ?? []).length).toBe(2);
  });

  it('uses an empty alt when alternativeText is null/absent', () => {
    expect(render({ images: [img('/a.png', null)] })).toContain('alt=""');
  });

  it('renders the optional heading when provided', () => {
    expect(render({ heading: 'Gallery', images: [img('/a.png')] })).toContain('<h2>Gallery</h2>');
  });

  it('omits the heading when absent', () => {
    expect(render({ images: [img('/a.png')] })).not.toContain('<h2>');
  });

  it('renders the optional caption when provided', () => {
    expect(render({ images: [img('/a.png')], caption: 'Seeded image' })).toContain('Seeded image');
  });

  it('tolerates a missing images field without throwing', () => {
    expect(() => render({ heading: 'Empty' })).not.toThrow();
    expect(render({ heading: 'Empty' })).not.toContain('<img');
  });

  it('tolerates an empty images array without throwing', () => {
    expect(() => render({ images: [] })).not.toThrow();
    expect(render({ images: [] })).not.toContain('<img');
  });
});
