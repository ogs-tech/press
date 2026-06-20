// .press/web/press-config.ts (materialized) — resolves the adopter's web-zone
// BUILD-TIME anchors ONCE into an immutable module constant: routes, theme.name
// (the <html data-theme> selector + ThemeName guard), and theme.fonts (which
// next/font must know at build time). Identity, SEO, and theme colour/radius
// VALUES are NOT here — they are fetched at runtime from the CMS "Site Settings"
// single type by getSiteConfig (site-settings-cms spec §6). Engine-owned and
// rewritten every run — never hand-edited.
import userConfig from '../../packages/web/config';
import { resolveConfig } from '@ogs-tech/press-web';

export const buildTime = resolveConfig(userConfig);
