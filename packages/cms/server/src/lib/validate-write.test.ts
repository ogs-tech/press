import { describe, expect, it } from 'vitest';
import { assertValidPageWrite, assertValidSiteSettingWrite } from './validate-write';

const validTree = {
  version: 1,
  root: { type: 'layout', header: { mode: 'inherit' }, footer: { mode: 'inherit' }, children: [] },
};

describe('assertValidPageWrite', () => {
  it('passes valid trees and skips writes without a body (partial update)', () => {
    expect(() => assertValidPageWrite({ body: validTree })).not.toThrow();
    expect(() => assertValidPageWrite({ title: 'x' })).not.toThrow();
    expect(() => assertValidPageWrite(undefined)).not.toThrow();
  });

  it('rejects structural errors AND stripped-attr warnings (strict write)', () => {
    expect(() => assertValidPageWrite({ body: { version: 99 } })).toThrow(/unsupported tree version/);
    const warned = {
      version: 1,
      root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [
        { id: 'r', type: 'row', ratio: '50-50', container: { width: 'xl' }, children: [
          { id: 'c', type: 'column', children: [] },
        ] },
      ] },
    };
    expect(() => assertValidPageWrite({ body: warned })).toThrow(/width/);
  });

  it('tolerates a JSON string body (db layer serialization)', () => {
    expect(() => assertValidPageWrite({ body: JSON.stringify(validTree) })).not.toThrow();
    expect(() => assertValidPageWrite({ body: 'not json {' })).toThrow(/invalid composition tree/);
  });
});

describe('assertValidSiteSettingWrite', () => {
  it('validates each pageDefaults slot as a Node[] and skips absent slots', () => {
    expect(() => assertValidSiteSettingWrite({ pageDefaults: { header: [], footer: [] } })).not.toThrow();
    expect(() => assertValidSiteSettingWrite({ name: 'x' })).not.toThrow();
    expect(() =>
      assertValidSiteSettingWrite({ pageDefaults: { header: [{ id: 'c', type: 'column', children: [] }] } }),
    ).toThrow(/only legal directly under a row/);
  });
});
