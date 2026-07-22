// cms/scripts/seed.mjs — One-shot sample content for the cms host. Boots it
// programmatically (CMS server must be STOPPED), fills the Site Settings single
// type (identity/SEO + theme + a demo navbar with links and CTA), uploads one
// tiny PNG (the image-atom cover — the media-crosses-REST proof), and creates a
// PUBLISHED 'home' page kept deliberately SIMPLE (a few components + one 50-50
// grid-layout row — see buildHomeBody), so the first `press dev` renders a
// branded, themed, navigable site whose body demonstrates components and the
// grid layout without being a pre-filled kitchen sink.
// Skip-if-empty: seeds only a fresh CMS — existing content is never overwritten
// (delete cms/.tmp to reset).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildHomeBody, buildPageDefaults, SITE_SETTINGS } from './seed-content.mjs';

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
// the image atom renders a real image rather than a degenerate 1×1 transparent
// pixel (and proves an uploaded media crosses the REST contract).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAeAAAAEOCAIAAADe+FMwAAAC+ElEQVR42u3UQQ0AIAwAsVnAB2LwhoLJws0s8NySJlVwj4t1DwANhQQABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAYNIBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEGrAGDQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNgEEDGDQABg1g0AAYNIBBA2DQABg0gEEDYNAABg2AQQNg0AAGDYBBAxg0AAYNYNAAGDQABg1g0AAYNIBBA2DQABg0gEEDYNAABg2AQQMYtAoABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAYNIBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0AAYNYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEEDYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg2AQQMYNAAGDWDQABg0gEEDYNAAGDSAQQNg0AAGDYBBA2DQAAYNgEEDGDQABg1g0AAYNAAGDWDQABg0gEEDYNAAGDSAQQNg0AAGDYBBAxg0AAYNwO+gX24AGjJoAIMGwKABDBoAgwYwaAAMGgCDBjBoAAwawKABMGgADBrAoAEwaACDBsCgAQwaAIMGwKABDBoAgwYwaAAMGgCDBjBoAAwawKABMGgAgwbAoAEwaACDBsCgAQwaAIMGwKABDBoAgwYwaAAMGsCgJQAwaAAMGsCgATBoAIMGwKABMGgAgwbAoAEMGgCDBsCgAQwaAIMGMGgADBrAoAEwaAAMGsCgATBoAIMGwKABMGgAgwbAoAEMGgCDBjBoAAwaAIMGMGgADBrAoAEwaAAMGsCgATBoAIMGwKABDFoFAIMGwKABDBoAgwYwaAAMGgCDBjBoAAwawKABMGgADBrAoAEwaACDBsCgAQwaAIMGwKABJiqe+vFZK33AgwAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  try {
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

    // 1. The published home page (skip-if-any-published-page-exists, unchanged rule).
    // Created FIRST (order inverted vs the old header-then-page flow) so its
    // documentId exists for pageDefaults' navbar Home item below.
    let homeDocumentId;
    const existing = await app.documents(PAGE_UID).findMany({ status: 'published' });
    if (existing.length > 0) {
      console.log(`[seed] ${existing.length} published page(s) exist — skipping page seed (delete cms/.tmp to reset).`);
      homeDocumentId = existing.find((p) => p.slug === SLUG)?.documentId;
    } else {
      const coverImageId = await uploadImage('press-cover.png');
      console.log(`[seed] uploaded cover image id=${coverImageId}`);
      const page = await app.documents(PAGE_UID).create({
        data: { title: 'Hello from press', slug: SLUG, body: buildHomeBody({ imageAssetId: coverImageId }) },
        status: 'published',
      });
      homeDocumentId = page.documentId;
      console.log(`[seed] created published page documentId=${page.documentId} slug=${SLUG}`);
    }

    // 2. Site Settings: identity + theme + demo pageDefaults (idempotent: skip once named).
    // The engine's bootstrap already seeded an EMPTY record (Strapi runs plugin
    // bootstrap during app.load()), so fill THAT record once. Idempotent: skip
    // once an editor set a name, so their values are never clobbered (reset by
    // deleting cms/.tmp).
    const settings = await app.documents(SITE_SETTING_UID).findFirst();
    if (settings?.name) {
      console.log('[seed] site settings already filled — skipping.');
    } else {
      const data = { ...SITE_SETTINGS };
      if (homeDocumentId) data.pageDefaults = buildPageDefaults({ homeDocumentId });
      if (settings) {
        await app.documents(SITE_SETTING_UID).update({ documentId: settings.documentId, data });
        console.log('[seed] site settings filled (pageDefaults navigation seeded).');
      } else {
        await app.documents(SITE_SETTING_UID).create({ data });
        console.log('[seed] site settings created (pageDefaults navigation seeded).');
      }
    }
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
