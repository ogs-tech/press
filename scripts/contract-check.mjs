// scripts/contract-check.mjs
// Spec §9 contract test. Run from repo root with a clean git working tree.
// Usage: node scripts/contract-check.mjs <fromVersion> <toVersion>
//   e.g. node scripts/contract-check.mjs 0.1.0 0.2.0
import { execSync } from "node:child_process";

const [, , fromV, toV] = process.argv;
if (!fromV || !toV) {
  console.error("usage: contract-check.mjs <fromVersion> <toVersion>");
  process.exit(2);
}

const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();

// Allowed delta (spec §8.1): only the dependency version line + the lockfile.
const ALLOWED_FILES = new Set(["apps/cms/package.json", "pnpm-lock.yaml"]);

// 0. Require a clean tree so the diff is attributable to the update alone.
const pre = sh("git status --porcelain");
if (pre) {
  console.error("working tree not clean; commit/stash before running:\n" + pre);
  process.exit(1);
}

// 1. Perform the simulated production update.
console.log(`> pnpm update @press/cms (${fromV} -> ${toV}) from Verdaccio`);
sh(`pnpm --filter cms update @press/cms@${toV}`);

// 2. Snapshot what changed on disk.
const changed = sh("git status --porcelain")
  .split("\n")
  .filter(Boolean)
  .map((l) => l.slice(3));

// 3. Fail on anything outside the allowed delta.
const leaks = changed.filter((f) => !ALLOWED_FILES.has(f));
if (leaks.length) {
  console.error("CONTRACT LEAK — Project-zone files changed by the update:");
  for (const f of leaks) console.error("  - " + f);
  process.exit(1);
}

// 4. Confirm the ONLY change inside apps/cms/package.json is the version range.
const pkgDiff = sh("git diff -- apps/cms/package.json");
const meaningful = pkgDiff
  .split("\n")
  .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
const allVersionLines = meaningful.every((l) => /@press\/cms/.test(l));
if (meaningful.length > 0 && !allVersionLines) {
  console.error("CONTRACT LEAK — non-version change in apps/cms/package.json:\n" + pkgDiff);
  process.exit(1);
}

console.log(`OK: only allowed delta changed (apps/cms/package.json @press/cms + lockfile).`);

// 5. Build + boot smoke.
console.log("> build host");
sh("pnpm --filter cms build", { stdio: "inherit" });

console.log("> boot smoke");
const boot = `( pnpm --filter cms start & SP=$!; \
  for i in $(seq 1 60); do c=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health||true); \
  [ "$c" = "204" ] && { echo BOOTOK; break; }; sleep 2; done; kill $SP 2>/dev/null )`;
const out = sh(boot, { shell: "/bin/bash" });
if (!out.includes("BOOTOK")) {
  console.error("BOOT FAILED after update");
  process.exit(1);
}
console.log("OK: host builds and boots after update. CONTRACT HELD.");
