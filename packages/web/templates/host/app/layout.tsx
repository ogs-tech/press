import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import {
  buildConsentBootstrapScript,
  buildMetadata,
  buildThemeStyle,
  CookieConsentBanner,
  getSiteConfig,
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

// Brand defaults, no page: title = seo.defaultTitle + favicon. Fetched at runtime
// from the CMS (ISR ~60s) so editor changes appear without a redeploy.
export async function generateMetadata() {
  return buildMetadata(await getSiteConfig(buildTime), null);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteConfig(buildTime);
  // suppressHydrationWarning: the consent bootstrap script in <head> mutates
  // <html> (data-press-consent) before React hydrates; the prop silences only
  // THIS element's attribute diff — child mismatches still surface.
  return (
    <html lang={site.site.locale} data-theme={buildTime.theme.name} className={fontVars} suppressHydrationWarning>
      <head>
        {/* The single injection point for token values (CMS-sourced or DEFAULT_THEME). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(site) }} />
        {/* Pre-paint consent check (cookie-consent Spec §5): stamps
            <html data-press-consent="decided"> so theme.css hides the banner
            before first paint for a visitor who already decided. The visitor's
            decision stays client-only — never read via cookies() in the RSC
            tree, which would force the whole route dynamic. */}
        <script dangerouslySetInnerHTML={{ __html: buildConsentBootstrapScript() }} />
      </head>
      <body>
        {/* The page shell (header/main/footer) is rendered by TreeRenderer inside the
            route — the layout cannot see the slug, so it cannot resolve per-page
            slots (Spec §5). It keeps html/head, theme injection, consent bootstrap
            and the cookie banner. */}
        {children}
        <CookieConsentBanner key={site.plugins.cookieConsent.urn} plugin={site.plugins.cookieConsent} />
      </body>
    </html>
  );
}
