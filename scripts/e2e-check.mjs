// scripts/e2e-check.mjs — Spec §7 AC1: end-to-end render check.
// Assumes the CMS is running on :1337 and seeded (scripts/seed-e2e.mjs).
// Builds + starts apps/web, fetches the rendered HTML for /home, asserts both
// blocks render server-side and the hero image src is absolute against CMS_URL.
import { execSync, spawn } from 'node:child_process';

const WEB_URL = 'http://localhost:3000/home';
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });

const fail = (msg) => { console.error('E2E FAIL:', msg); process.exit(1); };

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}

async function main() {
  console.log('> build web');
  sh('pnpm --filter web build');

  console.log('> start web');
  const web = spawn('pnpm', ['--filter', 'web', 'start'], { stdio: 'inherit' });

  try {
    const html = await waitFor(WEB_URL);
    if (html === null) fail('web did not serve /home');

    // Both blocks present as server-rendered HTML.
    if (!html.includes('Hello from press')) fail('hero heading missing from HTML');
    if (!html.includes('Adopter callout renders via the Project-zone block map')) fail('callout message missing from HTML');

    // Hero image src resolved ABSOLUTE against the CMS base (media crosses contract).
    const m = html.match(/<img[^>]*src="([^"]+)"/);
    if (!m) fail('hero <img> not rendered');
    if (!m[1].startsWith(`${CMS_URL}/uploads/`)) fail(`image src not absolute against CMS base: ${m[1]}`);

    console.log('E2E PASS: hero + callout server-rendered; image src =', m[1]);
  } finally {
    web.kill();
  }
}

main().catch((e) => fail(e.message ?? String(e)));
