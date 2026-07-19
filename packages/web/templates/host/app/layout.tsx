import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import {
  BlockRenderer,
  buildConsentBootstrapScript,
  buildMetadata,
  buildThemeStyle,
  CookieConsentBanner,
  getSiteConfig,
} from '@ogs-tech/press-web';
import '@ogs-tech/press-web/theme.css';
import { customBlocks } from '../press.blocks';
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
        {/* Block-composed chrome (Spec §3): the same pipeline as the page body,
            hydrated by mapSiteSettings. An unreachable CMS → empty zones →
            header/footer render nothing (unbranded over synthetic, Spec §4). */}
        <header>
          <BlockRenderer blocks={site.chrome.header} components={customBlocks} />
        </header>
        <main>{children}</main>
        <footer>
          <BlockRenderer blocks={site.chrome.footer} components={customBlocks} />
        </footer>
        {/* Cookie-consent plugin mount (cookie-consent Spec §1/§5): config is
            CMS-sourced and fails OPEN (banner shows with engine defaults when
            the CMS is unreachable — a consent gate must not vanish on a hiccup). */}
        <CookieConsentBanner key={site.plugins.cookieConsent.urn} plugin={site.plugins.cookieConsent} />
      </body>
    </html>
  );
}
