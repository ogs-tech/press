import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import { buildMetadata, buildThemeStyle } from '@ogs-tech/press-web';
import '@ogs-tech/press-web/theme.css';
import { config } from '../press-config';

// Default-theme fonts, loaded + optimized by next/font at build time (Spec §6).
// Each exposes a CSS variable consumed by theme.css with a fallback:
//   font-family: var(--press-font-body, var(--press-font-body-default))
// so an adopter override (emitted by buildThemeStyle) wins, else the optimized
// default applies. Overriding theme.fonts.* sets the family string only — loading
// that family is the adopter's responsibility.
const display = Bricolage_Grotesque({ subsets: ['latin'], display: 'swap', variable: '--press-font-display-default' });
const body = Archivo({ subsets: ['latin'], display: 'swap', variable: '--press-font-body-default' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--press-font-mono-default' });

const fontVars = `${display.variable} ${body.variable} ${mono.variable}`;

// Brand defaults, no page: title = seo.defaultTitle, plus the favicon icon.
export const metadata = buildMetadata(config, null);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={config.site.locale} data-theme={config.theme.name} className={fontVars}>
      <head>
        {/* The single injection point for token values (Spec §0). */}
        <style dangerouslySetInnerHTML={{ __html: buildThemeStyle(config) }} />
      </head>
      <body>
        <header>
          <a href="/">
            {config.brand.logo ? <img src={config.brand.logo} alt="" /> : null}
            <span>{config.brand.name}</span>
          </a>
        </header>
        <main>{children}</main>
        <footer>
          <small>
            {config.brand.name} · {new Date().getFullYear()}
          </small>
        </footer>
      </body>
    </html>
  );
}
