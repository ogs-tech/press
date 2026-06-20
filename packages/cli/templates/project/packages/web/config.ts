// press.config.ts — Project zone (repo root). BUILD-TIME anchors only: the home
// route, the theme NAME (<html data-theme> + ThemeName guard), and theme FONTS
// (which next/font must know at build time). Identity, SEO, and theme colour/
// radius VALUES live in the CMS "Site Settings" single type now — edit them in
// the admin (they are fetched at runtime, no redeploy). The engine READS this
// file but NEVER rewrites it.
import { defineConfig } from '@ogs-tech/press-web';

export default defineConfig({
  routes: {
    // Slug of the page served at the site root ('/'). The home page lives only
    // at '/'; a direct hit on this slug redirects there.
    home: 'home',
  },
  // Appearance selection (not values). The string form selects the embedded
  // theme; a destructive change to ThemeName fails tsc right here. Override the
  // optimized font families with `theme: { fonts: { body: 'Inter' } }`.
  theme: 'default',
});
