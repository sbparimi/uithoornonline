# Uithoorn.online

Local marketplace and community platform for Uithoorn and De Kwakel: local businesses, requests and leads, jobs, events, deals.

## Stack
Next.js 15 (App Router), React, TypeScript, Postgres on Neon (EU, Frankfurt), Vercel, Resend for email, Vercel Analytics (cookieless).

## Getting started
```bash
cp .env.example .env.local        # fill DATABASE_URL / DATABASE_URL_UNPOOLED
npm install
npm run db:migrate                # applies db/migrations/*.sql in order (tracked in schema_migrations)
npm run db:seed                   # the two real businesses (SpiceIndia, Ruslen); safe to re-run
npm run dev
```
Create the first admin: sign up on the site, then `DATABASE_URL=... npm run db:make-admin -- you@example.com`.
There is deliberately no web path to become admin.

## Docs
- `docs/BACKEND.md`: auth, roles, authorization rules, rate limits, lead limits, email, cron, payments seam
- `docs/BACKUPS.md`: Neon point-in-time restore and pg_dump backups
- `npm run test:security`: end-to-end authorization test against a running server (see the script header)
