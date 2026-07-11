#!/usr/bin/env tsx
import { run } from '../src/runtime-cli';
import { SubprocessError } from '../src/util/run';

run(process.argv).catch((err) => {
  console.error(err?.message ?? err);
  // Surface the failing subprocess's REAL exit code (never a blanket 1) so build
  // failures are truthful in CI; a signal-killed child (code null) still exits non-zero.
  process.exit(err instanceof SubprocessError ? (err.code ?? 1) : 1);
});
