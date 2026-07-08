# Supabase / Lovable Cloud

On Lovable, the backend is managed — schema lives in `supabase/migrations/` and
is applied automatically. This directory is included in git so the project is
portable.

## Files

- **`migrations/`** — timestamped, append-only migrations run by Lovable Cloud
  in order. Never edit an already-applied migration; add a new one instead.
- **`bootstrap.sql`** — idempotent, standalone script that provisions the
  three user-facing tables (`profiles`, `noise_logs`, `claims`) plus their
  RLS policies and the `handle_new_user` signup trigger. Use this to spin up
  a **fresh** Supabase project outside Lovable (e.g. self-hosted fork).
- **`config.toml`** — auto-generated Lovable Cloud settings. Do not edit.

## Applying `bootstrap.sql` to a fresh project

```sh
psql "postgres://postgres:<PASSWORD>@<HOST>:5432/postgres" \
  -f supabase/bootstrap.sql
```

Or paste it into the Supabase SQL editor. It is safe to re-run.

## Tables provisioned

| Table        | Access model                                             |
| ------------ | -------------------------------------------------------- |
| `profiles`   | 1 row per `auth.users` id; owner-only read/write         |
| `noise_logs` | Owner-only read/write; aggregated for map via service key |
| `claims`     | Owner-only read/write                                     |

RLS is enforced on all three. The community map never exposes raw `user_id` —
`src/lib/live-data.functions.ts` reads through the service-role client and
projects only non-PII columns with coordinate jitter.

## Additional tables (managed by feature migrations)

`knowledge_sources`, `knowledge_chunks`, `chat_audit_log`, and
`chat_eval_runs` are created by the RAG / governance migrations under
`migrations/` — they are not part of `bootstrap.sql` because they depend on
`pgvector` and app-specific ingest logic.
