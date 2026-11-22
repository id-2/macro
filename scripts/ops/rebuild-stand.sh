#!/usr/bin/env bash
# Usage:
#   scripts/ops/rebuild-stand.sh [options]
#
# Rebuilds the stand's service binaries from this branch, recreates the compose
# services that run them, waits for six service health paths and prints each
# code plus the number of user identifiers that start with rox|.
#
# Parameters (environment or flag):
#   WORKTREE      source tree to build from, default this script's repository
#   STAND_DIR     stand checkout, default <parent of this checkout>/wt-integration
#   STAND_ENV     generated env file,
#                 default $STAND_DIR/infra/local/generated/rox/local.generated.env
#   PROJECT / --project NAME    compose project, default rox-one
#   BUNDLE_IMAGE  image built from docker/Dockerfile.dev, default rox-local-rust-services:dev
#   SERVICES / --services "a b" compose services to recreate,
#                 default "authentication-service connection_gateway contacts_service
#                 document_storage_service email_service notification_service"
#   HEALTH_BASE   base for health probes, default https://localhost:24209
#   HEALTH_PATHS  space separated paths, default the six service paths
#   CA_CERT       CA bundle for the proxy, default $STAND_DIR/infra/local/certs/ca.pem
#   WAIT_SECONDS / --wait N     health budget, default 180
#   MIN_FREE_GB   refuse to build under this free space, default 15
#   DB_CONTAINER  postgres container, default ${PROJECT}-postgres-1
#   DB_NAME       database, read from STAND_ENV DATABASE_URL when unset
#   DB_USER       database user, read from STAND_ENV DATABASE_URL when unset
#
# Options:
#   --no-build     reuse the existing bundle image, only extract and restart
#   --no-restart   build and extract, leave the containers alone
#   --no-health    skip the health probe
#   --health-only  probe health and count users, change nothing
#   --count-only   only print the user identifier count
#   --insecure     skip proxy TLS verification
#   -h, --help     print this text
#
# The script drives the Docker engine of DOCKER_HOST, so a remote engine is used
# by exporting DOCKER_HOST before running it.
# Exit code: 0 when the health codes are 200 and the count is readable, 1 otherwise.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKTREE="${WORKTREE:-$(cd "$SELF_DIR/../.." && pwd)}"
STAND_DIR="${STAND_DIR:-$(dirname "$WORKTREE")/wt-integration}"
STAND_ENV="${STAND_ENV:-$STAND_DIR/infra/local/generated/rox/local.generated.env}"
PROJECT="${PROJECT:-rox-one}"
BUNDLE_IMAGE="${BUNDLE_IMAGE:-rox-local-rust-services:dev}"
SERVICES_STR="${SERVICES:-authentication-service connection_gateway contacts_service document_storage_service email_service notification_service}"
HEALTH_BASE="${HEALTH_BASE:-https://localhost:24209}"
HEALTH_PATHS="${HEALTH_PATHS:-/auth/health /connection-gateway/health /contacts/health /dss/health /email/health /notification/health}"
CA_CERT="${CA_CERT:-$STAND_DIR/infra/local/certs/ca.pem}"
WAIT_SECONDS="${WAIT_SECONDS:-180}"
MIN_FREE_GB="${MIN_FREE_GB:-15}"
DB_CONTAINER="${DB_CONTAINER:-}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DO_BUILD=1
DO_RESTART=1
DO_HEALTH=1
HEALTH_ONLY=0
COUNT_ONLY=0
INSECURE=0
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
    --project) PROJECT="${2:-}"; shift 2 ;;
    --services) SERVICES_STR="${2:-}"; shift 2 ;;
    --wait) WAIT_SECONDS="${2:-}"; shift 2 ;;
    --no-build) DO_BUILD=0; shift ;;
    --no-restart) DO_RESTART=0; shift ;;
    --no-health) DO_HEALTH=0; shift ;;
    --health-only) HEALTH_ONLY=1; DO_HEALTH=1; shift ;;
    --count-only) COUNT_ONLY=1; shift ;;
    --insecure) INSECURE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) die "unknown option: $1" ;;
    *) die "unexpected argument: $1" ;;
  esac
done

command -v docker >/dev/null 2>&1 || die "docker is required"
[ -d "$WORKTREE" ] || die "worktree not found: $WORKTREE"
[ -d "$STAND_DIR" ] || die "stand checkout not found: $STAND_DIR"
[ -f "$STAND_ENV" ] || die "stand env not found: $STAND_ENV"
case "$WAIT_SECONDS" in
  ''|*[!0-9]*) die "WAIT_SECONDS must be a number" ;;
esac

DB_CONTAINER="${DB_CONTAINER:-${PROJECT}-postgres-1}"
read -r -a SERVICES <<<"$SERVICES_STR"
read -r -a PATHS <<<"$HEALTH_PATHS"
[ "${#SERVICES[@]}" -gt 0 ] || die "no compose services given"

env_value() {
  local key="$1" line
  line=$(grep -m1 "^${key}=" "$STAND_ENV" 2>/dev/null || true)
  line=${line#*=}
  line=${line#\"}
  line=${line%\"}
  printf '%s' "$line"
}

DATABASE_URL="$(env_value DATABASE_URL)"
if [ -n "$DATABASE_URL" ]; then
  DB_NAME="${DB_NAME:-$(printf '%s' "${DATABASE_URL%%\?*}" | sed -E 's#^[^/]*//[^/]*/##')}"
  DB_USER="${DB_USER:-$(printf '%s' "${DATABASE_URL%%\?*}" | sed -E 's#^[^/]*//([^:]*):.*#\1#')}"
fi
DB_NAME="${DB_NAME:-roxdb}"
DB_USER="${DB_USER:-user}"

count_users() {
  local counts rox other table
  table=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "select coalesce(to_regclass('public.\"User\"')::text, to_regclass('public.users')::text)" 2>/dev/null || true)
  table=$(printf '%s' "$table" | tr -d '[:space:]')
  if [ -z "$table" ]; then
    printf 'users identifier count: unavailable (no User table in %s)\n' "$DB_NAME"
    return 1
  fi
  if [ "$table" = "users" ]; then
    counts=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
      "select count(*) filter (where identifier like 'rox|%'), count(*) filter (where identifier not like 'rox|%') from users") || return 1
  else
    counts=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
      "select count(*) filter (where id like 'rox|%'), count(*) filter (where id not like 'rox|%') from \"User\"") || return 1
  fi
  rox=$(printf '%s' "$counts" | cut -d'|' -f1 | tr -d '[:space:]')
  other=$(printf '%s' "$counts" | cut -d'|' -f2 | tr -d '[:space:]')
  printf 'users rox| identifier: %s\n' "${rox:-unreadable}"
  printf 'users other prefixes: %s\n' "${other:-unreadable}"
  [ -n "$rox" ] || return 1
}

health_state() {
  local path="$1" response code body
  # A 200 alone is not proof: the proxy's app fallback answers 200 with an HTML
  # or empty body. A service health route answers `healthy` or a JSON object.
  if [ "$INSECURE" = "1" ]; then
    response=$(curl -sS -k --max-time 8 -w '\n%{http_code}' "${HEALTH_BASE}${path}" 2>/dev/null || true)
  elif [ -f "$CA_CERT" ]; then
    response=$(curl -sS --cacert "$CA_CERT" --max-time 8 -w '\n%{http_code}' "${HEALTH_BASE}${path}" 2>/dev/null || true)
  else
    response=$(curl -sS --max-time 8 -w '\n%{http_code}' "${HEALTH_BASE}${path}" 2>/dev/null || true)
  fi
  code=$(printf '%s' "$response" | tail -n1)
  body=$(printf '%s' "$response" | sed '$d' | tr -d '\r' | sed -E 's/^[[:space:]]+//')
  case "$code" in
    ''|*[!0-9]*) code="000" ;;
  esac
  case "$code" in
    200)
      case "$body" in
        healthy*) printf '200' ;;
        '{'*) printf '200' ;;
        *) printf '200 body-mismatch' ;;
      esac
      ;;
    *) printf '%s' "$code" ;;
  esac
}

probe_health() {
  local code deadline now pending failed=0
  deadline=$(( $(date +%s) + WAIT_SECONDS ))
  while :; do
    pending=0
    for path in "${PATHS[@]}"; do
      code=$(health_state "$path")
      [ "$code" = "200" ] || pending=1
    done
    [ "$pending" = "0" ] && break
    now=$(date +%s)
    [ "$now" -ge "$deadline" ] && break
    sleep 3
  done
  for path in "${PATHS[@]}"; do
    code=$(health_state "$path")
    printf 'health %s %s\n' "$path" "$code"
    [ "$code" = "200" ] || failed=1
  done
  [ "$failed" = "0" ]
}

print_source() {
  local branch commit
  if git -C "$WORKTREE" rev-parse --git-dir >/dev/null 2>&1; then
    branch=$(git -C "$WORKTREE" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
    commit=$(git -C "$WORKTREE" rev-parse --short HEAD 2>/dev/null || echo unknown)
    printf 'branch %s commit %s\n' "$branch" "$commit"
  fi
}

free_gb() {
  df -Pk "$1" 2>/dev/null | awk 'NR==2 { printf "%d", $4 / 1048576 }'
}

build_bundle() {
  local free
  free=$(free_gb "$WORKTREE")
  free="${free:-0}"
  if [ "$free" -lt "$MIN_FREE_GB" ]; then
    die "only ${free} GB free under $WORKTREE; a cold build needs about ${MIN_FREE_GB} GB"
  fi
  printf 'building %s from %s\n' "$BUNDLE_IMAGE" "$WORKTREE"
  docker build \
    --file "$WORKTREE/docker/Dockerfile.dev" \
    --target services_bundle \
    --tag "$BUNDLE_IMAGE" \
    "$WORKTREE"
}

extract_bundle() {
  local out_dir tmp_ctr
  out_dir="$STAND_DIR/target/linux-out-roxd"
  mkdir -p "$out_dir"
  printf 'extracting binaries into %s\n' "$out_dir"
  tmp_ctr="rox-rebuild-stand-$$"
  cleanup_ctr() {
    docker rm -f "$tmp_ctr" >/dev/null 2>&1 || true
  }
  trap cleanup_ctr EXIT
  docker create --name "$tmp_ctr" "$BUNDLE_IMAGE" true >/dev/null
  docker cp "$tmp_ctr:/app/out/." "$out_dir/"
  cleanup_ctr
  trap - EXIT
}

compose_cmd() {
  docker compose \
    --project-directory "$STAND_DIR" \
    -p "$PROJECT" \
    -f "$STAND_DIR/docker/docker-compose.yml" \
    -f "$STAND_DIR/docker/docker-compose-databases.yml" \
    -f "$STAND_DIR/infra/local/generated/rox/docker-compose.override.yml" \
    --env-file "$STAND_ENV" \
    "$@"
}

restart_services() {
  printf 'starting compose project %s (volumes untouched)\n' "$PROJECT"
  compose_cmd up -d
  printf 'recreating %s\n' "${SERVICES[*]}"
  compose_cmd up -d --no-deps --force-recreate "${SERVICES[@]}"
}

if [ "$COUNT_ONLY" = "1" ]; then
  count_users || FAILED=1
  [ "$FAILED" = "0" ] || exit 1
  exit 0
fi

if [ "$HEALTH_ONLY" = "0" ]; then
  print_source
  if [ "$DO_BUILD" = "1" ]; then
    build_bundle
  fi
  extract_bundle
  if [ "$DO_RESTART" = "1" ]; then
    restart_services
  fi
fi

if [ "$DO_HEALTH" = "1" ]; then
  [ "${#PATHS[@]}" -gt 0 ] || die "no health paths given"
  printf 'waiting for %s health paths at %s\n' "${#PATHS[@]}" "$HEALTH_BASE"
  probe_health || FAILED=1
fi

count_users || FAILED=1

[ "$FAILED" = "0" ] || exit 1
