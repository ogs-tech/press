// cms/scripts/seed-content.mjs — the demo content as PURE DATA, importable by
// both seed.mjs (to write it) and the engine's CLI test suite (to validate the
// tree shape against the shared validator — the seed-regression guard).
// Plain-text content throughout (curated `content: text` decision 2026-07-20).
import { randomUUID } from 'node:crypto';

export const REPO_URL = 'https://github.com/ogs-tech/press';
export const PRESS_SITE_URL = 'https://useogs.com/press';
export const NPM_CREATE_URL = 'https://www.npmjs.com/package/@ogs-tech/create-press';

export const SITE_SETTINGS = {
  name: 'Press',
  url: 'http://localhost:3000',
  locale: 'en',
  seo: {
    titleTemplate: '%s · Press',
    title: 'Press',
    description: 'A press-powered site, server-rendered end-to-end.',
  },
  themeColors: {
    primary: '#119350',
    accent: '#D9A12C',
    secondary: '#3D5CC2',
    ink: '#142036',
    surface: '#FAF8F3',
    muted: '#7A7E89',
    danger: '#C0392B',
    onPrimary: '#FFFFFF',
    border: 'rgba(20,32,54,0.12)',
  },
  themeRadius: { xs: '6px', sm: '10px', md: '14px', lg: '20px' },
};

const block = (component, data = {}) => ({ id: randomUUID(), type: 'block', component, data });
const column = (children, container) => ({ id: randomUUID(), type: 'column', children, ...(container ? { container } : {}) });
const row = (ratio, children, container) => ({ id: randomUUID(), type: 'row', ratio, children, ...(container ? { container } : {}) });

/**
 * The demo home as a PressTree (Spec §4 seeds): hero → prose atoms → a 50-50
 * row whose right column nests ANOTHER row (the recursion demo) → separator/
 * button/spacer → cta banner → adopter callout. Chrome inherits pageDefaults.
 */
export const buildHomeBody = ({ heroAssetId }) => ({
  version: 1,
  root: {
    type: 'layout',
    header: { mode: 'inherit' },
    footer: { mode: 'inherit' },
    children: [
      block('preset-organism.hero', {
        eyebrow: 'Press engine',
        title: 'Hello from press',
        subtitle: 'A press-powered site, server-rendered end-to-end.',
        image: { assetId: heroAssetId },
        cta: { label: 'Read the docs', url: REPO_URL },
        align: 'left',
      }),
      block('preset-atom.heading', { text: 'What ships in the box', level: '2' }),
      block('preset-atom.paragraph', {
        content: 'This prose lives in the CMS and renders as static HTML — no client hydration.',
      }),
      block('preset-atom.list', {
        format: 'unordered',
        content: [
          'Atomic text blocks — paragraph, heading, list and quote.',
          'Media & structure — image, button, separator and spacer.',
          'Rows and columns — recursive layout composed in the admin.',
          'Your own custom-* blocks, usable anywhere in the tree.',
        ].join('\n'),
      }),
      block('preset-atom.quote', {
        content: 'The contract is HTML on the server.',
        citation: 'The press engine',
      }),
      // The composition mechanism itself: a 50-50 row whose RIGHT column nests
      // another 50-50 row — full recursion on the demo page.
      row('50-50', [
        column([
          block('preset-atom.paragraph', {
            content: 'Editor-composed layout — rows and columns arranged in the admin, rendered on the engine grid.',
          }),
        ]),
        column([
          row('50-50', [
            column([block('preset-atom.paragraph', { content: 'Columns nest rows.' })]),
            column([block('preset-atom.paragraph', { content: 'Rows nest columns.' })]),
          ]),
        ], { verticalAlign: 'center' }),
      ], { gap: 'normal' }),
      block('preset-atom.separator', { variant: 'line' }),
      block('preset-atom.button', {
        link: { label: 'Star on GitHub', url: REPO_URL, newTab: true },
        variant: 'secondary',
      }),
      block('preset-atom.spacer', { size: 'md' }),
      block('preset-organism.cta', {
        title: 'Ready to press publish?',
        subtitle: 'Scaffold a site, open the admin, and ship your first page in minutes.',
        button: { label: 'Scaffold your site', url: PRESS_SITE_URL },
        align: 'center',
      }),
      block('custom-organism.callout', {
        message: 'Adopter callout renders via the Project-zone block map',
        variant: 'success',
      }),
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
