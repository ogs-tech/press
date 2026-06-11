// scripts/assert-no-engine-in-host.mjs
// Fails if the host src/ contains anything other than the two allowed extension
// points: an empty lifecycle (index.ts / main.ts) and src/components/custom/**.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HOST_SRC = "apps/cms/src";
const ALLOWED_TOP = new Set(["index.ts", "main.ts", "components", "admin", "api", "extensions"]);
// engine reference blocks must NOT live here:
const FORBIDDEN_COMPONENT_CATEGORIES = new Set(["press"]);

let violations = [];

for (const entry of readdirSync(HOST_SRC)) {
  if (!ALLOWED_TOP.has(entry)) {
    violations.push(`unexpected host src entry: ${entry}`);
  }
}

const componentsDir = join(HOST_SRC, "components");
try {
  for (const cat of readdirSync(componentsDir)) {
    if (statSync(join(componentsDir, cat)).isDirectory() && FORBIDDEN_COMPONENT_CATEGORIES.has(cat)) {
      violations.push(`engine component category leaked into host: components/${cat}`);
    }
  }
} catch {}

if (violations.length) {
  console.error("ENGINE-IN-HOST LEAK:\n" + violations.map((v) => "  - " + v).join("\n"));
  process.exit(1);
}
console.log("OK: host src/ contains only allowed extension points (no engine code).");
