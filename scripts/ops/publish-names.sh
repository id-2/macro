#!/usr/bin/env bash
# Usage:
#   scripts/ops/publish-names.sh [options] [TUNNEL_ID]
#
# Points the public names app, my and start at one Cloudflare tunnel and probes
# each name over HTTPS. Prints one line per name: the name, the record action,
# the HTTP code. The API token is read from the environment and never printed.
#
# Parameters (flag or environment):
#   CF_TUNNEL_ID / --tunnel ID     tunnel to attach (required)
#   CF_API_TOKEN                   Cloudflare API token with DNS edit rights (required)
#   CF_ZONE_NAME / --zone NAME     zone apex, default rox.one
#   CF_ZONE_ID                     zone id, looked up from the zone name when unset
#   CF_NAMES / --names "a b c"     names to switch, default "app my start"
#   CF_ACCOUNT_ID                  when set, the tunnel is checked before switching
#   PROBE_PATH / --probe-path P    path probed on each name, default /
#   WAIT_SECONDS / --wait N        probe budget per name, default 45
#
# Options:
#   --dry-run   print the planned record changes, call nothing
#   --no-probe  switch the records, skip the HTTPS probe
#   -h, --help  print this text
#
# Exit code: 0 when every name was switched and answered 2xx/3xx/4xx, 1 otherwise.
set -euo pipefail

CF_API_BASE="https://api.cloudflare.com/client/v4"
ZONE_NAME="${CF_ZONE_NAME:-rox.one}"
NAMES_STR="${CF_NAMES:-app my start}"
PROBE_PATH="${PROBE_PATH:-/}"
WAIT_SECONDS="${WAIT_SECONDS:-45}"
TUNNEL="${CF_TUNNEL_ID:-}"
ZONE_ID="${CF_ZONE_ID:-}"
ACCOUNT_ID="${CF_ACCOUNT_ID:-}"
DRY_RUN=0
DO_PROBE=1
FAILED=0

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --tunnel) TUNNEL="${2:-}"; shift 2 ;;
    --zone) ZONE_NAME="${2:-}"; shift 2 ;;
    --names) NAMES_STR="${2:-}"; shift 2 ;;
    --probe-path) PROBE_PATH="${2:-}"; shift 2 ;;
    --wait) WAIT_SECONDS="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-probe) DO_PROBE=0; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) die "unknown option: $1" ;;
    *)
      if [ -n "$TUNNEL" ]; then
        die "unexpected argument: $1 (pass names through CF_NAMES or --names)"
      fi
      TUNNEL="$1"
      shift
      ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq >/dev/null 2>&1 || die "jq is required"
[ -n "$TUNNEL" ] || die "no tunnel id: pass TUNNEL_ID, --tunnel or CF_TUNNEL_ID"
case "$TUNNEL" in
  *[!A-Za-z0-9_-]*) die "tunnel id has unexpected characters: $TUNNEL" ;;
esac
[ -n "$ZONE_NAME" ] || die "no zone name"
if [ "$DRY_RUN" = "0" ]; then
  [ -n "${CF_API_TOKEN:-}" ] || die "CF_API_TOKEN is not set"
fi
case "$WAIT_SECONDS" in
  ''|*[!0-9]*) die "WAIT_SECONDS must be a number" ;;
esac

# Every request goes through here so the token lives in one place and never on
# the command line of a printed command.
api() {
  curl -sS --max-time 25 \
    -H "Authorization: Bearer ${CF_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "$@"
}

read -r -a NAMES <<<"$NAMES_STR"
[ "${#NAMES[@]}" -gt 0 ] || die "no names given"

TARGET="${TUNNEL}.cfargotunnel.com"

if [ -z "$ZONE_ID" ] && [ "$DRY_RUN" = "1" ]; then
  ZONE_ID="dry-run"
elif [ -z "$ZONE_ID" ]; then
  zone_resp=$(api "${CF_API_BASE}/zones?name=${ZONE_NAME}&per_page=1") ||
    die "zone lookup failed"
  if [ "$(printf '%s' "$zone_resp" | jq -r '.success // false')" != "true" ]; then
    printf '%s\n' "$zone_resp" | jq -r '.errors[]?.message' >&2
    die "Cloudflare rejected the zone lookup"
  fi
  ZONE_ID=$(printf '%s' "$zone_resp" | jq -r '.result[0].id // empty')
  [ -n "$ZONE_ID" ] || die "zone not found in this account: $ZONE_NAME"
fi

printf 'zone %s (%s) tunnel %s\n' "$ZONE_NAME" "$ZONE_ID" "$TUNNEL"

if [ -n "$ACCOUNT_ID" ] && [ "$DRY_RUN" = "0" ]; then
  tunnel_resp=$(api "${CF_API_BASE}/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL}") || true
  tunnel_name=$(printf '%s' "$tunnel_resp" | jq -r '.result.name // empty' 2>/dev/null || true)
  tunnel_status=$(printf '%s' "$tunnel_resp" | jq -r '.result.status // empty' 2>/dev/null || true)
  if [ -n "$tunnel_name" ]; then
    printf 'tunnel %s name %s status %s\n' "$TUNNEL" "$tunnel_name" "${tunnel_status:-unknown}"
  else
    printf 'tunnel %s not visible to this token; continuing\n' "$TUNNEL" >&2
  fi
fi

record_body() {
  jq -nc --arg name "$1" --arg content "$TARGET" \
    '{type: "CNAME", name: $name, content: $content, proxied: true, ttl: 1,
      comment: "scripts/ops/publish-names.sh"}'
}

switch_name() {
  local name="$1" fqdn existing id action body resp ok
  case "$name" in
    *.*) fqdn="$name" ;;
    *) fqdn="${name}.${ZONE_NAME}" ;;
  esac

  body=$(record_body "$fqdn")

  if [ "$DRY_RUN" = "1" ]; then
    printf '%s pending %s %s\n' "$fqdn" "CNAME" "$TARGET"
    return 0
  fi

  existing=$(api "${CF_API_BASE}/zones/${ZONE_ID}/dns_records?name=${fqdn}&per_page=100") ||
    { printf '%s failed lookup\n' "$fqdn"; return 1; }
  if [ "$(printf '%s' "$existing" | jq -r '.success // false')" != "true" ]; then
    printf '%s failed lookup: %s\n' "$fqdn" "$(printf '%s' "$existing" | jq -r '.errors[]?.message' | tr '\n' ';')"
    return 1
  fi

  # Prefer an existing CNAME, otherwise replace whatever record holds the name so
  # the name never keeps an old address beside the new tunnel.
  id=$(printf '%s' "$existing" | jq -r '
    (.result | map(select(.type == "CNAME")) | .[0].id)
    // (.result | .[0].id) // empty')
  if [ -n "$id" ]; then
    action="updated"
    resp=$(api -X PUT "${CF_API_BASE}/zones/${ZONE_ID}/dns_records/${id}" \
      --data "$body") || { printf '%s failed update\n' "$fqdn"; return 1; }
  else
    action="created"
    resp=$(api -X POST "${CF_API_BASE}/zones/${ZONE_ID}/dns_records" \
      --data "$body") || { printf '%s failed create\n' "$fqdn"; return 1; }
  fi

  ok=$(printf '%s' "$resp" | jq -r '.success // false')
  if [ "$ok" != "true" ]; then
    printf '%s failed %s: %s\n' "$fqdn" "$action" \
      "$(printf '%s' "$resp" | jq -r '.errors[]?.message' | tr '\n' ';')"
    return 1
  fi
  printf '%s %s %s %s\n' "$fqdn" "CNAME" "$TARGET" "$action"
}

probe_name() {
  local name="$1" fqdn code deadline now
  case "$name" in
    *.*) fqdn="$name" ;;
    *) fqdn="${name}.${ZONE_NAME}" ;;
  esac
  deadline=$(( $(date +%s) + WAIT_SECONDS ))
  while :; do
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
      "https://${fqdn}${PROBE_PATH}" 2>/dev/null || true)
    code="${code:-000}"
    case "$code" in
      2??|3??|4??) break ;;
    esac
    now=$(date +%s)
    [ "$now" -ge "$deadline" ] && break
    sleep 3
  done
  printf '%s https://%s%s -> %s' "$fqdn" "$fqdn" "$PROBE_PATH" "$code"
  case "$code" in
    2??|3??) printf ' ok\n'; return 0 ;;
    4??) printf ' reachable\n'; return 0 ;;
    *) printf ' not ready\n'; return 1 ;;
  esac
}

for name in "${NAMES[@]}"; do
  switch_name "$name" || FAILED=1
done

if [ "$DO_PROBE" = "1" ] && [ "$DRY_RUN" = "0" ]; then
  for name in "${NAMES[@]}"; do
    probe_name "$name" || FAILED=1
  done
fi

[ "$FAILED" = "0" ] || exit 1
