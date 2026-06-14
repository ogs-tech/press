import { cpSync, mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { newStrapiUuid, renderCmsEnv } from './secrets';

export interface ScaffoldOptions {
  /** Absolute path of the project directory to create. */
  target: string;
  /** Project name (package name + cms name prefix). */
  name: string;
  /** Registry serving @press/* (written into .npmrc). */
  registry: string;
}

const templatesDir = path.join(__dirname, '..', '..', 'templates');

/** Pinned engine + framework versions for the generated manifests. */
const VERSIONS = {
  pressCli: '^0.1.0',
  pressWeb: '^0.2.0',
  pressCms: '^0.3.2',
  next: '^15.1.0',
  // React 18: the whole press stack runs one React major. Strapi 5's admin is
  // React 18, and Next 15 supports react ^18.2.0 — pinning the web to 18 too
  // keeps a single react/react-dom instance across cms + web (no dual-major
  // hoist hazard). The host template uses no React-19-only API.
  react: '^18.3.1',
  strapi: '5.48.0',
} as const;

function rootPackageJson(name: string): string {
  return (
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        scripts: { dev: 'press dev', build: 'press build' },
        dependencies: {
          '@press/cli': VERSIONS.pressCli,
          '@press/web': VERSIONS.pressWeb,
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
          '@press/cms': VERSIONS.pressCms,
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
 * (types/generated.ts, written by `press dev`), exported as `<name>-shared/types`.
 * No runtime deps — it is pure `.d.ts`-shaped TS consumed by web + adopter blocks.
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

function npmrc(registry: string): string {
  const lines = [
    '# Strapi needs a flat, npm-like node_modules; hoisted gives that under pnpm.',
    'node-linker=hoisted',
    'auto-install-peers=true',
    'strict-peer-dependencies=false',
    `@press:registry=${registry}`,
  ];
  // Local Verdaccio proof convenience: localhost token (harmless, localhost-only).
  if (registry.includes('localhost:4873')) {
    lines.push(
      '//localhost:4873/:_authToken=ZDMyN2Y1NzBhNGU2ZDgwOTQ2YzU2ZmE1MGU3MDhlNzM6YmQyNWNkMjc2NmI1YTg1ODdjMzE4Ng==',
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Writes the ultra-thin Project zone (spec §6) into `target`: the adopter layer
 * (config + blocks/custom + content seed + a minimal cms Strapi host) plus the
 * infra files the stack needs (.npmrc, pnpm-workspace.yaml). It writes NO Next
 * host — that absence is the ultra-thin guarantee (the host is materialized to
 * .press/web/ on dev/build).
 */
export function scaffold(opts: ScaffoldOptions): void {
  const { target, name, registry } = opts;
  if (existsSync(target)) {
    throw new Error(`target already exists: ${target}`);
  }
  mkdirSync(target, { recursive: true });

  // 1. Static project-zone tree (config, blocks, content, workspace, nvmrc).
  cpSync(path.join(templatesDir, 'project'), target, { recursive: true });
  renameSync(path.join(target, 'gitignore'), path.join(target, '.gitignore'));

  // 2. Static cms host tree, then its gitkeep markers.
  cpSync(path.join(templatesDir, 'cms'), path.join(target, 'cms'), { recursive: true });
  for (const dir of ['src/api', 'src/extensions', 'public/uploads']) {
    const marker = path.join(target, 'cms', dir, 'gitkeep');
    if (existsSync(marker)) renameSync(marker, path.join(target, 'cms', dir, '.gitkeep'));
  }

  // 3. Generated manifests + infra.
  writeFileSync(path.join(target, 'package.json'), rootPackageJson(name));
  writeFileSync(path.join(target, 'cms', 'package.json'), cmsPackageJson(name));
  writeFileSync(path.join(target, 'cms', '.env'), renderCmsEnv());
  writeFileSync(path.join(target, '.npmrc'), npmrc(registry));

  // 4. The content-type contract package (shared/) + wire the adopter block to it.
  // The template ships `__SHARED_PKG__` as a placeholder so it stays generic; the
  // concrete `<name>-shared` is the project-scoped workspace package name.
  writeFileSync(path.join(target, 'shared', 'package.json'), sharedPackageJson(name));
  const calloutPath = path.join(target, 'web', 'blocks', 'custom', 'Callout.tsx');
  writeFileSync(
    calloutPath,
    readFileSync(calloutPath, 'utf8').replaceAll('__SHARED_PKG__', `${name}-shared`),
    'utf8',
  );
}
