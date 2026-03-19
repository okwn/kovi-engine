#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

psql "$DATABASE_URL" -c "SELECT COUNT(*) AS tenants FROM tenants;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS sources FROM sources;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS runs FROM source_runs;"
echo "Restore verification queries completed"
