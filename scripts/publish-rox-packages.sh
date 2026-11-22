#!/usr/bin/env bash
# Publishes every workspace package under the @rox-one scope.
# Requires an authenticated npm session (`npm login`) or NPM_TOKEN with publish rights.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT:-./dist-npm}"
mkdir -p "$OUT"
published=()
for pkg in packages/*/package.json apps/*/package.json; do
  [ -f "$pkg" ] || continue
  name=$(node -e "console.log(require('./$pkg').name || '')")
  case "$name" in
    @rox-one/*) ;;
    *) continue ;;
  esac
  case "$name" in
    @rox-one/docs|@rox-one/website|@rox-one/sdk-docs) echo "skip site package $name"; continue ;;
  esac
  dir=$(dirname "$pkg")
  version=$(node -e "console.log(require('./$pkg').version || '')")
  if [ -z "$version" ]; then echo "skip $name (no version)"; continue; fi
  echo "== building $name ($dir) =="
  if node -e "const s=require('./$pkg').scripts||{}; process.exit(s.build?0:1)"; then
    (cd "$dir" && bun run build) || echo "build failed (packing anyway): $name"
  fi
  echo "== packing $name =="
  (cd "$dir" && npm pack --pack-destination "$(cd - >/dev/null && pwd)/$OUT" >/dev/null) || { echo "pack failed: $name"; continue; }
  published+=("$name")
done
echo "packed: ${#published[@]} packages -> $OUT"
if [ "${PUBLISH_TO_REGISTRY:-0}" = "1" ]; then
  for tgz in "$OUT"/*.tgz; do
    echo "publishing $tgz"
    npm publish "$tgz" --access public
  done
else
  echo "Set PUBLISH_TO_REGISTRY=1 to push the tarballs to npm after login."
fi
