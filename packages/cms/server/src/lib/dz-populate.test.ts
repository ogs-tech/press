import { describe, expect, it } from 'vitest';
import { buildBodyPopulate, buildChromeDzPopulate } from './dz-populate';

describe('buildBodyPopulate', () => {
  it('builds a per-component `on` map populating one level (media included) for each DZ component', () => {
    expect(buildBodyPopulate(['press.image', 'custom.callout'])).toEqual({
      body: {
        on: {
          'press.image': { populate: '*' },
          'custom.callout': { populate: '*' },
        },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildBodyPopulate([])).toEqual({ body: { on: {} } });
  });
});

describe('buildChromeDzPopulate', () => {
  it("populates one level ('*') per component, EXCEPT chrome.navbar which needs a deep populate", () => {
    // `populate: '*'` is SHALLOW: chrome.navbar's `items.page` relation (internal
    // link → slug) and `cta` component sit one level deeper — without the deep
    // populate every internal nav link silently falls back to its raw url (Spec §1/§3).
    expect(buildChromeDzPopulate(['chrome.navbar', 'chrome.footer', 'custom.callout'])).toEqual({
      on: {
        'chrome.navbar': { populate: { items: { populate: { page: { fields: ['slug'] } } }, cta: true } },
        'chrome.footer': { populate: '*' },
        'custom.callout': { populate: '*' },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildChromeDzPopulate([])).toEqual({ on: {} });
  });
});
