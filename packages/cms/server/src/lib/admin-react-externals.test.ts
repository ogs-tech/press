import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Regression guard for a SILENT, CI-invisible admin crash.
 *
 * The plugin's admin bundle (builder-input custom field) ships React components.
 * `@strapi/sdk-plugin`'s vite build externalizes ONLY the packages listed in the
 * plugin's `dependencies` + `peerDependencies` (see its vite-config: it iterates
 * `Object.keys(pkg.peerDependencies)`). If `react`/`react-dom` are not declared
 * here, the build BUNDLES the workspace's hoisted React (18) into the admin
 * chunk, producing a second React instance beside the Strapi admin host's React
 * (19) → "Cannot read properties of null (reading 'useState')" at admin runtime.
 * Nothing in `pnpm build`/`pnpm -r test`/typecheck catches this — only opening the
 * admin does. So this test pins the externalization contract instead.
 */
describe('admin bundle React externalization', () => {
  const pkg = JSON.parse(
    readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
  ) as { peerDependencies?: Record<string, string> };

  it('declares react and react-dom as peerDependencies so the plugin admin uses the host React (not a bundled copy)', () => {
    expect(pkg.peerDependencies?.react).toBeDefined();
    expect(pkg.peerDependencies?.['react-dom']).toBeDefined();
  });
});
