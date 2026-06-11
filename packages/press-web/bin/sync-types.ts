#!/usr/bin/env tsx
/**
 * Fetches the engine's runtime schema and writes src/types/generated.ts.
 * Requires a booted CMS (Spec §10 accepted trade-off — runtime is e2e anyway;
 * the CLI in Spec 3 will wire this into `press dev` so it is invisible later).
 *
 * Output lands in the ENGINE zone (this package), gitignored — never in apps/web
 * (Spec §4.1, AC4).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateTypes, type PressSchema } from '../src/generator/generate';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:1337';

async function main() {
  const url = `${CMS_URL}/api/press/schema`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[press/web] schema fetch failed: ${res.status} ${url}`);
  const schema = (await res.json()) as PressSchema;

  const out = generateTypes(schema);
  const dir = path.join(import.meta.dirname, '..', 'src', 'types');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'generated.ts');
  writeFileSync(file, out, 'utf8');
  console.log(`[press/web] wrote ${path.relative(process.cwd(), file)} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
