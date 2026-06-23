// cms/scripts/seed.mjs — One-shot sample content for the cms host. Boots it
// programmatically (CMS server must be STOPPED), fills the Site Settings single
// type (identity/SEO + theme), uploads a few tiny PNGs, and creates a PUBLISHED
// 'home' page that showcases the Gutenberg-style core palette (heading, paragraph,
// list, quote, separator, image, button, spacer, gallery) plus the adopter's
// custom.callout, so the first `press dev` renders a branded, themed site.
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

// 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
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

    // Upload a few tiny images so the gallery proves MULTIPLE media cross the REST
    // contract — Gallery is the engine's media-serialization example (Spec §5.2).
    const uploadImage = async (name) => {
      const filepath = path.join(tmpDir, name);
      writeFileSync(filepath, PNG);
      const uploaded = await app.plugin('upload').service('upload').upload({
        data: {},
        files: { filepath, originalFilename: name, mimetype: 'image/png', size: PNG.length },
      });
      return uploaded[0].id;
    };
    const imageIds = [];
    for (const name of ['press-1.png', 'press-2.png', 'press-3.png']) {
      imageIds.push(await uploadImage(name));
    }
    console.log(`[seed] uploaded ${imageIds.length} image(s): ${imageIds.join(', ')}`);

    // Create the published "Hello from press" home from the Gutenberg-style core
    // palette: atomic text blocks (heading/paragraph/list/quote), structural blocks
    // (separator/button/spacer), media (image single + gallery multiple), and the
    // adopter's custom.callout.
    const page = await app.documents(PAGE_UID).create({
      data: {
        title: 'Hello from press',
        slug: SLUG,
        body: [
          { __component: 'press.heading', text: 'Hello from press', level: '1' },
          {
            __component: 'press.paragraph',
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
          { __component: 'press.heading', text: 'What ships in the box', level: '2' },
          {
            __component: 'press.list',
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
                      { type: 'text', text: ' — image, gallery, button, separator and spacer.' },
                    ],
                  },
                  {
                    type: 'list-item',
                    children: [
                      { type: 'text', text: 'Your own ' },
                      { type: 'text', text: 'custom.*', code: true },
                      { type: 'text', text: ' blocks, admitted automatically into the page.' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            __component: 'press.quote',
            content: [
              { type: 'paragraph', children: [{ type: 'text', text: 'The contract is HTML on the server.' }] },
            ],
            citation: 'The press engine',
          },
          {
            __component: 'press.paragraph',
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
          { __component: 'press.separator', variant: 'line' },
          {
            __component: 'press.image',
            image: imageIds[0],
            caption: 'A single image — proof one media field crosses the REST contract.',
          },
          { __component: 'press.button', label: 'Get started', href: 'https://github.com/ogs-tech/press', variant: 'primary' },
          { __component: 'press.spacer', size: 'lg' },
          {
            __component: 'press.gallery',
            heading: 'Gallery',
            images: imageIds,
            caption: 'Seeded images — proof that multiple media cross the REST contract.',
          },
          {
            __component: 'custom.callout',
            message: 'Adopter callout renders via the Project-zone block map',
            variant: 'success',
          },
        ],
      },
      status: 'published',
    });
    console.log(`[seed] created published page documentId=${page.documentId} slug=${SLUG}`);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
