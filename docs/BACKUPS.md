# Backups and restore

## 1. Neon point-in-time restore (PITR)
Neon keeps the write-ahead log, so the database can be restored to any moment inside the history window:
6 hours on the Free plan, 7 days on Launch, up to 30 days on Scale. For a real launch, a paid plan with at least
7 days of history is recommended.

Restore: Neon console → project `uithoornonline` → Branches → Restore (or "Create branch from a point in time"),
pick the timestamp, check the data on the new branch, then point `DATABASE_URL` at it or restore into `main`.

## 2. Logical backups with pg_dump
```bash
# needs pg_dump 18+ (the Neon project runs Postgres 18): apt install postgresql-client-18, or the postgres:18 image
DATABASE_URL_UNPOOLED='postgresql://…' npm run db:backup     # -> backups/uithoorn-YYYYmmdd-HHMMSS.dump
```
Restore into an empty database of the same major version:
```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET_DATABASE_URL" backups/<file>.dump
```
Tested on 2026-10-26: a dump of the Neon database restored into a fresh database with all tables, both businesses
and the plans intact.

Suggested routine: a weekly dump (for example a scheduled GitHub Action or a cron on any machine) stored in private
EU storage, with dumps deleted after 30 days. The dumps contain personal data, so treat them like the database itself.
`backups/` is git-ignored: never commit a dump.
