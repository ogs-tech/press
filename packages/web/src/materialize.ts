import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Regenerates `<projectRoot>/.press/web/` from this package's host template
 * (spec §4). The host lives INSIDE the project tree so Node resolution reaches
 * the root node_modules (@ogs-tech/press-web, next, react) and the adopter's
 * blocks/custom/. Engine-owned and rewritten every run, like `.next/` — never
 * hand-edited.
 */
export function materialize(projectRoot: string): void {
  const templateDir = path.join(import.meta.dirname, '..', 'templates', 'host');
  const dest = path.join(projectRoot, '.press', 'web');
  rmSync(dest, { recursive: true, force: true });
  cpSync(templateDir, dest, { recursive: true });
}
