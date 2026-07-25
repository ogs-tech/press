// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DesignSystemProvider } from '@strapi/design-system';
import BuilderInput from './builder-input';
import { resetPressDataCache } from '../lib/press-data';

vi.mock('@strapi/strapi/admin', () => ({
  useStrapiApp: () => undefined, // no media-library in tests → assetId input fallback
}));

const SCHEMA = {
  tree: { version: 2 },
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

// jsdom lacks these; the design-system widgets touch them on render.
const stubBrowserApis = (): void => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; },
    })) as any;
  }
  if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
};

const render = (ui: ReactElement) => root.render(<DesignSystemProvider>{ui}</DesignSystemProvider>);

beforeEach(() => {
  stubBrowserApis();
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

/** Finds a <button> by its exact (trimmed) visible text — icon-only children carry no text. */
const buttonByText = (scope: ParentNode, text: string): HTMLButtonElement => {
  const btn = [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!btn) throw new Error(`button "${text}" not found`);
  return btn as HTMLButtonElement;
};

describe('BuilderInput (tree mode)', () => {
  it('renders slot sections + body forest and emits a tree when a palette block is added', async () => {
    const onChange = vi.fn();
    await act(async () => {
      render(<BuilderInput name="body" attribute={{}} value={undefined} onChange={onChange} />);
    });
    await flush();
    expect(container.textContent).toContain('Header');
    expect(container.textContent).toContain('Body');
    expect(container.textContent).toContain('Footer');

    const body = container.querySelector('[data-press-slot="body"]') as HTMLElement;
    await act(async () => { buttonByText(body, 'Add block').click(); }); // open the palette
    await act(async () => { buttonByText(body, 'Paragraph').click(); }); // pick a block

    const emitted = onChange.mock.calls.at(-1)![0].target;
    expect(emitted.type).toBe('json');
    expect(emitted.value.version).toBe(2);
    expect(emitted.value.root.children).toHaveLength(1);
    expect(emitted.value.root.children[0]).toMatchObject({ type: 'block', component: 'preset-atom.paragraph', data: {} });
    expect(typeof emitted.value.root.children[0].id).toBe('string');
  });

  it('offers page-level Layout options in the Body section, naming the site default', async () => {
    await act(async () => {
      render(<BuilderInput name="body" attribute={{}} value={undefined} onChange={() => {}} />);
    });
    await flush();

    const body = container.querySelector('[data-press-slot="body"]') as HTMLElement;
    // the body's OWN container section, before any node card is expanded
    const toggle = body.querySelector('[data-press-container-toggle]') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    await act(async () => { toggle.click(); });

    // only `gap` applies to the layout root — no Width, no alignment
    expect(body.textContent).toContain('Vertical rhythm');
    expect(body.textContent).toContain('Site default · per-block spacing');
    expect(body.textContent).not.toContain('Width');
  });

  it('names a CMS-served page gap in the body placeholder', async () => {
    (globalThis.fetch as any) = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        String(url).includes('/api/press/schema')
          ? { ...SCHEMA, layoutDefaults: { page: { gap: 'spacious' }, row: {}, column: {} } }
          : { data: [] },
    }));
    await act(async () => {
      render(<BuilderInput name="body" attribute={{}} value={undefined} onChange={() => {}} />);
    });
    await flush();

    const body = container.querySelector('[data-press-slot="body"]') as HTMLElement;
    await act(async () => { (body.querySelector('[data-press-container-toggle]') as HTMLButtonElement).click(); });
    expect(body.textContent).toContain('Site default · Spacious');
  });
});

describe('BuilderInput (slots mode)', () => {
  it('edits { header, footer } node arrays and labels blocks by friendly name', async () => {
    const onChange = vi.fn();
    const value = { header: [{ id: 'n1', type: 'block', component: 'preset-organism.navbar', data: {} }], footer: [] };
    await act(async () => {
      render(<BuilderInput name="pageDefaults" attribute={{ options: { mode: 'slots' } }} value={value} onChange={onChange} />);
    });
    await flush();
    expect(container.textContent).toContain('Navbar');
  });
});
