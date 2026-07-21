import { describe, expect, it } from 'vitest';
import { applicableContainerAttrs, fieldsFor, paletteGroups } from './form-model';

describe('fieldsFor', () => {
  it('maps the contract attribute types to field kinds', () => {
    const fields = fieldsFor({
      title: { type: 'string', required: true },
      content: { type: 'text' },
      align: { type: 'enumeration', enum: ['left', 'center'] },
      newTab: { type: 'boolean' },
      image: { type: 'media', multiple: false },
      page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' } as any,
      cta: { type: 'component', component: 'preset-molecule.link', repeatable: false },
      items: { type: 'component', component: 'preset-molecule.link', repeatable: true },
      blob: { type: 'json' },
      mystery: { type: 'password' },
    });
    expect(fields).toEqual([
      { name: 'title', kind: 'text', required: true },
      { name: 'content', kind: 'textarea', required: false },
      { name: 'align', kind: 'select', required: false, options: ['left', 'center'] },
      { name: 'newTab', kind: 'checkbox', required: false },
      { name: 'image', kind: 'media', required: false },
      { name: 'page', kind: 'pageRef', required: false },
      { name: 'cta', kind: 'component', required: false, component: 'preset-molecule.link', repeatable: false },
      { name: 'items', kind: 'component', required: false, component: 'preset-molecule.link', repeatable: true },
      { name: 'blob', kind: 'json', required: false },
    ]);
  });
});

describe('applicableContainerAttrs', () => {
  it('shows only the attrs that apply per node type (Spec §3)', () => {
    expect(applicableContainerAttrs('layout', true)).toEqual(['gap']);
    expect(applicableContainerAttrs('row', true)).toEqual(['width', 'gap', 'verticalAlign']);
    expect(applicableContainerAttrs('row', false)).toEqual(['gap', 'verticalAlign']); // width is top-level-only
    expect(applicableContainerAttrs('column', false)).toEqual(['gap', 'verticalAlign']);
  });
});

describe('paletteGroups', () => {
  it('groups placeable uids by category, excluding nested-only and config layers', () => {
    const schema = {
      contentTypes: {},
      components: Object.fromEntries([
        'preset-atom.paragraph', 'preset-atom.heading',
        'preset-organism.hero', 'preset-organism.navbar',
        'preset-molecule.link', 'preset-config.seo', 'preset-layout.container',
        'custom-organism.callout',
      ].map((uid) => [uid, { uid, attributes: {} }])),
    } as any;
    expect(paletteGroups(schema)).toEqual([
      { category: 'custom-organism', uids: ['custom-organism.callout'] },
      { category: 'preset-atom', uids: ['preset-atom.heading', 'preset-atom.paragraph'] },
      { category: 'preset-organism', uids: ['preset-organism.hero', 'preset-organism.navbar'] },
    ]);
  });
});
