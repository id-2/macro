#!/usr/bin/env bash
# Rewrite stored user ids from the legacy `macro|<email>` prefix to `rox|<email>`.
#
# The SQL is the same migration that `sqlx migrate` runs, so a dry run exercises
# exactly the statements that an apply would execute.
#
# Usage:
#   scripts/rewrite_user_id_prefix.sh            # dry run: updates, prints
#                                                # per-column counts, rolls back
#   scripts/rewrite_user_id_prefix.sh --dry-run  # same
#   scripts/rewrite_user_id_prefix.sh --apply    # updates and commits
#
# Connection:
#   DATABASE_URL                 when set, psql connects to it directly
#   POSTGRES_CONTAINER           default macro-rox-postgres-1 (docker exec)
#   POSTGRES_USER                default user
#   POSTGRES_DB                  default macrodb
#
# Nothing is applied by the dry run: the transaction is always rolled back.
set -euo pipefail

mode="dry-run"
case "${1:-}" in
    ""|--dry-run) mode="dry-run" ;;
    --apply) mode="apply" ;;
    -h|--help)
        sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    *)
        echo "unknown argument: $1 (expected --dry-run or --apply)" >&2
        exit 2
        ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
migration="$script_dir/../migrations/20261122001000_user_id_rox_prefix.up.sql"

if [[ ! -f "$migration" ]]; then
    echo "migration not found: $migration" >&2
    exit 1
fi

psql_cmd=()
if [[ -n "${DATABASE_URL:-}" ]]; then
    psql_cmd=(psql "$DATABASE_URL")
else
    psql_cmd=(docker exec -i "${POSTGRES_CONTAINER:-macro-rox-postgres-1}"
        psql -U "${POSTGRES_USER:-user}" -d "${POSTGRES_DB:-macrodb}")
fi

if [[ "$mode" == "dry-run" ]]; then
    ending="ROLLBACK;"
    echo "dry run: rewriting inside a transaction and rolling back" >&2
else
    ending="COMMIT;"
    echo "apply: rewriting inside a transaction and committing" >&2
fi

{
    printf '%s\n' '\set ON_ERROR_STOP on'
    printf '%s\n' 'BEGIN;'
    cat "$migration"
    printf '%s\n' "$ending"
} | "${psql_cmd[@]}" -X -q -v ON_ERROR_STOP=1

if [[ "$mode" == "dry-run" ]]; then
    echo "dry run: rolled back, no changes written" >&2
else
    echo "apply: committed" >&2
fi
