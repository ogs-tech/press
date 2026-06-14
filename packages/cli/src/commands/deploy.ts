import { existsSync } from 'node:fs';
import path from 'node:path';

export interface DeployOptions {
  cwd: string;
}

export interface PrereqResult {
  ok: boolean;
  errors: string[];
}

/**
 * Checks a deploy is launchable: a production web build exists (.press/web/.next),
 * the cms host has its infra env (cms/.env), and the self-hosted deploy kit is
 * present (deploy/docker-compose.yml). Pure fs existence — unit-testable without
 * booting anything.
 */
export function validateDeployPrereqs(root: string): PrereqResult {
  const errors: string[] = [];
  if (!existsSync(path.join(root, '.press', 'web', '.next'))) {
    errors.push('no web build found — run `press build` first (.press/web/.next missing).');
  }
  if (!existsSync(path.join(root, 'cms', '.env'))) {
    errors.push('cms/.env missing — required infra/secrets are not set.');
  }
  if (!existsSync(path.join(root, 'deploy', 'docker-compose.yml'))) {
    errors.push('deploy kit missing — deploy/docker-compose.yml not found (expected from `press create`).');
  }
  return { ok: errors.length === 0, errors };
}

const GUIDE_PATH = `
press deploy — two documented paths (full guide: docs/beta/deploy.md).

  Recommended — SELF-HOSTED (Docker Compose, low/no recurring cost):
    1. cp deploy/.env.deploy.example deploy/.env.deploy   # then fill the secrets
    2. docker compose -f deploy/docker-compose.yml --env-file deploy/.env.deploy up -d --build
    3. open http://localhost:8080  (point PUBLISH_PORT/CMS_URL at your domain for prod)

  Optional — MANAGED (Strapi Cloud + Vercel, ~US$38/mo for a real site):
    Deploy cms to Strapi Cloud, then web to Vercel with CMS_URL set to the live
    cms origin. Steps + caveats in docs/beta/deploy.md.

  Deploy order is always cms first (it owns the public origin + DB), then web wired
  to the live CMS_URL.
`;

/**
 * Finalized command surface (Spec 5): validates prereqs and emits the documented
 * self-hosted + managed paths. press does not orchestrate the provider for the
 * adopter — it hands them a verified, copy-pasteable path.
 */
export async function deployCommand(opts: DeployOptions): Promise<void> {
  const r = validateDeployPrereqs(opts.cwd);
  if (!r.ok) {
    for (const e of r.errors) console.error(`deploy: ${e}`);
    throw new Error('deploy prerequisites not met');
  }
  console.log(GUIDE_PATH);
}
