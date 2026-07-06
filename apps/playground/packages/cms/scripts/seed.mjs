// cms/scripts/seed.mjs — One-shot sample content for the cms host. Boots it
// programmatically (CMS server must be STOPPED), fills the Site Settings single
// type (identity/SEO + theme + a demo navbar), uploads a few tiny PNGs, and creates a PUBLISHED
// 'home' page that showcases the Atomic Design core palette (heading, paragraph,
// list, quote, separator, image, button, spacer) plus the adopter's custom-organism.callout,
// so the first `press dev` renders a branded, themed site.
// Skip-if-empty: seeds only a fresh CMS — existing content is never overwritten
// (delete cms/.tmp to reset).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Load Strapi through the CommonJS resolver: its `.mjs` build does bare directory
// imports (e.g. `lodash/fp`) that Node's native ESM loader rejects, whereas the CJS
// build (dist/index.js) resolves them the CommonJS way. createRequire lets this ESM
// script pull the CJS entry without converting the whole file to .cjs.
const require = createRequire(import.meta.url);
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const PAGE_UID = 'plugin::press-cms.page';
const SITE_SETTING_UID = 'plugin::press-cms.site-setting';
const SLUG = 'home';

// A visible 480×270 (16:9) placeholder cover — brand primary over accent — so
// preset-atom.image renders a real image rather than a degenerate 1×1 transparent pixel.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAeAAAAEOCAIAAADe+FMwAAAC+ElEQVR42u3UQQ0AIAwAsVnAB2LwhoLJws0s8NySJlVwj4t1DwANhQQABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAYNIBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEGrAGDQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNgEEDGDQABg1g0AAYNIBBA2DQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNYNAAGDQABg1g0AAYNIBBA2DQABg0gEEDYNAABg2AQQMYtAoABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAYNIBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEEDYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEEDYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg1g0AAYNAAGDWDQABg0gEEDYNAAGDSAQQNg0AAGDYBBAxg0AAYNwO+gX24AGjJoAIMGwKABDBoAgwYwaAAMGgCDBjBoAAwawKABMGgADBrAoAEwaACDBsCgAQwaAIMGwKABDBoAgwYwaAAMGgCDBjBoAAwawKABMGgAgwbAoAEwaACDBsCgAQwaAIMGwKABDBoAgwYwaAAMGsCgJQAwaAAMGsCgATBoAIMGwKABMGgAgwbAoAEMGgCDBsCgAQwaAIMGMGgADBrAoAEwaAAMGsCgATBoAIMGwKABMGgAgwbAoAEMGgCDBjBoAAwaAIMGMGgADBrAoAEwaAAMGsCgATBoAIMGwKABDFoFAIMGwKABDBoAgwYwaAAMGgCDBjBoAAwawKABMGgADBrAoAEwaACDBsCgAQwaAIMGwKABJiqe+vFZK33AgwAAAABJRU5ErkJggg==',
  'base64',
);

// Demo Site Settings. Theme values MIRROR the engine's DEFAULT_THEME
// (packages/web/src/config/default-theme.ts) so the seeded look matches the
// runtime fallback exactly — once written, this CMS record is the source of truth
// and DEFAULT_THEME only acts as the CMS-down floor. Edit freely in the admin.
const SITE_SETTINGS = {
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
  // Demo chrome: a navbar carrying two url-based preset-molecule.nav-item molecules, so a
  // molecule renders live in the playground. The engine seeds an EMPTY navbar by default
  // (DEFAULT_CHROME — an editor decides the links); this playground-only override
  // populates it for the dogfood. url-based items resolve without a page relation
  // (map-site-settings resolveNavItem), keeping the seed self-contained.
  header: [
    {
      __component: 'preset-organism.navbar',
      items: [
        { label: 'Home', url: '/' },
        { label: 'Docs', url: 'https://github.com/ogs-tech/press', newTab: true },
      ],
    },
  ],
};

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  try {
    // Site Settings (single type): the engine's bootstrap already seeded an EMPTY
    // record (Strapi runs plugin bootstrap during app.load()), so fill THAT record
    // once with demo identity/SEO + theme. Runs before the page skip below so it is
    // never gated by existing pages. Idempotent: skip once an editor set a name, so
    // their values are never clobbered (reset by deleting cms/.tmp).
    const settings = await app.documents(SITE_SETTING_UID).findFirst();
    if (settings?.name) {
      console.log('[seed] site settings already filled — skipping.');
    } else if (settings) {
      await app.documents(SITE_SETTING_UID).update({ documentId: settings.documentId, data: SITE_SETTINGS });
      console.log('[seed] site settings filled (empty record updated).');
    } else {
      await app.documents(SITE_SETTING_UID).create({ data: SITE_SETTINGS });
      console.log('[seed] site settings created.');
    }

    // Skip-if-empty: only seed a fresh CMS. Once any published page exists (the
    // first boot's sample, or the adopter's own content), leave it untouched so
    // `press dev` never discards their work. Reset by deleting cms/.tmp (the DB).
    const existing = await app.documents(PAGE_UID).findMany({ status: 'published' });
    if (existing.length > 0) {
      console.log(`[seed] ${existing.length} published page(s) exist — skipping seed (delete cms/.tmp to reset).`);
      return;
    }

    const tmpDir = path.join(process.cwd(), '.tmp');
    mkdirSync(tmpDir, { recursive: true });

    // Upload one cover image so preset-atom.image proves a media field crosses the REST
    // contract — preset-atom.image is the engine's media-serialization example (Spec §5.2).
    const uploadImage = async (name) => {
      const filepath = path.join(tmpDir, name);
      writeFileSync(filepath, PNG);
      const uploaded = await app.plugin('upload').service('upload').upload({
        data: {},
        files: { filepath, originalFilename: name, mimetype: 'image/png', size: PNG.length },
      });
      return uploaded[0].id;
    };
    const coverImageId = await uploadImage('press-cover.png');
    console.log(`[seed] uploaded cover image id=${coverImageId}`);

    // Create the published "Hello from press" home from the Atomic Design core
    // palette: atomic text blocks (heading/paragraph/list/quote), structural blocks
    // (separator/button/spacer), media (image single), and the adopter's custom-organism.callout.
    const page = await app.documents(PAGE_UID).create({
      data: {
        title: 'Hello from press',
        slug: SLUG,
        body: [
          { __component: 'preset-atom.heading', text: 'Hello from press', level: '1' },
          {
            __component: 'preset-atom.paragraph',
            content: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'A press-powered site, ' },
                  { type: 'text', text: 'server-rendered end-to-end', bold: true },
                  { type: 'text', text: '. This prose lives in the CMS and renders as static HTML — no client hydration.' },
                ],
              },
            ],
          },
          { __component: 'preset-atom.heading', text: 'What ships in the box', level: '2' },
          {
            __component: 'preset-atom.list',
            content: [
              {
                type: 'list',
                format: 'unordered',
                children: [
                  {
                    type: 'list-item',
                    children: [
                      { type: 'text', text: 'Atomic text blocks', bold: true },
                      { type: 'text', text: ' — paragraph, heading, list and quote.' },
                    ],
                  },
                  {
                    type: 'list-item',
                    children: [
                      { type: 'text', text: 'Media & structure', bold: true },
                      { type: 'text', text: ' — image, button, separator and spacer.' },
                    ],
                  },
                  {
                    type: 'list-item',
                    children: [
                      { type: 'text', text: 'Your own ' },
                      { type: 'text', text: 'custom-*', code: true },
                      { type: 'text', text: ' blocks, admitted automatically into the page.' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            __component: 'preset-atom.quote',
            content: [
              { type: 'paragraph', children: [{ type: 'text', text: 'The contract is HTML on the server.' }] },
            ],
            citation: 'The press engine',
          },
          {
            __component: 'preset-atom.paragraph',
            content: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Read the ' },
                  { type: 'link', url: 'https://github.com/ogs-tech/press', children: [{ type: 'text', text: 'docs' }] },
                  { type: 'text', text: ' to learn more.' },
                ],
              },
            ],
          },
          { __component: 'preset-atom.separator', variant: 'line' },
          {
            __component: 'preset-atom.image',
            image: coverImageId,
            caption: 'A single image — proof one media field crosses the REST contract.',
          },
          { __component: 'preset-atom.button', label: 'Get started', href: 'https://github.com/ogs-tech/press', variant: 'primary' },
          { __component: 'preset-atom.spacer', size: 'lg' },
          {
            __component: 'custom-organism.callout',
            message: 'Adopter callout renders via the Project-zone block map',
            variant: 'success',
          },
        ],
      },
      status: 'published',
    });
    console.log(`[seed] created published page documentId=${page.documentId} slug=${SLUG}`);
  } finally {
    // Content is committed by here. better-sqlite3's tarn pool can throw a benign
    // "aborted" as it drains during app.destroy() (e.g. background image processing
    // from the uploads is still in flight) — swallow it so a teardown race never
    // fails an otherwise-successful seed, and the `press dev` boot it gates.
    try {
      await app.destroy();
    } catch (err) {
      console.warn(`[seed] ignored teardown error: ${err?.message ?? err}`);
    }
  }
}

main()
  // Exit explicitly on success: a late tarn pool-abort can surface as an unhandled
  // rejection AFTER teardown and would otherwise crash the process with exit 1 even
  // though seeding succeeded. Exiting here preempts that event-loop noise.
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] FAILED:', err);
    process.exit(1);
  });
