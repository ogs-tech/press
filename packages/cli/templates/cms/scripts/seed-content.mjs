// cms/scripts/seed-content.mjs — the demo content as PURE DATA, importable by
// both seed.mjs (to write it) and the engine's CLI test suite (to validate the
// tree shape against the shared validator — the seed-regression guard).
// Plain-text content throughout (curated `content: text` decision 2026-07-20).
import { randomUUID } from 'node:crypto';

export const REPO_URL = 'https://github.com/ogs-tech/press';
export const PRESS_SITE_URL = 'https://useogs.com/press';
export const NPM_CREATE_URL = 'https://www.npmjs.com/package/@ogs-tech/create-press';

export const SITE_SETTINGS = {
  basicSettings: {
    name: 'Press',
    url: 'http://localhost:3000',
    locale: 'en',
    primary: '#119350',
    accent: '#D9A12C',
    ink: '#142036',
    surface: '#FAF8F3',
    radius: '14px',
    themeAdvanced: {
      secondary: '#3D5CC2',
      muted: '#7A7E89',
      danger: '#C0392B',
      onPrimary: '#FFFFFF',
      border: 'rgba(20,32,54,0.12)',
      radiusXs: '6px',
      radiusSm: '10px',
      radiusLg: '20px',
    },
  },
};

const block = (component, data = {}) => ({ id: randomUUID(), type: 'block', component, data });
const column = (span, children, container) => ({ id: randomUUID(), type: 'column', span, children, ...(container ? { container } : {}) });
const row = (children, container) => ({ id: randomUUID(), type: 'row', children, ...(container ? { container } : {}) });

/**
 * The demo home as a PressTree (Spec §4 seeds): a deliberately SIMPLE showcase of
 * the two things worth demonstrating up front — the COMPONENTS you place (a few
 * blocks + a note on the wider palette) and the GRID SYSTEM (a 50-50 row split
 * into columns, with a component in each cell; the image component also carries
 * the media-crosses-REST proof via its `image` assetId). No hero, no deep
 * nesting — the rest of the palette is composed in the admin builder, not
 * pre-seeded. Chrome inherits pageDefaults.
 */
export const buildHomeBody = ({ imageAssetId }) => ({
  version: 2,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [
      block('preset-atom.heading', { text: 'Components', level: '2' }),
      block('preset-atom.paragraph', {
        content: 'Components are the blocks you place in the tree. They render as static HTML with no client hydration.',
      }),
      block('preset-atom.list', {
        format: 'unordered',
        content: ['Atoms — heading, paragraph, list, quote, image, button', 'Organisms — hero, cta and site chrome', 'Your own custom-* blocks, anywhere in the tree'].join('\n'),
      }),
      block('preset-atom.heading', { text: 'Grid system', level: '2' }),
      // Grid system: two columns, stacked on phones (base 12) and 50/50 on desktop (md 6).
      row([
        column({ base: 12, md: 6 }, [block('preset-atom.image', { image: { assetId: imageAssetId }, caption: 'An image component inside a column' })]),
        column({ base: 12, md: 6 }, [block('preset-atom.paragraph', {
          content: 'Rows and columns are the grid system. Here an image fills the left column and this paragraph the right — a 12/6 span split. Compose the rest in the builder.',
        })]),
      ]),
    ],
  },
});

/**
 * Demo navigation for Site Settings pageDefaults: the Home item is a PAGE REF
 * ({ documentId }) — exercising the reference-hydration path end-to-end — plus
 * an external link and a CTA button. The footer keeps the bare seeded node.
 */
export const buildPageDefaults = ({ homeDocumentId }) => ({
  header: [
    block('preset-organism.navbar', {
      items: [
        { label: 'Home', page: { documentId: homeDocumentId } },
        { label: 'GitHub', url: REPO_URL, newTab: true },
      ],
      cta: { link: { label: 'Get started', url: NPM_CREATE_URL }, variant: 'primary' },
    }),
  ],
  footer: [block('preset-organism.footer', {})],
});
