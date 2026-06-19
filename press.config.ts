// press.config.ts — Project zone (repo root). The single whitelabel source of
// truth: identity + SEO, consumed by @ogs-tech/press-web through defineConfig /
// resolveConfig / buildMetadata. The engine READS this file (the host imports
// it) but NEVER rewrites it — an engine update leaves it untouched (Spec §8 AC5).
import { defineConfig } from '@ogs-tech/press-web';

export default defineConfig({
  brand: {
    name: 'Acme',
    logo: '/logo.svg',
    favicon: '/favicon.ico',
  },
  site: {
    url: 'https://acme.test',
    locale: 'en',
  },
  seo: {
    titleTemplate: '%s | Acme',
    defaultTitle: 'Acme',
    defaultDescription: 'An Acme content site.',
    defaultOgImage: '/og.png',
  },
});
