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
 * Checks the create->deploy vocabulary is satisfiable: a web build is present
 * (.press/web/.next) and the cms host has its infra env (cms/.env). Pure-ish
 * (fs existence only) so it is unit-testable without booting anything.
 */
export function validateDeployPrereqs(root: string): PrereqResult {
  const errors: string[] = [];
  if (!existsSync(path.join(root, '.press', 'web', '.next'))) {
    errors.push('no web build found — run `press build` first (.press/web/.next missing).');
  }
  if (!existsSync(path.join(root, 'cms', '.env'))) {
    errors.push('cms/.env missing — required infra/secrets are not set.');
  }
  return { ok: errors.length === 0, errors };
}

const SPEC5_PATH = `
press deploy (preview) — the full guide ships in Spec 5.

  Two documented targets will be supported:
    • managed     — a hosted cms + a Next host on a managed platform
    • self-hosted — your own cms + web behind a reverse proxy

  Prereqs validated here:
    • a production build is present (press build)
    • cms infra/secrets are set (cms/.env)

  Next: follow the Spec 5 deploy guide for your chosen target.
`;

/**
 * Thin, delegating command surface (spec §2.2/§5): validates prereqs and emits
 * the documented Spec 5 path. No provider orchestration in this spec — that, and
 * the guide itself, are Spec 5.
 */
export async function deployCommand(opts: DeployOptions): Promise<void> {
  const r = validateDeployPrereqs(opts.cwd);
  if (!r.ok) {
    for (const e of r.errors) console.error(`deploy: ${e}`);
    throw new Error('deploy prerequisites not met');
  }
  console.log(SPEC5_PATH);
}
