# 24/7 urgent handling (phase 1)

Residents can describe a problem to a chat-style help assistant, matching businesses are alerted at
once on several channels with a one-tap accept link (first to accept gets the job), and urgent
("spoed") requests escalate to businesses that offer 24/7 emergency service when nobody accepts in
10 minutes. Everything is behind feature flags; with no flags set the site behaves exactly as before.

## Pieces

| Part | Where |
| --- | --- |
| Help assistant ("Hulp nodig?") | `/hulp` (`app/[lang]/hulp`, `components/urgent-intake.tsx`), API `/api/intake/classify`, `/api/intake/submit` |
| Customer live status | `/hulp/status/<token>` (`components/urgent-status.tsx`), API `/api/intake/status` |
| One-tap accept (no login) | `/klus/<token>` (`components/urgent-accept.tsx`), API `POST /api/alerts/accept` |
| Alerts + escalation logic | `lib/urgent/alerts.ts`, channels `lib/urgent/channels.ts`, texts `lib/urgent/mail.ts` |
| AI classifier (provider-agnostic, rule fallback) | `lib/urgent/llm.ts` |
| Scheduler | `GET /api/cron/urgent` (Bearer `CRON_SECRET`), called by `.github/workflows/urgent-tick.yml` every 5 min, and opportunistically by status/accept page views |
| Voice keypress webhook | `POST /api/alerts/voice` |
| Business settings | Business profile → "Klusmeldingen" (`components/alert-settings-form.tsx`, `/api/provider/alert-settings`) |
| Admin | Admin → Spoed (`app/[lang]/admin/_sections/urgent.tsx`) |
| Database | `db/migrations/0005_urgent_handling.sql` (additive). Manual rollback: `db/migrations/rollback/0005_urgent_handling.down.sql` |

## Flow

1. The resident describes the problem (optional photos). The classifier picks a category and urgency
   (spoed / vandaag / deze week / flexibel), a one-line summary and, for spoed, a safety tip.
   The resident confirms or corrects, gives the postcode and contact details (phone required for spoed).
2. A normal request is created (same matcher, leads, dashboard notifications). Guests get a customer
   account for their email (no password; they sign in with an email link).
3. Each matching approved business gets an alert on every channel it allows (email now; SMS/WhatsApp
   when switched on) with a signed accept link. Quiet hours hold back SMS/WhatsApp.
4. The first business to accept gets the job: the customer is emailed (and texted) who is coming, the
   winner gets the customer's contact details, everyone else alerted hears the job is taken.
   Accepting from the dashboard also claims the job.
5. Spoed: if nobody accepted after `SPOED_ESCALATE_AFTER_MIN` (10) minutes, every matching business
   with "24/7 spoed beschikbaar" gets an escalation email + SMS (+WhatsApp); with voice on they are then
   called one by one (`SPOED_CALL_GAP_MIN`, 3 min apart; "press 1" accepts). The customer is updated at
   each step. If nobody accepts, the customer and the admin are told.

## Environment variables (Vercel → Project → Settings → Environment Variables)

Flags (exactly `1` = on; anything else = off):

| Name | Effect |
| --- | --- |
| `URGENT_INTAKE_ENABLED` | Shows `/hulp` and the "Spoed, of liever chatten?" link on `/request` |
| `JOB_ALERTS_EMAIL_ENABLED` | One-tap accept emails for help-assistant requests (otherwise the classic lead email) and spoed escalation |
| `SPOED_ESCALATION_ENABLED` | Optional override; defaults to the email flag |
| `JOB_ALERTS_SMS_ENABLED` | SMS alerts (needs Twilio keys) |
| `JOB_ALERTS_WHATSAPP_ENABLED` | WhatsApp alerts (needs Twilio WhatsApp sender or Meta keys) |
| `JOB_ALERTS_VOICE_ENABLED` | Automated calls in spoed escalation (needs Twilio keys) |

Providers:

| Name | For |
| --- | --- |
| `GROQ_API_KEY` / `KIMI_API_KEY`+`KIMI_BASE_URL`(+`KIMI_MODEL`) / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | AI classifier (first one found; `INTAKE_LLM_PROVIDER`, `INTAKE_LLM_MODEL` override; none = rules) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | SMS + voice (a Dutch number that can do both, E.164, e.g. `+3197…`) |
| `WHATSAPP_PROVIDER` (`twilio` default or `meta`) | WhatsApp route |
| `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+31…`) | WhatsApp via Twilio |
| `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ALERT_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG` | WhatsApp via Meta Cloud API (approved template with one body parameter) |
| `ALERT_TOKEN_SECRET` | Signs accept/status links (falls back to `CRON_SECRET`) |
| `SPOED_ESCALATE_AFTER_MIN`, `SPOED_CALL_GAP_MIN` | Timers (defaults 10 and 3) |

Test safety (previews only, never production):

| Name | Effect |
| --- | --- |
| `EMAIL_REDIRECT_TO` | Every email goes to this address instead, original recipient in the subject |
| `ALERTS_REDIRECT_PHONE` | Every SMS/WhatsApp/call goes to this number instead |

## Scheduler

Vercel Hobby only allows daily crons, so `.github/workflows/urgent-tick.yml` calls `/api/cron/urgent`
every 5 minutes (repository secret `CRON_SECRET`). GitHub can start scheduled runs a few minutes late,
so the customer's status page (polled every 15 s for spoed) and every accept-page view also advance
due escalations. For exact timing, add a free external cron (cron-job.org: URL
`https://uithoorn.online/api/cron/urgent`, header `Authorization: Bearer <CRON_SECRET>`, every minute)
or move to Vercel Pro and add `{"path": "/api/cron/urgent", "schedule": "* * * * *"}` to `vercel.json`.

## Switching on in production

1. Migration 0005 must be applied (`npm run db:migrate` against production; take a Neon branch snapshot first).
2. Set `URGENT_INTAKE_ENABLED=1` and `JOB_ALERTS_EMAIL_ENABLED=1` (Production), redeploy.
3. Later, with keys: `JOB_ALERTS_SMS_ENABLED=1`, `JOB_ALERTS_WHATSAPP_ENABLED=1`, `JOB_ALERTS_VOICE_ENABLED=1`.

To switch off: remove/blank the flag and redeploy. Data stays; nothing else changes.
