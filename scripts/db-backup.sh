#!/usr/bin/env bash
# Logical backup of the Uithoorn.online database with pg_dump (custom format, compressed).
# Usage:  DATABASE_URL=postgres://... npm run db:backup        -> backups/uithoorn-YYYYmmdd-HHMMSS.dump
# Restore: pg_restore --clean --if-exists --no-owner -d "$TARGET_DATABASE_URL" backups/<file>.dump
# Use the UNPOOLED (direct) Neon connection string for pg_dump. Requires pg_dump >= the server's
# major version. The Neon project runs Postgres 18: install postgresql-client-18 (apt.postgresql.org) or use the
# postgres:18 image. Tested 2026-10-26: dump of the Neon database restored into a fresh database.
set -euo pipefail
URL="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"
if [ -z "$URL" ]; then echo "DATABASE_URL is not set" >&2; exit 1; fi
mkdir -p backups
OUT="backups/uithoorn-$(date -u +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$URL" --file="$OUT"
echo "Backup written: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Keep backups outside the repo (backups/ is git-ignored) and delete them after 30 days (privacy policy retention)."
