import { describe, expect, it } from 'vitest';
import { mapPage, type RawPage } from './map-page';

const raw: RawPage = {
  id: 1,
  documentId: 'doc-abc',
  title: 'Home',
  slug: 'home',
  body: {
    version: 1,
    root: { type: 'layout', header: { mode: 'none' }, footer: { mode: 'none' }, children: [] },
  },
};

describe('mapPage', () => {
  it('attaches the canonical stored identity urn:page:{documentId}', () => {
    expect(mapPage(raw).urn).toBe('urn:page:doc-abc');
  });

  it('passes every wire field through unchanged', () => {
    expect(mapPage(raw)).toEqual({ ...raw, urn: 'urn:page:doc-abc' });
  });
});
