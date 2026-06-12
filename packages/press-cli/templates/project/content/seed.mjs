// content/seed.mjs — Project-zone sample content. Boots the cms host
// programmatically (CMS server must be STOPPED), uploads a tiny PNG, and creates
// a PUBLISHED 'home' page with a press.hero + custom.callout so the first
// `press dev` renders something. Idempotent: deletes any existing 'home' first.
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
const SLUG = 'home';

// 1×1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  try {
    // Idempotency: remove any existing 'home' page (draft + published).
    const existing = await app.documents(PAGE_UID).findMany({ filters: { slug: SLUG }, status: 'draft' });
    for (const doc of existing) {
      await app.documents(PAGE_UID).delete({ documentId: doc.documentId });
    }

    // Upload the image through the upload plugin service.
    const tmpDir = path.join(process.cwd(), '.tmp');
    mkdirSync(tmpDir, { recursive: true });
    const filepath = path.join(tmpDir, 'hero.png');
    writeFileSync(filepath, PNG);

    const uploaded = await app.plugin('upload').service('upload').upload({
      data: {},
      files: {
        filepath,
        originalFilename: 'hero.png',
        mimetype: 'image/png',
        size: PNG.length,
      },
    });
    const fileId = uploaded[0].id;
    console.log(`[seed] uploaded image id=${fileId}`);

    // Create the published page with both blocks.
    const page = await app.documents(PAGE_UID).create({
      data: {
        title: 'E2E Home',
        slug: SLUG,
        body: [
          {
            __component: 'press.hero',
            heading: 'Hello from press',
            subheading: 'server-rendered end-to-end',
            ctaLabel: 'Get started',
            image: fileId,
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
