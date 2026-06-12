// scripts/lib/sh.mjs — shared child-process helpers for the contract guard.
import { execSync } from 'node:child_process';

/** Capture trimmed stdout. execSync returns null under stdio:'inherit', so guard it. */
export const sh = (cmd, opts = {}) =>
  (execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }) ?? '').trim();

/** Run with live output (build/boot logs) — returns nothing useful. */
export const shInherit = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', ...opts });

/** Run a bash snippet (boot loops use bash-isms), capture stdout. */
export const bash = (script, opts = {}) =>
  sh(script, { shell: '/bin/bash', ...opts });
