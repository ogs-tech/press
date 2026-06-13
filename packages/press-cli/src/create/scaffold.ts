import { cpSync, mkdirSync, renameSync, writeFileSync, existsSync } from 'node:fs';
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
  react: '^19',
  strapi: '5.48.0',
} as const;

function rootPackageJson(name: string): string {
  return (
    JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        scripts: { dev: 'press dev', build: 'press build', deploy: 'press deploy' },
        dependencies: {
          '@press/cli': VERSIONS.pressCli,
          '@press/web': VERSIONS.pressWeb,
          next: VERSIONS.next,
          react: VERSIONS.react,
          'react-dom': VERSIONS.react,
        },
        devDependencies: {
          '@types/node': '^20',
          '@types/react': '^19',
          '@types/react-dom': '^19',
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
          // Postgres driver for the production/self-hosted deploy (Spec 5). Strapi
          // does not bundle DB drivers; knex needs `pg` present whenever
          // DATABASE_CLIENT=postgres. sqlite dev keeps using better-sqlite3.
          pg: '8.13.1',
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

  // 3. Self-hosted deploy kit (Spec 5). The kit itself (deploy/* and
  // cms/.env.production.example) lands via the wholesale template copies above;
  // only the .dockerignore needs renaming — it ships as `.dockerignore.template`
  // so it stays inert inside the CLI package, and becomes the project-root
  // .dockerignore here.
  renameSync(
    path.join(target, 'deploy', '.dockerignore.template'),
    path.join(target, '.dockerignore'),
  );

  // 4. Generated manifests + infra.
  writeFileSync(path.join(target, 'package.json'), rootPackageJson(name));
  writeFileSync(path.join(target, 'cms', 'package.json'), cmsPackageJson(name));
  writeFileSync(path.join(target, 'cms', '.env'), renderCmsEnv());
  writeFileSync(path.join(target, '.npmrc'), npmrc(registry));
}
