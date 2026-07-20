import { describe, expect, it } from 'vitest';
import { buildBodyPopulate, buildChromeDzPopulate } from './dz-populate';

describe('buildBodyPopulate', () => {
  it('builds a per-component `on` map populating one level (media included) for each DZ component', () => {
    expect(buildBodyPopulate(['preset-atom.image', 'custom-organism.callout'])).toEqual({
      body: {
        on: {
          'preset-atom.image': { populate: '*' },
          'custom-organism.callout': { populate: '*' },
        },
      },
    });
  });

  it('deep-populates preset-organism.columns, whose column image/button sit two levels down', () => {
    // `populate: '*'` is SHALLOW: it reaches the repeatable `columns` component
    // itself but NOT the media/component refs inside each column — the exact
    // navbar situation in buildChromeDzPopulate. Without this, a column's
    // image/button is silently absent from the wire while the admin shows it.
    expect(buildBodyPopulate(['preset-organism.columns', 'preset-organism.hero'])).toEqual({
      body: {
        on: {
          'preset-organism.columns': { populate: { columns: { populate: { image: true, button: true } } } },
          'preset-organism.hero': { populate: '*' },
        },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildBodyPopulate([])).toEqual({ body: { on: {} } });
  });
});

describe('buildChromeDzPopulate', () => {
  it("populates one level ('*') per component, EXCEPT preset-organism.navbar which needs a deep populate", () => {
    // `populate: '*'` is SHALLOW: the navbar's `items.page` relation (internal
    // link → slug) and `cta` component sit one level deeper — without the deep
    // populate every internal nav link silently falls back to its raw url (Spec §1/§3).
    expect(buildChromeDzPopulate(['preset-organism.navbar', 'preset-organism.footer', 'custom-organism.callout'])).toEqual({
      on: {
        'preset-organism.navbar': { populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true } },
        'preset-organism.footer': { populate: '*' },
        'custom-organism.callout': { populate: '*' },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildChromeDzPopulate([])).toEqual({ on: {} });
  });
});
