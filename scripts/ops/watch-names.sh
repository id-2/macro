#!/usr/bin/env bash
# Usage:
#   scripts/ops/watch-names.sh [options]
#
# Watches the public names app, my and start over HTTPS from the studio and
# prints one line per name. Every run appends one history line to the state
# file. When any name fails three runs in a row the script sends one Telegram
# message; when all names answer again it sends one recovery message. With
# --summary it sends the daily short report instead: the three name codes, the
# six service health codes and the free disk space.
#
# Install for the studio account (both entries every five minutes and daily):
#   */5 * * * * /bin/bash $HOME/ops/watch-names.sh >/dev/null 2>&1
#   0 9 * * * /bin/bash $HOME/ops/watch-names.sh --summary >/dev/null 2>&1
#
# Parameters (flag or environment):
#   WATCH_NAMES / --names "a b c"  names to probe, default "app my start"
#   ZONE_NAME / --zone NAME        zone apex, default rox.one
#   PROBE_PATH / --path P          path probed on each name, default /
#   HEALTH_BASE / --health-base U  base for service health, default https://app.rox.one
#   HEALTH_PATHS                   space separated health paths, default the six
#                                  service paths of the stand
#   TIMEOUT / --timeout N          curl budget per probe in seconds, default 10
#   STATE_DIR / --state-dir DIR    state files, default $HOME/ops/state
#   LOG_FILE                       run log, default $HOME/ops/logs/watch-names.log
#   WATCH_ENV / --env-file FILE    env file holding TG_TOKEN and TG_CHAT,
#                                  default $HOME/ops/watchdog.env, outside the repository
#   FAILS_BEFORE_ALERT / --fails N runs in a row before one alert, default 3
#   DISK_PATH / --disk PATH        path whose free space is reported,
#                                  default /System/Volumes/Data when present, else /
#
# Options:
#   --summary      send the daily report instead of the watch pass
#   --dry-run      probe and print, send nothing, keep no state
#   --no-telegram  probe and keep state, send nothing
#   -h, --help     print this text
#
# The bot token is read from WATCH_ENV and never printed.
# Exit code: 0 when every probed name answered 2xx/3xx, 1 otherwise.
set -euo pipefail

ZONE_NAME="${ZONE_NAME:-rox.one}"
NAMES_STR="${WATCH_NAMES:-app my start}"
PROBE_PATH="${PROBE_PATH:-/}"
HEALTH_BASE="${HEALTH_BASE:-https://app.rox.one}"
HEALTH_PATHS="${HEALTH_PATHS:-/auth/health /gateway/health /contacts/health /dss/health /email/health /notification/health}"
TIMEOUT="${TIMEOUT:-10}"
STATE_DIR="${STATE_DIR:-$HOME/ops/state}"
LOG_FILE="${LOG_FILE:-$HOME/ops/logs/watch-names.log}"
WATCH_ENV="${WATCH_ENV:-$HOME/ops/watchdog.env}"
FAILS_BEFORE_ALERT="${FAILS_BEFORE_ALERT:-3}"
DISK_PATH="${DISK_PATH:-}"
MODE=watch
DRY_RUN=0
DO_SEND=1

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --names) NAMES_STR="${2:-}"; shift 2 ;;
    --zone) ZONE_NAME="${2:-}"; shift 2 ;;
    --path) PROBE_PATH="${2:-}"; shift 2 ;;
    --health-base) HEALTH_BASE="${2:-}"; shift 2 ;;
    --health-paths) HEALTH_PATHS="${2:-}"; shift 2 ;;
    --timeout) TIMEOUT="${2:-}"; shift 2 ;;
    --state-dir) STATE_DIR="${2:-}"; shift 2 ;;
    --env-file) WATCH_ENV="${2:-}"; shift 2 ;;
    --fails) FAILS_BEFORE_ALERT="${2:-}"; shift 2 ;;
    --disk) DISK_PATH="${2:-}"; shift 2 ;;
    --summary) MODE=summary; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --no-telegram) DO_SEND=0; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) die "unknown option: $1" ;;
    *) die "unexpected argument: $1" ;;
  esac
done

if [ "$DRY_RUN" = "1" ]; then
  DO_SEND=0
fi

command -v curl >/dev/null 2>&1 || die "curl is required"
case "$TIMEOUT" in ''|*[!0-9]*) die "TIMEOUT must be a number" ;; esac
case "$FAILS_BEFORE_ALERT" in ''|*[!0-9]*) die "FAILS_BEFORE_ALERT must be a number" ;; esac
HEALTH_BASE="${HEALTH_BASE%/}"

read -r -a NAMES <<<"$NAMES_STR"
[ "${#NAMES[@]}" -gt 0 ] || die "no names given"
read -r -a PATHS <<<"$HEALTH_PATHS"

if [ -z "$DISK_PATH" ]; then
  if [ -d /System/Volumes/Data ]; then
    DISK_PATH=/System/Volumes/Data
  else
    DISK_PATH=/
  fi
fi

# The token and the chat id live outside the repository. Only the two keys are
# read from the file: nothing else in it is interpreted, and nothing is echoed.
env_value() {
  local key="$1" line
  line=$(grep -m1 "^${key}=" "$WATCH_ENV" 2>/dev/null || true)
  line=${line#*=}
  line=${line#\"}; line=${line%\"}
  line=${line#\'}; line=${line%\'}
  printf '%s' "$line"
}

if [ -z "${TG_TOKEN:-}" ] || [ -z "${TG_CHAT:-}" ]; then
  if [ -f "$WATCH_ENV" ]; then
    [ -n "${TG_TOKEN:-}" ] || TG_TOKEN="$(env_value TG_TOKEN)"
    [ -n "${TG_CHAT:-}" ] || TG_CHAT="$(env_value TG_CHAT)"
  fi
fi

fqdn_of() {
  case "$1" in
    *.*) printf '%s' "$1" ;;
    *) printf '%s.%s' "$1" "$ZONE_NAME" ;;
  esac
}

name_code() {
  local fqdn code
  fqdn=$(fqdn_of "$1")
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT" \
    "https://${fqdn}${PROBE_PATH}" 2>/dev/null || true)
  printf '%s' "${code:-000}"
}

name_status() {
  case "$1" in
    2??|3??) printf 'ok' ;;
    4??) printf 'rejected' ;;
    *) printf 'failed' ;;
  esac
}

# A bare 200 is not proof: the proxy's app fallback answers 200 with an HTML or
# empty body. A service health route answers `healthy` or a JSON object.
health_code() {
  local resp code body
  resp=$(curl -sS --max-time "$TIMEOUT" -w '\n%{http_code}' "${HEALTH_BASE}$1" 2>/dev/null || true)
  code=$(printf '%s' "$resp" | tail -n1)
  body=$(printf '%s' "$resp" | sed '$d' | tr -d '\r' | sed -E 's/^[[:space:]]+//')
  case "$code" in ''|*[!0-9]*) code=000 ;; esac
  if [ "$code" = "200" ]; then
    case "$body" in
      healthy*|'{'*|'') : ;;
      *) code="200 body-mismatch" ;;
    esac
  fi
  printf '%s' "$code"
}

health_label() {
  local p="$1"
  p=${p#/}
  p=${p%/health}
  p=${p%/}
  p=${p//\//-}
  case "$p" in
    auth) printf 'auth' ;;
    connection-gateway) printf 'gateway' ;;
    '') printf 'root' ;;
    *) printf '%s' "$p" ;;
  esac
}

disk_free() {
  df -Pk "$DISK_PATH" 2>/dev/null | awk 'NR==2 { printf "%d", $4 / 1048576 }'
}

tg() {
  [ "$DO_SEND" = "1" ] || return 0
  [ -n "${TG_TOKEN:-}" ] && [ -n "${TG_CHAT:-}" ] || return 0
  local code
  code=$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' \
    "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TG_CHAT}" \
    --data-urlencode "text=$1" 2>/dev/null || true)
  case "$code" in
    200) : ;;
    *) log "telegram answered ${code:-000}" ;;
  esac
}

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG_FILE"
}

append_history() {
  local line="$1" hist="$STATE_DIR/watch-names.history"
  printf '%s\n' "$line" >>"$hist"
  if tail -n 5000 "$hist" >"$hist.tmp" 2>/dev/null; then
    mv "$hist.tmp" "$hist"
  else
    rm -f "$hist.tmp"
  fi
}

summary_text() {
  local names="" services="" name code fqdn path label free
  for name in "${NAMES[@]}"; do
    code=$(name_code "$name")
    fqdn=$(fqdn_of "$name")
    [ -n "$names" ] && names="$names, "
    names="${names}${fqdn%%."$ZONE_NAME"} ${code}"
  done
  for path in "${PATHS[@]}"; do
    code=$(health_code "$path")
    label=$(health_label "$path")
    [ -n "$services" ] && services="$services, "
    services="${services}${label} ${code}"
  done
  free=$(disk_free)
  if [ -n "$free" ]; then
    free="диск: ${free} ГБ свободно"
  else
    free="диск: н/д"
  fi
  printf 'Rox, %s (студия)\nимена: %s\nслужбы: %s\n%s\n' \
    "$(date '+%d.%m %H:%M')" "$names" "$services" "$free"
}

# Watch pass: one line per name, one history line, one alert at threshold.
watch_pass() {
  local name fqdn code status bad=0 report="" codes="" fails=0 alerted=0 stamp
  for name in "${NAMES[@]}"; do
    fqdn=$(fqdn_of "$name")
    code=$(name_code "$name")
    status=$(name_status "$code")
    printf '%s https://%s%s -> %s %s\n' "$fqdn" "$fqdn" "$PROBE_PATH" "$code" "$status"
    [ -n "$report" ] && report="$report"$'\n'
    report="${report}${fqdn} -> ${code} ${status}"
    [ -n "$codes" ] && codes="$codes, "
    codes="${codes}${fqdn} ${code}"
    case "$code" in 2??|3??) : ;; *) bad=$((bad + 1)) ;; esac
  done
  stamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  if [ "$DRY_RUN" = "1" ]; then
    if [ "$bad" -gt 0 ]; then
      printf 'dry-run: alert would follow after %s failed runs in a row, state untouched\n' "$FAILS_BEFORE_ALERT"
    fi
    return "$bad"
  fi

  mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"
  [ -f "$STATE_DIR/watch-names.fails" ] && fails=$(cat "$STATE_DIR/watch-names.fails" 2>/dev/null || echo 0)
  [ -f "$STATE_DIR/watch-names.alerted" ] && alerted=1
  case "$fails" in ''|*[!0-9]*) fails=0 ;; esac

  if [ "$bad" -gt 0 ]; then
    fails=$((fails + 1))
  else
    fails=0
  fi
  printf '%s\n' "$fails" >"$STATE_DIR/watch-names.fails"
  append_history "${stamp} mode=watch fails=${fails} bad=${bad} result=$([ "$bad" -gt 0 ] && echo fail || echo ok) names=$(printf '%s' "$report" | tr '\n' ';')"

  if [ "$bad" -gt 0 ]; then
    log "watch: ${bad} of ${#NAMES[@]} names not ok (${fails}/${FAILS_BEFORE_ALERT})"
    if [ "$fails" -ge "$FAILS_BEFORE_ALERT" ] && [ "$alerted" = "0" ]; then
      tg "🔴 Rox: имена не отвечают (${fails} проверки подряд, $(date '+%d.%m %H:%M'))
${report}"
      : >"$STATE_DIR/watch-names.alerted"
      log "alert sent after ${fails} failed runs"
    fi
  else
    log "watch: all ${#NAMES[@]} names ok"
    if [ "$alerted" = "1" ]; then
      tg "✅ Rox: все имена отвечают снова ($(date '+%d.%m %H:%M'))
${codes}"
      rm -f "$STATE_DIR/watch-names.alerted"
      log "recovery sent"
    fi
  fi
  [ "$bad" = "0" ]
}

if [ "$MODE" = "summary" ]; then
  if [ "$DRY_RUN" = "0" ]; then
    mkdir -p "$(dirname "$LOG_FILE")"
  fi
  body=$(summary_text)
  printf '%s\n' "$body"
  tg "$body"
  exit 0
fi

if [ "$DRY_RUN" = "1" ]; then
  set +e
  watch_pass
  rc=$?
  set -e
  [ "$rc" = "0" ] || exit 1
  exit 0
fi

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"
# A crashed run must not silence the watch forever: drop a lock an hour old.
if [ -d "$STATE_DIR/watch-names.lock" ] &&
   [ -n "$(find "$STATE_DIR/watch-names.lock" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then
  rmdir "$STATE_DIR/watch-names.lock" 2>/dev/null || true
fi
mkdir "$STATE_DIR/watch-names.lock" 2>/dev/null || exit 0
trap 'rmdir "$STATE_DIR/watch-names.lock" 2>/dev/null || true' EXIT

set +e
watch_pass
rc=$?
set -e
if [ "$rc" != "0" ]; then
  exit 1
fi
