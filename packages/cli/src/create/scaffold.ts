import { cpSync, mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { newStrapiUuid, renderCmsEnv } from './secrets';
// Pinned engine + framework versions, DERIVED from the engine manifests by
// scripts/gen-versions.ts (never hand-edited). See compute-versions.ts for the
// derivation policy — this is what keeps the scaffold's pins from drifting away
// from the versions the monorepo actually ships.
import { VERSIONS } from './versions.generated';

export interface ScaffoldOptions {
  /** Absolute path of the project directory to create. */
  target: string;
  /** Project name (package name + cms name prefix). */
  name: string;
}

const templatesDir = path.join(__dirname, '..', '..', 'templates');

function rootPackageJson(name: string): string {
  return (
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        scripts: { dev: 'press dev', build: 'press build', upgrade: 'press upgrade' },
        dependencies: {
          '@ogs-tech/press-web': VERSIONS.pressWeb,
          // The content-type contract (shared/) — a workspace member so the
          // materialized host + adopter blocks resolve `<name>-shared/types`.
          [`${name}-shared`]: 'workspace:*',
          next: VERSIONS.next,
          react: VERSIONS.react,
          'react-dom': VERSIONS.react,
        },
        devDependencies: {
          '@types/node': '^20',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          typescript: '^5',
        },
        // Standalone projects are their own workspace root, so this field takes
        // effect here (it lets Strapi's native deps build). When the scaffold is
        // consumed as a workspace member (the in-repo dogfood), pnpm ignores it and
        // the root owns it instead — play:create strips this copy to kill the warn.
        pnpm: {
          onlyBuiltDependencies: [
            '@swc/core',
            'better-sqlite3',
            'core-js-pure',
            'esbuild',
            'sharp',
          ],
        },
      },
      null,
      2,
    ) + '\n'
  );
}

function cmsPackageJson(name: string): string {
  return (
    JSON.stringify(
      {
        name: `${name}-cms`,
        version: '0.1.0',
        private: true,
        description: 'press cms host (Strapi)',
        scripts: {
          build: 'strapi build',
          develop: 'strapi develop',
          start: 'strapi start',
          strapi: 'strapi',
        },
        dependencies: {
          '@ogs-tech/press-cms': VERSIONS.pressCms,
          '@strapi/plugin-cloud': VERSIONS.strapi,
          '@strapi/plugin-users-permissions': VERSIONS.strapi,
          '@strapi/strapi': VERSIONS.strapi,
          'better-sqlite3': '12.8.0',
          react: '^18.0.0',
          'react-dom': '^18.0.0',
          'react-router-dom': '^6.0.0',
          'styled-components': '^6.0.0',
        },
        devDependencies: {
          '@types/node': '^20',
          '@types/react': '^18',
          '@types/react-dom': '^18',
          typescript: '^5',
        },
        engines: { node: '>=20.0.0 <=24.x.x', npm: '>=6.0.0' },
        strapi: { uuid: newStrapiUuid() },
      },
      null,
      2,
    ) + '\n'
  );
}

/**
 * The content-type contract package (shared/). Holds ONLY generated types
 * (types/generated.ts — a committed baseline, refreshed from the live CMS by
 * `press dev`), exported as `<name>-shared/types`. No runtime deps — it is pure
 * `.d.ts`-shaped TS consumed by web + adopter blocks.
 */
function sharedPackageJson(name: string): string {
  return (
    JSON.stringify(
      {
        name: `${name}-shared`,
        version: '0.1.0',
        private: true,
        type: 'module',
        description: 'press content-type contract (cms schema → web types)',
        exports: {
          './package.json': './package.json',
          './types': { types: './types/index.ts', default: './types/index.ts' },
        },
      },
      null,
      2,
    ) + '\n'
  );
}

function npmrc(): string {
  // @ogs-tech/press-* resolve from the default registry (npm). Only the Strapi-shaped
  // pnpm settings are pinned here.
  const lines = [
    '# Strapi needs a flat, npm-like node_modules; hoisted gives that under pnpm.',
    'node-linker=hoisted',
    'auto-install-peers=true',
    'strict-peer-dependencies=false',
  ];
  return lines.join('\n') + '\n';
}

/**
 * Writes the ultra-thin Project zone (spec §6) into `target`: the adopter layer
 * (packages/web config + blocks/custom + a minimal packages/cms Strapi host, incl.
 * its sample-content seed) plus the infra files the stack needs (.npmrc,
 * pnpm-workspace.yaml). It writes NO Next host — that absence is the ultra-thin
 * guarantee (the host is materialized to .press/web/ on dev/build).
 */
export function scaffold(opts: ScaffoldOptions): void {
  const { target, name } = opts;
  if (existsSync(target)) {
    throw new Error(`target already exists: ${target}`);
  }
  mkdirSync(target, { recursive: true });

  // 1. Static project-zone tree (packages/web, packages/shared, workspace, nvmrc).
  cpSync(path.join(templatesDir, 'project'), target, { recursive: true });
  renameSync(path.join(target, 'gitignore'), path.join(target, '.gitignore'));

  // 2. Static cms host tree (incl. scripts/seed.mjs) under packages/, then gitkeeps.
  cpSync(path.join(templatesDir, 'cms'), path.join(target, 'packages', 'cms'), { recursive: true });
  for (const dir of ['src/api', 'src/extensions', 'public/uploads']) {
    const marker = path.join(target, 'packages', 'cms', dir, 'gitkeep');
    if (existsSync(marker)) renameSync(marker, path.join(target, 'packages', 'cms', dir, '.gitkeep'));
  }

  // 3. Generated manifests + infra.
  writeFileSync(path.join(target, 'package.json'), rootPackageJson(name));
  writeFileSync(path.join(target, 'packages', 'cms', 'package.json'), cmsPackageJson(name));
  writeFileSync(path.join(target, 'packages', 'cms', '.env'), renderCmsEnv());
  writeFileSync(path.join(target, '.npmrc'), npmrc());

  // 4. The content-type contract package (packages/shared) + wire the adopter block to it.
  // The template ships `__SHARED_PKG__` as a placeholder so it stays generic; the
  // concrete `<name>-shared` is the project-scoped workspace package name.
  writeFileSync(path.join(target, 'packages', 'shared', 'package.json'), sharedPackageJson(name));
  const calloutPath = path.join(target, 'packages', 'web', 'blocks', 'custom', 'Callout.tsx');
  writeFileSync(
    calloutPath,
    readFileSync(calloutPath, 'utf8').replaceAll('__SHARED_PKG__', `${name}-shared`),
    'utf8',
  );
}
