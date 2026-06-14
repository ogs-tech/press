#!/usr/bin/env tsx
/**
 * Fetches the engine's runtime schema and writes the project's concrete content
 * types (the `custom.*` blocks + the discriminated PageBody union) to
 * `generated.ts`. Requires a booted CMS (Spec §10 accepted trade-off).
 *
 * Output lands in the ADOPTER's `shared/types/` zone — `press dev` sets
 * PRESS_TYPES_DIR=<root>/shared/types. The engine itself never consumes this file;
 * the project does. Falls back to this package's src/types only for ad-hoc
 * generator runs.
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
  const dir = process.env.PRESS_TYPES_DIR ?? path.join(import.meta.dirname, '..', 'src', 'types');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'generated.ts');
  writeFileSync(file, out, 'utf8');
  console.log(`[press/web] wrote ${path.relative(process.cwd(), file)} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
