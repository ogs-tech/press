#!/usr/bin/env bash
# scripts/publish-local.sh — build the @press/* engine and publish a fresh dev
# version of all three packages to the local Verdaccio registry (:4873).
#
# Each package is stamped <base>-dev.<timestamp> from its current version, built,
# published, then its package.json is restored — so a publish never leaves a
# version bump in the working tree (the "don't suja o package.json" contract).
# Afterwards run `pnpm press:upgrade` in a consumer project (e.g. ../my-site) to
# pull the freshly published code.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="http://localhost:4873"
PACKAGES=(press-cli press-cms press-web)   # dirs under packages/
TS="$(date +%Y%m%d%H%M%S)"

cd "$ROOT"

# Restore every manifest from a byte-for-byte backup. Runs on EXIT (incl. failure
# or Ctrl-C) so a half-finished publish can never leave a dev bump behind.
TMP="$(mktemp -d)"
restore() {
  for dir in "${PACKAGES[@]}"; do
    [ -f "$TMP/$dir.json" ] && cp "$TMP/$dir.json" "packages/$dir/package.json"
  done
  rm -rf "$TMP"
}
trap restore EXIT

# 1. Ensure the local registry is up (idempotent helper).
echo "==> ensuring Verdaccio is running"
bash "$ROOT/scripts/registry.sh" start

# 2. Build the whole engine once — turbo resolves the three packages + ordering.
echo "==> building engine (turbo run build)"
pnpm build

# 3. Stamp a dev version, publish, per package.
published=()
for dir in "${PACKAGES[@]}"; do
  pkg_json="packages/$dir/package.json"
  cp "$pkg_json" "$TMP/$dir.json"                       # backup for restore()
  name="$(node -p "require('./$pkg_json').name")"
  base="$(node -p "require('./$pkg_json').version")"
  dev="${base}-dev.${TS}"

  echo "==> $name@$dev"
  node -e "const f='$pkg_json',p=require('./'+f);p.version='$dev';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
  ( cd "packages/$dir" && npm publish --registry "$REGISTRY" --userconfig "$ROOT/.npmrc" )
  published+=("$name@$dev")
done

echo ""
echo "==> published to $REGISTRY:"
for p in "${published[@]}"; do echo "    $p"; done
echo ""
echo "Next: in a consumer project run  pnpm press:upgrade"
