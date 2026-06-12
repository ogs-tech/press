import { randomBytes, randomUUID } from 'node:crypto';

const b64 = () => randomBytes(16).toString('base64');

/**
 * Renders a fresh cms/.env. Each project gets its own Strapi secrets (never
 * shared) — APP_KEYS is a CSV of two keys, the rest are single base64 secrets.
 * Mirrors the apps/cms/.env shape with sqlite for dev (spec §7 infra/secrets).
 */
export function renderCmsEnv(): string {
  return [
    'HOST=0.0.0.0',
    'PORT=1337',
    `APP_KEYS=${b64()},${b64()}`,
    `API_TOKEN_SALT=${b64()}`,
    `ADMIN_JWT_SECRET=${b64()}`,
    `TRANSFER_TOKEN_SALT=${b64()}`,
    `JWT_SECRET=${b64()}`,
    `ENCRYPTION_KEY=${b64()}`,
    'DATABASE_CLIENT=sqlite',
    'DATABASE_FILENAME=.tmp/data.db',
    '',
  ].join('\n');
}

export function newStrapiUuid(): string {
  return randomUUID();
}
