#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
OUT_FILE="$OUT_DIR/kovi-${STAMP}.dump"

pg_dump --format=custom --file="$OUT_FILE" "$DATABASE_URL"
echo "Backup written: $OUT_FILE"
