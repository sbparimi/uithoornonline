# AI tools for businesses (lane A)

Branch `tab/ai-business`. Business side of the "AI-enabled" plan (owner request 2026-10-30). Lanes B (customer
requests/quotes/reviews) and C (SEO pages, lead alerts) are separate branches.

## What it does

| Feature | Where | Notes |
|---|---|---|
| **Maak mijn profiel met AI** | `/provider/profile` (whole profile editor), signup form (`components/ai-business/signup-ai-fill.tsx`) | Reads the business's OWN website (home + max 2 pages like contact/over-ons/openingstijden), or what the owner types. AI writes NL + EN description, services, 3–5 FAQs, suggests a category. Phone/email/postcode/address/hours are taken from the site (JSON-LD, `tel:`/`mailto:`, text) and dropped when they don't literally appear in the source. Nothing is saved until the owner clicks Opslaan; AI-filled fields carry an "AI" badge. Photos only from their own site (same host, https) and only with the consent box ticked. |
| **Openingstijden + "Nu open"** | profile editor, business page, directory filter (`met=open`) | `businesses.opening_hours` jsonb, Europe/Amsterdam (`lib/hours.ts`). Filter shows only when some listing has hours. Cards show "Nu open"/"Nu gesloten". JSON-LD `openingHoursSpecification` on the business page. |
| **Stel een vraag (AI-assistent)** | business page `#vraag` | Answers only from that business's profile (description, services, FAQs, hours, contact). Unknown / quote / appointment → asks name + email or phone + consent → `business_chat_leads` row + email to the owner (admin BCC as always). Labelled as AI. Business can switch it off (`chat_enabled`). Limits: 20 messages/IP/10 min, lead 4/IP/hour, honeypot + timer. Phone numbers/emails/links in AI replies that are not in the profile are removed. Works without AI too (rules: hours, contact, FAQ match, otherwise lead form). |
| **Jouw leads** | `/provider/leads` + monthly email | Page views, call/website/WhatsApp taps, AI-assistant conversations + questions, job requests (leads + 24/7 alerts), accepted jobs, vs previous month; list of chat leads. Anonymous counters (no cookie/IP), bots dropped. |

## Monthly email (cron)

`GET /api/cron/leads-report` with header `Authorization: Bearer $CRON_SECRET` → sends LAST month's report to every
approved, active business with an owner account and `report_email = true`. Options: `?period=2026-10`,
`?business=<uuid>`, `?dry=1` (list only). Idempotent via `business_report_runs` (a business never gets the same month
twice; a failed send is retried on the next call). Suggested: cron-job.org, 1st of the month 09:00 Europe/Amsterdam.

## AI

Reuses `lib/urgent/llm.ts` (owner's GROQ key → KIMI fallback; new generic `llmJson()`), no other keys. If no provider
answers, everything still works with rules (draft from the site's structured data/meta; chat via hours/contact/FAQ).

## Database

`db/migrations/0006_ai_business_profile.sql` (additive: 8 nullable/defaulted columns on `businesses`, tables
`business_chat_leads`, `business_report_runs`). Rollback: `db/migrations/rollback/0006_ai_business_profile.down.sql`
(tested up → down → up on the preview branch) or restore the Neon snapshot taken before applying.
All readers tolerate the migration not being applied yet (Postgres 42703/42P01 → "no extras").
