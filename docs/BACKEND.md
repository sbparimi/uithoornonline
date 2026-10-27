# Backend

Everything server-side lives in `lib/` and `app/api/`. The database is Postgres on Neon (project `uithoornonline`,
region aws-eu-central-1 / Frankfurt). Serverless functions are pinned to Vercel's `fra1` region in `vercel.json`, next to
the database (lower latency, personal data processed in the EU). There is no Supabase dependency any more.

## Database and migrations
- Migrations: `db/migrations/NNNN_name.sql`, applied in order by `npm run db:migrate` (uses `DATABASE_URL_UNPOOLED`
  when set). Applied files are recorded in `schema_migrations` with a checksum; an edited, already-applied file stops
  the run. Add a new file to change the schema, never edit an old one.
- Seed: `npm run db:seed` upserts the two real businesses (SpiceIndia, Ruslen). Nothing else is seeded.
- The app uses the pooled URL (`DATABASE_URL`) through `lib/db.ts`. If the database is unreachable, public pages fall
  back to the built-in listings and API routes answer `503 database_unavailable`.

## Auth
- Self-hosted: email + password (scrypt, `lib/auth/password.ts`), httpOnly `uo_session` cookie (SameSite=Lax, Secure),
  30-day sessions stored hashed in `sessions`. Sign-out deletes the session row.
- Optional magic link (`/api/auth/magic-link`), switched on automatically once `RESEND_API_KEY` is set. Tokens are
  single-use, hashed, and expire after 20 minutes.
- Roles: `customer` (resident), `provider` (business), `admin`. Signup can only create customer or provider;
  admin is granted with `npm run db:make-admin -- email` or by another admin in /admin.
- Sign-up requires accepting the terms and privacy policy (`terms_accepted_at` is stored).

## Authorization (enforced in `lib/data/*`, not in the browser)
- Residents see only their own requests, conversations and data export. Other people's phone numbers and emails are
  never returned by any API.
- Businesses see only leads matched to them. A lead never contains the resident's email or phone; contact happens in
  the conversation after the business accepts.
- Businesses can edit only the safe profile fields (name, category, description, postcode, address, website, phone).
  `verified`, `featured`, `active`, `moderation_status` and the plan are admin-only and silently ignored otherwise.
- New businesses start as `pending` and receive no leads and no public listing until an admin approves them.
- `/api/admin` (moderation) requires role admin; every admin action is written to `audit_log`.
  Admins cannot demote or disable themselves.
- State-changing requests check the Origin header (CSRF), and all JSON bodies are size- and type-checked.

## Spam and abuse
- Rate limits (Postgres fixed window, IP/email hashed, `lib/security/rate-limit.ts`): signup 5/h per IP, login 20 per
  15 min per IP and 8 per 15 min per email, requests 5/h per user and 10/h per IP, contact and submissions 5/h per IP.
- Public forms carry a hidden honeypot field (`company_website`) and a minimum fill time (2.5 s).
- `/api/agent` (the old unauthenticated LLM endpoint) is removed.

## Lead limits (server-side)
Plans in `business_plans`: Free 3, Pro 15, Pro+ 50 leads per calendar month. When a business is over its limit, new
leads are stored as `locked`: the business sees that a request came in, not its details, and cannot accept it.
Raising the plan in /admin unlocks this month's locked leads up to the new limit.

## Payments
No online checkout. Plans are arranged through "Neem contact op" / WhatsApp and set by an admin in /admin
(`business_subscriptions.payment_provider = manual`). `lib/billing/index.ts` is the seam for Mollie later:
implement `PaymentProvider`, add a webhook route, and set `payment_provider = 'mollie'`.

## Email and notifications
- `lib/email/send.ts` sends through Resend's HTTP API and logs every attempt in `email_outbox` (status `sent`,
  `failed` or `skipped` when no key is set).
- `notify(event, summary, details)` in `lib/notify.ts` emails uithoorn.online@mail.tab.bot (and `OWNER_NOTIFY_EMAIL`
  when set) for new requests, signups, businesses, reviews, contact messages and deleted accounts.
- TODO (owner): create a Resend account, add the domain uithoorn.online, put the SPF/DKIM records Resend shows into
  the DNS at mijndomein.nl, then set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel.

## Privacy
- Account page: data export (JSON) and account deletion (`/api/account/export`, `/api/account/delete`).
- Retention (`lib/data/retention.ts`, daily via Vercel Cron at 03:30 UTC → `/api/cron/retention`, protected by
  `CRON_SECRET`): requests and conversations 24 months, inactive resident accounts 36 months, contact messages 24
  months, analytics 26 months, email log 12 months, admin log 24 months.
- Only functional cookies (`uo_session`, language). Vercel Analytics is cookieless, so no cookie banner is needed.

## Environment variables
See `.env.example`. Production needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`,
and later `RESEND_API_KEY` / `RESEND_FROM_EMAIL`.
