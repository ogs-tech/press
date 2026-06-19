/**
 * Build-time codegen: regenerates src/create/versions.generated.ts from the
 * engine packages' manifests so the scaffold's pins can never drift from the
 * versions the monorepo actually ships. Runs as part of `pnpm build`; a drift
 * test (compute-versions.test.ts) and the `--check` mode below guard staleness.
 *
 *   pnpm --filter @ogs-tech/create-press gen:versions          # rewrite the committed file
 *   pnpm --filter @ogs-tech/create-press gen:versions --check   # exit 1 if the file is stale (CI)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  computeVersions,
  renderVersionsModule,
  type EngineManifests,
  type Manifest,
} from '../src/create/compute-versions';

const packagesDir = path.resolve(__dirname, '..', '..'); // packages/
const readManifest = (pkg: string): Manifest =>
  JSON.parse(readFileSync(path.join(packagesDir, pkg, 'package.json'), 'utf8'));

const manifests: EngineManifests = {
  cli: readManifest('cli'),
  web: readManifest('web'),
  cms: readManifest('cms'),
};

const rendered = renderVersionsModule(computeVersions(manifests));
const outPath = path.resolve(__dirname, '..', 'src', 'create', 'versions.generated.ts');

if (process.argv.includes('--check')) {
  const current = readFileSync(outPath, 'utf8');
  if (current !== rendered) {
    console.error('versions.generated.ts is stale — run: pnpm --filter @ogs-tech/create-press gen:versions');
    process.exit(1);
  }
  console.log('versions.generated.ts is up to date.');
} else {
  writeFileSync(outPath, rendered);
  console.log('wrote', path.relative(packagesDir, outPath));
}
