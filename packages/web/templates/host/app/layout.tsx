import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { BlockRenderer, buildMetadata, buildThemeStyle, getSiteConfig } from '@ogs-tech/press-web';
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
  return (
    <html lang={site.site.locale} data-theme={buildTime.theme.name} className={fontVars}>
      <head>
        {/* The single injection point for token values (CMS-sourced or DEFAULT_THEME). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(site) }} />
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
      </body>
    </html>
  );
}
