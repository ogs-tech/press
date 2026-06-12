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

    // --- Spec 2: whitelabel config surfaces in <head> ---

    // AC1: <title> = seo.titleTemplate applied to the page title ('%s | Acme').
    // Also proves the AC3 OVERRIDE case (custom template visible in the markup).
    if (!html.includes('<title>E2E Home | Acme</title>')) {
      fail('title not templated from config (expected "<title>E2E Home | Acme</title>")');
    }

    // AC1: meta description falls back to seo.defaultDescription (page has none).
    if (!/<meta name="description"[^>]*content="An Acme content site\."/.test(html)) {
      fail('meta description not from config');
    }

    // AC1: OpenGraph title mirrors the templated title.
    if (!/<meta property="og:title"[^>]*content="E2E Home \| Acme"/.test(html)) {
      fail('og:title not templated from config');
    }

    // AC1: og:image ABSOLUTE, resolved against site.url.
    if (!/<meta property="og:image"[^>]*content="https:\/\/acme\.test\/og\.png"/.test(html)) {
      fail('og:image not absolute against site.url');
    }

    // AC1: canonical derived from site.url.
    if (!/<link rel="canonical" href="https:\/\/acme\.test"/.test(html)) {
      fail('canonical not from site.url');
    }

    // AC2: <html lang> equals site.locale.
    if (!/<html lang="en"/.test(html)) {
      fail('<html lang> not from site.locale');
    }

    // AC2: favicon link derives from brand.favicon.
    if (!/<link rel="icon" href="\/favicon\.ico"/.test(html)) {
      fail('favicon link not from brand.favicon');
    }

    console.log('E2E PASS (Spec 2): title/description/og/canonical/lang/favicon from config');

    console.log('E2E PASS: hero + callout server-rendered; image src =', m[1]);
  } finally {
    web.kill();
  }
}

main().catch((e) => fail(e.message ?? String(e)));
