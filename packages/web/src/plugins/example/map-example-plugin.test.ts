import { describe, expect, it } from 'vitest';
import { mapExamplePlugin } from './map-example-plugin';
import { DEFAULT_EXAMPLE_PLUGIN } from './default-example-plugin';

describe('mapExamplePlugin', () => {
  it('resolves DEFAULT_EXAMPLE_PLUGIN (disabled) when the CMS component is null', () => {
    expect(mapExamplePlugin(null)).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('resolves DEFAULT_EXAMPLE_PLUGIN when the CMS component is absent (undefined)', () => {
    expect(mapExamplePlugin(undefined)).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('resolves DEFAULT_EXAMPLE_PLUGIN when the CMS component is an empty object', () => {
    expect(mapExamplePlugin({})).toEqual(DEFAULT_EXAMPLE_PLUGIN);
  });

  it('lets a present enabled/message win over the default', () => {
    expect(mapExamplePlugin({ enabled: true, message: 'Toggled on' })).toEqual({
      enabled: true,
      message: 'Toggled on',
    });
  });

  it('keeps the default message when only enabled is set', () => {
    expect(mapExamplePlugin({ enabled: true })).toEqual({
      enabled: true,
      message: DEFAULT_EXAMPLE_PLUGIN.message,
    });
  });
});
