import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { buildMetadata, buildThemeStyle, getSiteConfig, ExamplePlugin } from '@ogs-tech/press-web';
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

// Brand defaults, no page: title = brand.name + favicon. Fetched at runtime
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
        {/* The page shell (header/main/footer) is rendered by TreeRenderer inside the
            route — the layout cannot see the slug, so it cannot resolve per-page
            slots (Spec §5). It keeps html/head and the theme injection only. */}
        {children}
        {site.plugins.example.enabled && <ExamplePlugin message={site.plugins.example.message} />}
      </body>
    </html>
  );
}
