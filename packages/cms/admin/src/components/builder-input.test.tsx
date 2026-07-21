// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import BuilderInput from './builder-input';
import { resetPressDataCache } from '../lib/press-data';

vi.mock('@strapi/strapi/admin', () => ({
  useStrapiApp: () => undefined, // no media-library in tests → assetId input fallback
}));

const SCHEMA = {
  tree: { version: 1 },
  contentTypes: {},
  components: {
    'preset-atom.paragraph': { uid: 'preset-atom.paragraph', attributes: { content: { type: 'text', required: true } } },
    'preset-organism.navbar': { uid: 'preset-organism.navbar', attributes: { items: { type: 'component', component: 'preset-molecule.link', repeatable: true } } },
    'preset-molecule.link': { uid: 'preset-molecule.link', attributes: { label: { type: 'string' }, page: { type: 'relation', relation: 'oneToOne', target: 'plugin::press-cms.page' }, url: { type: 'string' }, newTab: { type: 'boolean' } } },
  },
};

let container: HTMLDivElement;
let root: Root;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  resetPressDataCache();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/api/press/schema') ? SCHEMA : { data: [{ documentId: 'home-doc', title: 'Home', slug: 'home' }] }),
  })));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const flush = async () => act(async () => { await Promise.resolve(); });

describe('BuilderInput (tree mode)', () => {
  it('renders slot editors + body forest from an empty value and emits a tree on add', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <BuilderInput name="body" attribute={{}} value={undefined} onChange={onChange} />,
      );
    });
    await flush();
    expect(container.textContent).toContain('header');
    expect(container.textContent).toContain('body');

    const select = container.querySelector('[data-press-slot="body"] select[aria-label="Add node"]') as HTMLSelectElement;
    const addButton = select.parentElement!.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      select.value = 'preset-atom.paragraph';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => { addButton.click(); });

    const emitted = onChange.mock.calls.at(-1)![0].target;
    expect(emitted.type).toBe('json');
    expect(emitted.value.version).toBe(1);
    expect(emitted.value.root.children).toHaveLength(1);
    expect(emitted.value.root.children[0]).toMatchObject({ type: 'block', component: 'preset-atom.paragraph', data: {} });
    expect(typeof emitted.value.root.children[0].id).toBe('string');
  });
});

describe('BuilderInput (slots mode)', () => {
  it('edits { header, footer } node arrays', async () => {
    const onChange = vi.fn();
    const value = { header: [{ id: 'n1', type: 'block', component: 'preset-organism.navbar', data: {} }], footer: [] };
    await act(async () => {
      root.render(
        <BuilderInput name="pageDefaults" attribute={{ options: { mode: 'slots' } }} value={value} onChange={onChange} />,
      );
    });
    await flush();
    expect(container.textContent).toContain('preset-organism.navbar');
  });
});
