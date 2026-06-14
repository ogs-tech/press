import { describe, expect, it } from 'vitest';
import { buildBodyPopulate } from './dz-populate';

describe('buildBodyPopulate', () => {
  it('builds a per-component `on` map populating one level (media included) for each DZ component', () => {
    expect(buildBodyPopulate(['press.hero', 'custom.callout'])).toEqual({
      body: {
        on: {
          'press.hero': { populate: '*' },
          'custom.callout': { populate: '*' },
        },
      },
    });
  });

  it('produces an empty `on` map when the dynamic zone has no components', () => {
    expect(buildBodyPopulate([])).toEqual({ body: { on: {} } });
  });
});
