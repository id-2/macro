#!/usr/bin/env bash
# Publishes every workspace package under the @rox-one scope.
# Requires an authenticated npm session (`npm login`) or NPM_TOKEN with publish rights.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${OUT:-./dist-npm}"
mkdir -p "$OUT"
OUT_ABS="$(cd "$OUT" && pwd)"
TMP="$(mktemp -d)"
ACTIVE_MANIFEST=""
ACTIVE_BACKUP=""
restore_active() {
  if [ -n "$ACTIVE_MANIFEST" ]; then
    cp "$ACTIVE_BACKUP" "$ACTIVE_MANIFEST"
    ACTIVE_MANIFEST=""
  fi
}
cleanup() {
  restore_active
  rm -rf "$TMP"
}
abort() {
  cleanup
  exit 130
}
trap cleanup EXIT
trap abort INT TERM

# Rewrites catalog:/workspace:* specs of one package.json to concrete versions so that the
# packed tarball installs outside this monorepo. Exit 0 = rewritten, 3 = nothing to rewrite.
cat > "$TMP/rewrite-deps.mjs" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const manifestPath = process.argv[2];
const rootDir = process.cwd();
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

const workspaceVersions = new Map();
for (const pattern of rootPkg.workspaces?.packages ?? []) {
  const glob = pattern.endsWith("package.json") ? pattern : `${pattern}/package.json`;
  for (const file of fs.globSync(glob, { cwd: rootDir })) {
    if (file.includes("node_modules")) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, file), "utf8"));
      if (pkg.name) workspaceVersions.set(pkg.name, pkg.version || "");
    } catch {
      // not a readable manifest; it cannot provide a workspace version
    }
  }
}

function catalogVersion(key, depName) {
  const catalog = rootPkg.workspaces?.catalog ?? {};
  const named = rootPkg.workspaces?.catalogs ?? {};
  const value = key === "default" ? catalog[depName] : named[key]?.[depName];
  if (!value) {
    console.error(`cannot resolve catalog:${key === "default" ? "" : key} for ${depName}`);
    process.exit(4);
  }
  return value;
}

function resolve(spec, depName) {
  if (spec.startsWith("catalog:")) return catalogVersion(spec.slice("catalog:".length) || "default", depName);
  if (spec.startsWith("workspace:")) {
    const version = workspaceVersions.get(depName) || "*";
    const range = spec.slice("workspace:".length);
    if (range === "*") return version;
    if (range === "^" || range === "~") return version === "*" ? version : range + version;
    return range;
  }
  return spec;
}

const original = fs.readFileSync(manifestPath, "utf8");
const pkg = JSON.parse(original);
const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const changes = [];
for (const field of fields) {
  for (const [depName, spec] of Object.entries(pkg[field] ?? {})) {
    if (typeof spec !== "string") continue;
    if (!spec.startsWith("catalog:") && !spec.startsWith("workspace:")) continue;
    const resolved = resolve(spec, depName);
    if (resolved === spec) continue;
    pkg[field][depName] = resolved;
    changes.push(`${depName}: ${spec} -> ${resolved}`);
  }
}
if (changes.length === 0) process.exit(3);
fs.writeFileSync(manifestPath, `${JSON.stringify(pkg, null, 2)}\n`);
for (const change of changes) console.log(change);
NODE

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
  ACTIVE_BACKUP="$TMP/$(echo "$name" | tr '/@' '__').package.json"
  cp "$pkg" "$ACTIVE_BACKUP"
  ACTIVE_MANIFEST="$(pwd)/$pkg"
  rewritten=0
  if node "$TMP/rewrite-deps.mjs" "$ACTIVE_MANIFEST"; then
    rewritten=1
  else
    rc=$?
    restore_active
    if [ "$rc" -ne 3 ]; then echo "dependency rewrite failed: $name"; continue; fi
  fi
  pack_rc=0
  (cd "$dir" && npm pack --pack-destination "$OUT_ABS" >/dev/null) || pack_rc=$?
  restore_active
  if [ "$pack_rc" -ne 0 ]; then echo "pack failed: $name"; continue; fi
  if [ "$rewritten" = "1" ]; then echo "packed $name with resolved dependency versions"; fi
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
