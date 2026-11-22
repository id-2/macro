#!/usr/bin/env bash
# Fails when the old product name survives in code, SQL or file names.
# Rust macro keywords are not violations.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

fail=0

scan_content() {
  local hits
  hits=$(grep -rn 'macro_\|Macro[A-Z]' \
    --include='*.rs' --include='*.sql' --include='*.ts' --include='*.tsx' \
    --include='*.toml' --include='*.yml' --include='*.yaml' --include='*.sh' \
    . 2>/dev/null \
    | grep -vE 'node_modules|/target/|/dist/|/vendor/|\.git/|scripts/check-old-brand.sh' \
    | grep -vE 'macro_rules|macro_use|macro_export|parse_macro_input|proc_macro|macro_' \
    | head -0)
  # second pass keeps only genuine leftovers: macro_ not followed by a rust keyword context
  hits=$(grep -rn 'macro_' \
    --include='*.rs' --include='*.sql' --include='*.ts' --include='*.tsx' \
    --include='*.toml' --include='*.yml' --include='*.yaml' --include='*.sh' \
    . 2>/dev/null \
    | grep -vE 'node_modules|/target/|/dist/|/vendor/|\.git/|scripts/check-old-brand.sh' \
    | grep -vE 'macro_rules|macro_use|macro_export|parse_macro_input|proc_macro' \
    | head -20)
  local camel
  camel=$(grep -rn 'Macro[A-Z]' \
    --include='*.rs' --include='*.ts' --include='*.tsx' \
    . 2>/dev/null \
    | grep -vE 'node_modules|/target/|/dist/|/vendor/|\.git/|scripts/check-old-brand.sh' \
    | head -20)
  if [ -n "$hits" ]; then
    echo "Old name in code or SQL:"
    printf '%s\n' "$hits"
    fail=1
  fi
  if [ -n "$camel" ]; then
    echo "Old name in identifiers:"
    printf '%s\n' "$camel"
    fail=1
  fi
}

scan_names() {
  local names
  names=$(find crates services apps/web/src packages -type f \( -name 'macro_*' -o -name '*_macro_*' \) 2>/dev/null | grep -v '/migrations/' | head -20)
  if [ -n "$names" ]; then
    echo "Old name in file names:"
    printf '%s\n' "$names"
    fail=1
  fi
}

scan_content
scan_names

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "ok: no old product name in code, SQL or file names"
