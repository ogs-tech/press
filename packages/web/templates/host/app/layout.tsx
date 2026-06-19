import { buildMetadata } from '@ogs-tech/press-web';
import { config } from '../press-config';

// Brand defaults, no page: title = seo.defaultTitle, plus the favicon icon.
export const metadata = buildMetadata(config, null);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={config.site.locale}>
      <body>{children}</body>
    </html>
  );
}
