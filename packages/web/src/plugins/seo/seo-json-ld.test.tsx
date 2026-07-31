import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SeoJsonLd } from './seo-json-ld';

describe('SeoJsonLd', () => {
  it('renders one <script type="application/ld+json"> per entry', () => {
    const html = renderToStaticMarkup(
      SeoJsonLd({ data: [{ '@type': 'Organization', name: 'Acme' }, { '@type': 'WebPage', name: 'About' }] }),
    );
    expect(html).toContain('<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>');
    expect(html).toContain('<script type="application/ld+json">{"@type":"WebPage","name":"About"}</script>');
  });

  it('renders nothing for an empty array (disabled plugin)', () => {
    const html = renderToStaticMarkup(SeoJsonLd({ data: [] }));
    expect(html).toBe('');
  });

  it('escapes a literal "<" so free-form CMS text can never close the surrounding </script> tag', () => {
    const html = renderToStaticMarkup(SeoJsonLd({ data: [{ name: '</script><script>alert(1)</script>' }] }));
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e');
  });
});
