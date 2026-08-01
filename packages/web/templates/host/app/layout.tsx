import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import {
  buildSeoMetadata,
  buildThemeStyle,
  getSiteConfig,
  ExamplePlugin,
  CookieConsentBanner,
  CONSENT_ANTI_FLASH_SCRIPT,
} from '@ogs-tech/press-web';
import '@ogs-tech/press-web/theme.css';
import { buildTime } from '../press-config';

// Default-theme fonts, loaded + optimized by next/font at build time. Each exposes
// a CSS variable consumed by theme.css with a fallback:
//   font-family: var(--press-font-body, var(--press-font-body-default))
// so a Site Settings font override (emitted by buildThemeStyle) wins, else the
// optimized default applies. Build-time families are still owned by press.config.
const display = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--press-font-display-default' });
const body = Archivo({ subsets: ['latin'], display: 'swap', variable: '--press-font-body-default' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--press-font-mono-default' });

const fontVars = `${display.variable} ${body.variable} ${mono.variable}`;

// Brand defaults, no page: title.template (or brand.name when the SEO plugin
// is disabled) + favicon. Fetched at runtime from the CMS (ISR ~60s) so
// editor changes appear without a redeploy. No `path` — this fallback only
// fires for routes outside the catch-all (e.g. error boundaries), where a
// page-specific canonical doesn't apply.
export async function generateMetadata() {
  return buildSeoMetadata(await getSiteConfig(buildTime), null);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig(buildTime);
  return (
    <html lang={site.site.locale} data-theme={buildTime.theme.name} className={fontVars}>
      <head>
        {/* The single injection point for token values (CMS-sourced or DEFAULT_THEME). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(site) }} />
        {/* Anti-flash (Plugin/Legal Spec §5): stamps data-press-consent-decided
            on <html> before hydration when a decision cookie already exists. */}
        <script dangerouslySetInnerHTML={{ __html: CONSENT_ANTI_FLASH_SCRIPT }} />
      </head>
      <body>
        {/* The page shell (header/main/footer) is rendered by TreeRenderer inside the
            route — the layout cannot see the slug, so it cannot resolve per-page
            slots (Spec §5). It keeps html/head and the theme injection only. */}
        {children}
        {site.plugins.example.enabled && <ExamplePlugin message={site.plugins.example.message} />}
        {site.plugins.legal.consent.enabled && <CookieConsentBanner {...site.plugins.legal.consent} />}
      </body>
    </html>
  );
}
