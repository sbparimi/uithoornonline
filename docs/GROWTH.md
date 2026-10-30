# Growth: service pages, instant lead alerts, push, promo (lane C, Oct 30 2026)

## SEO service × town pages
- `/diensten` (index), `/diensten/<service>` (hub), `/diensten/<service>/<plaats>` for 24 services × Uithoorn, De Kwakel, Amstelhoek (NL at the root, EN under /en).
- Copy lives in `lib/seo/services.ts` (AI-assisted draft, reviewed; edit freely). Listings are the live directory (`lib/seo/listings.ts`), town matches first; SpiceIndia first on food pages.
- Pages with no listings are `noindex, follow` and show the "Nog vrij — wordt jouw bedrijf hier de eerste?" invite. Filled ones go in the sitemap. JSON-LD: BreadcrumbList, Service (+ real listings as LocalBusiness offers), FAQPage.
- Old URLs `/diensten/loodgieter-uithoorn` etc. redirect (308) to `/diensten/loodgieter/uithoorn`.
- "Hulp aanvragen" goes to `/hulp` when `URGENT_INTAKE_ENABLED=1`, else `/request?category=…`.

## Instant lead alerts
- Every matched business gets the job details right away by email with a one-tap reply link `/aanvraag/<token>` (signed, 14 days, no login). Tapping "Ik reageer op deze aanvraag" does the same as accepting on the dashboard (conversation opens, customer is emailed). Code: `lib/leads/instant.ts`, `app/api/leads/accept`.
- Used by `/api/requests` (classic form) and `/api/intake/submit` when `JOB_ALERTS_EMAIL_ENABLED` is off. With it on, the urgent first-to-accept alerts (`/klus`) are unchanged and now also push.
- Locked leads (pricing on, over the limit) keep the old teaser mail.

## Web push (free, no phone number)
- Business dashboard card "Nieuwe aanvragen direct op je telefoon" → browser permission → subscription saved (`push_subscriptions`, migration 0006). Test button included. iPhone: needs "Zet op beginscherm" (iOS 16.4+); the card says so.
- Service worker: `/api/push/sw` (scope `/api/push/`, no fetch handler). Encryption + VAPID without dependencies in `lib/push/webpush.ts`; `node scripts/push-selftest.mjs` checks it against the RFC 8291 test vector.
- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:). Unset = card hidden, nothing sent. Generate a pair with:
  `node -e "const c=require('crypto');const k=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const p=k.publicKey.export({format:'jwk'});console.log('PUBLIC',Buffer.concat([Buffer.from([4]),Buffer.from(p.x,'base64url'),Buffer.from(p.y,'base64url')]).toString('base64url'));console.log('PRIVATE',k.privateKey.export({format:'jwk'}).d)"`
- Alert log: pushes for urgent jobs are logged in `job_alerts` with channel `push`.

## First leads free
- `components/first-leads-free.tsx` on the business signup (`/signup/account?role=provider`) and dashboard. Copy only; `FIRST_LEADS_FREE=10` shows the number, unset = "Je eerste aanvragen zijn gratis".

## Short link for print
- `/aanvragen?bron=flyer` → `/hulp` (intake on) or `/request`. The flyer QR points here so print keeps working whichever flow is live.

## Rollback
- Code: revert the merge commit (or promote the previous production deployment in Vercel).
- DB: `db/migrations/rollback/0006_web_push.down.sql`, then `delete from schema_migrations where name = '0006_web_push.sql'`. Take a Neon snapshot branch before applying 0006 in production.
