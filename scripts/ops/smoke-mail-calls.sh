#!/usr/bin/env bash
# Usage:
#   scripts/ops/smoke-mail-calls.sh [options]
#
# Runs one end-to-end pass over the stand and prints a four-line verdict:
#   1. sign in by a one-time code read from Mailpit
#   2. create a call and join it
#   3. post one transcript segment with the internal header
#   4. send one probe email and find it in Mailpit
#
# Parameters (flag or environment):
#   SMOKE_EMAIL / --email ADDR      account to sign in with (required)
#   BASE_URL / --base URL           proxy base, default https://localhost:24209
#   MAILPIT_URL / --mailpit URL     Mailpit API, default http://localhost:24208
#   CA_CERT / --ca FILE             CA bundle, default <stand>/infra/local/certs/ca.pem
#   INTERNAL_CALL_SECRET            shared secret for x-rox-internal-call; read from
#                                   STAND_ENV when unset
#   STAND_ENV / --env-file FILE     env file holding INTERNAL_CALL_SECRET,
#                                   default <parent of this checkout>/wt-integration/
#                                   infra/local/generated/rox/local.generated.env
#   PROBE_EMAIL / --probe-email ADDR recipient of the probe mail, default SMOKE_EMAIL
#                                   (an existing account: a new address needs a handle)
#   WAIT_SECONDS / --timeout N      mail wait budget per message, default 60
#
# Options:
#   --insecure  skip proxy TLS verification
#   -h, --help  print this text
#
# The stand must be built from this branch: the transcript step sends the
# x-rox-internal-call header, which binaries from before the rename do not read.
# No token, secret or one-time code is ever printed.
# Exit code: 0 when all four lines pass, 1 otherwise.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${BASE_URL:-https://localhost:24209}"
MAILPIT_URL="${MAILPIT_URL:-http://localhost:24208}"
STAND_DIR="${STAND_DIR:-$(dirname "$(cd "$SELF_DIR/../.." && pwd)")/wt-integration}"
CA_CERT="${CA_CERT:-$STAND_DIR/infra/local/certs/ca.pem}"
STAND_ENV="${STAND_ENV:-$STAND_DIR/infra/local/generated/rox/local.generated.env}"
EMAIL="${SMOKE_EMAIL:-}"
PROBE_EMAIL="${PROBE_EMAIL:-}"
WAIT_SECONDS="${WAIT_SECONDS:-60}"
INSECURE=0

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:-}"; shift 2 ;;
    --base) BASE_URL="${2:-}"; shift 2 ;;
    --mailpit) MAILPIT_URL="${2:-}"; shift 2 ;;
    --ca) CA_CERT="${2:-}"; shift 2 ;;
    --env-file) STAND_ENV="${2:-}"; shift 2 ;;
    --probe-email) PROBE_EMAIL="${2:-}"; shift 2 ;;
    --timeout) WAIT_SECONDS="${2:-}"; shift 2 ;;
    --insecure) INSECURE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) die "unknown option: $1" ;;
    *) die "unexpected argument: $1" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v jq >/dev/null 2>&1 || die "jq is required"
[ -n "$EMAIL" ] || die "no account: pass --email or SMOKE_EMAIL"
PROBE_EMAIL="${PROBE_EMAIL:-$EMAIL}"
BASE_URL="${BASE_URL%/}"
MAILPIT_URL="${MAILPIT_URL%/}"
case "$WAIT_SECONDS" in
  ''|*[!0-9]*) die "WAIT_SECONDS must be a number" ;;
esac

if [ -z "${INTERNAL_CALL_SECRET:-}" ] && [ -f "$STAND_ENV" ]; then
  INTERNAL_CALL_SECRET=$(grep -m1 '^INTERNAL_CALL_SECRET=' "$STAND_ENV" 2>/dev/null | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true)
fi
[ -n "${INTERNAL_CALL_SECRET:-}" ] || die "no internal call secret: set INTERNAL_CALL_SECRET or point STAND_ENV at the stand env file"

curl_tls() {
  if [ "$INSECURE" = "1" ]; then
    curl -sS -k --max-time 25 "$@"
  elif [ -f "$CA_CERT" ]; then
    curl -sS --cacert "$CA_CERT" --max-time 25 "$@"
  else
    printf 'warning: CA bundle %s not found; relying on the system trust store\n' "$CA_CERT" >&2
    curl -sS --max-time 25 "$@"
  fi
}

mail_ids() {
  curl -sS --max-time 10 -G \
    --data-urlencode "query=to:$1" \
    --data-urlencode "limit=100" \
    "${MAILPIT_URL}/api/v1/search" 2>/dev/null |
    jq -r '.messages[]?.ID' 2>/dev/null || true
}

wait_new_mail() {
  local addr="$1" baseline="$2" deadline now ids id seen known
  deadline=$(( $(date +%s) + WAIT_SECONDS ))
  while :; do
    ids=$(mail_ids "$addr")
    for id in $ids; do
      seen=0
      for known in $baseline; do
        if [ "$known" = "$id" ]; then
          seen=1
          break
        fi
      done
      if [ "$seen" = "0" ]; then
        printf '%s' "$id"
        return 0
      fi
    done
    now=$(date +%s)
    [ "$now" -ge "$deadline" ] && return 1
    sleep 2
  done
}

code_from_message() {
  local body code
  body=$(curl -sS --max-time 10 "${MAILPIT_URL}/api/v1/message/$1" 2>/dev/null || true)
  code=$(printf '%s' "$body" | jq -r '.Text // ""' 2>/dev/null | grep -oE '[0-9]{6}' | head -1 || true)
  if [ -z "$code" ]; then
    code=$(printf '%s' "$body" | jq -r '.HTML // ""' 2>/dev/null |
      sed -E 's/<[^>]+>/ /g' | grep -oE '[0-9]{6}' | head -1 || true)
  fi
  printf '%s' "$code"
}

request_code() {
  local addr="$1" payload
  payload=$(jq -nc --arg e "$addr" --arg r "${BASE_URL}/app/" \
    '{email: $e, redirect_uri: $r}')
  curl_tls -o /dev/null -w '%{http_code}' -X POST \
    "${BASE_URL}/auth/login/passwordless" \
    -H 'Content-Type: application/json' \
    --data "$payload" 2>/dev/null || true
}

code_hint() {
  case "$1" in
    429) printf 'rate limited, wait a minute and retry' ;;
    400) printf 'rejected: invalid address, or a new address that needs a handle' ;;
    422) printf 'request rejected, check the address and redirect_uri' ;;
    403) printf 'address is not allowed to sign up on this stand' ;;
    000) printf 'no answer from %s' "$BASE_URL" ;;
    *) printf 'unexpected answer from the auth service' ;;
  esac
}

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOGIN_OK=0
CALL_OK=0
TRANSCRIPT_OK=0
PROBE_OK=0
LOGIN_NOTE=""
CALL_NOTE=""
TRANSCRIPT_NOTE=""
PROBE_NOTE=""

# 1. Code from Mailpit, exchanged for a session token.
baseline=$(mail_ids "$EMAIL")
login_start=$(date +%s)
login_http=$(request_code "$EMAIL")
if [ "$login_http" != "200" ]; then
  LOGIN_NOTE="code request answered ${login_http}: $(code_hint "$login_http")"
else
  mail_id=$(wait_new_mail "$EMAIL" "$baseline" || true)
  if [ -z "$mail_id" ]; then
    LOGIN_NOTE="no login mail in Mailpit within ${WAIT_SECONDS}s (check SMTP_HOST points at the mail sink)"
  else
    code=$(code_from_message "$mail_id")
    if [ -z "$code" ]; then
      LOGIN_NOTE="mail ${mail_id} carries no six-digit code"
    else
      exchange=$(curl_tls -G \
        --data-urlencode "email=${EMAIL}" \
        --data-urlencode "disable_redirect=true" \
        "${BASE_URL}/auth/oauth/passwordless/${code}" 2>/dev/null || true)
      ACCESS_TOKEN=$(printf '%s' "$exchange" | jq -r '.access_token // empty' 2>/dev/null || true)
      if [ -z "$ACCESS_TOKEN" ]; then
        LOGIN_NOTE="code exchange returned no access token"
      else
        LOGIN_OK=1
        LOGIN_NOTE="code from Mailpit in $(( $(date +%s) - login_start ))s"
      fi
    fi
  fi
fi

CALL_ID=""
MEETING_ID=""
if [ "$LOGIN_OK" = "1" ]; then
  meeting=$(curl_tls -X POST "${BASE_URL}/call/meetings" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg t "Rox smoke ${STAMP}" '{title: $t}')" 2>/dev/null || true)
  MEETING_ID=$(printf '%s' "$meeting" | jq -r '.id // empty' 2>/dev/null || true)
  share=$(printf '%s' "$meeting" | jq -r '.shareToken // empty' 2>/dev/null || true)
  if [ -z "$share" ]; then
    CALL_NOTE="meeting create returned no share token"
  else
    joined=$(curl_tls -X POST "${BASE_URL}/call/meetings/join/${share}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H 'Content-Type: application/json' \
      --data '{}' 2>/dev/null || true)
    CALL_ID=$(printf '%s' "$joined" | jq -r '.callId // .call_id // empty' 2>/dev/null || true)
    started=$(printf '%s' "$joined" | jq -r '.started // false' 2>/dev/null || true)
    if [ -z "$CALL_ID" ]; then
      CALL_NOTE="meeting join returned no call id"
    else
      CALL_OK=1
      CALL_NOTE="call ${CALL_ID}, started=${started}"
    fi
  fi
fi

if [ "$CALL_OK" = "1" ]; then
  segment="smoke-${STAMP}-$$"
  started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  segment_body=$(jq -nc \
    --arg segment "$segment" \
    --arg speaker "rox|${EMAIL}" \
    --arg content "smoke transcript segment" \
    --arg at "$started_at" \
    '{segmentId: $segment, speakerId: $speaker, content: $content,
      startedAt: $at, isFinal: true}')
  transcript_http=$(curl_tls -o /dev/null -w '%{http_code}' -X POST \
    "${BASE_URL}/call/${CALL_ID}/transcript" \
    -H "x-rox-internal-call: ${INTERNAL_CALL_SECRET}" \
    -H 'Content-Type: application/json' \
    --data "$segment_body" 2>/dev/null || true)
  if [ "$transcript_http" = "200" ]; then
    TRANSCRIPT_OK=1
    TRANSCRIPT_NOTE="segment ${segment} accepted (200)"
  else
    case "$transcript_http" in
      401) TRANSCRIPT_NOTE="401: internal secret rejected" ;;
      400) TRANSCRIPT_NOTE="400: header or body rejected; the stand must be built from this branch" ;;
      404) TRANSCRIPT_NOTE="404: no active call ${CALL_ID} (rebuild with a fresh binary)" ;;
      000) TRANSCRIPT_NOTE="no answer from ${BASE_URL}" ;;
      *) TRANSCRIPT_NOTE="POST /call/${CALL_ID}/transcript answered ${transcript_http}" ;;
    esac
  fi
fi

# 4. One probe email, found in the mail sink.
if [ "$LOGIN_OK" = "1" ]; then
  probe_baseline=$(mail_ids "$PROBE_EMAIL")
  probe_http=$(request_code "$PROBE_EMAIL")
  if [ "$probe_http" != "200" ]; then
    PROBE_NOTE="code request answered ${probe_http}: $(code_hint "$probe_http")"
  else
    probe_id=$(wait_new_mail "$PROBE_EMAIL" "$probe_baseline" || true)
    if [ -n "$probe_id" ]; then
      PROBE_OK=1
      PROBE_NOTE="delivered to ${PROBE_EMAIL}, Mailpit message ${probe_id}"
    else
      PROBE_NOTE="no mail for ${PROBE_EMAIL} within ${WAIT_SECONDS}s (check SMTP_HOST points at the mail sink)"
    fi
  fi
fi

# Best-effort cleanup: the meeting row would otherwise stay in the account's list.
if [ -n "${MEETING_ID:-}" ] && [ -n "${ACCESS_TOKEN:-}" ]; then
  curl_tls -X DELETE "${BASE_URL}/call/meetings/${MEETING_ID}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" -o /dev/null 2>/dev/null || true
fi

if [ "$LOGIN_OK" = "1" ]; then
  printf 'login ok (%s)\n' "$LOGIN_NOTE"
else
  printf 'login failed (%s)\n' "$LOGIN_NOTE"
fi
if [ "$CALL_OK" = "1" ]; then
  printf 'call ok (%s)\n' "$CALL_NOTE"
elif [ "$LOGIN_OK" = "1" ]; then
  printf 'call failed (%s)\n' "$CALL_NOTE"
else
  printf 'call skipped (no session)\n'
fi
if [ "$TRANSCRIPT_OK" = "1" ]; then
  printf 'transcript ok (%s)\n' "$TRANSCRIPT_NOTE"
elif [ "$CALL_OK" = "1" ]; then
  printf 'transcript failed (%s)\n' "$TRANSCRIPT_NOTE"
else
  printf 'transcript skipped (no call)\n'
fi
if [ "$PROBE_OK" = "1" ]; then
  printf 'probe email ok (%s)\n' "$PROBE_NOTE"
elif [ "$LOGIN_OK" = "1" ]; then
  printf 'probe email failed (%s)\n' "$PROBE_NOTE"
else
  printf 'probe email skipped (no session)\n'
fi

[ "$LOGIN_OK$CALL_OK$TRANSCRIPT_OK$PROBE_OK" = "1111" ] || exit 1
