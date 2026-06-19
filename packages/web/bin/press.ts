#!/usr/bin/env tsx
import { run } from '../src/runtime-cli';

run(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
