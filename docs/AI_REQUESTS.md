# AI request flow for all jobs (customer side)

Residents can ask for help with **any** job, not only emergencies. The help assistant (`/hulp`) asks
2-4 smart follow-up questions, sends the request to the **best 3** matching businesses with an
**AI job brief**, businesses answer with a **quote** from a one-tap page (no login), and the customer
**compares the quotes side by side** on the status page and picks one. After the job is done the
customer gets a **verified review** request; good ratings rank higher in the directory and in matching.
Spoed (urgent) requests keep the existing first-to-accept + escalation flow (docs/URGENT_HANDLING.md).

Everything is behind `QUOTE_FLOW_ENABLED=1` (plus the existing `URGENT_INTAKE_ENABLED=1` and
`JOB_ALERTS_EMAIL_ENABLED=1`). With the flag off, `/hulp` behaves exactly as before.

## Flow

1. Resident describes the job (optional photos). The classifier picks category + urgency (same as before).
2. Resident confirms the category and picks the timing (Spoed / Vandaag / Deze week / Flexibel).
   - **Spoed**: unchanged urgent flow (alerts to all matches, first to accept wins, escalation).
   - **Otherwise**: `/api/intake/questions` returns 2-4 follow-up questions with tap-to-answer options
     (AI on the owner's own keys via `lib/urgent/llm.ts`; per-category rule set when no AI answers).
     The assistant then nudges for a photo, asks the postcode and contact details.
3. The request is created with `quote_mode = true` and leads for the **best 3** businesses
   (`lib/matching.ts`, see below). Each gets a quote-request email with the **AI job brief**
   (summary, key facts, things still to ask, and an *indicative* price range only when there is a
   sensible basis — never for legal/care/admin jobs or spoed; clearly labelled "AI-schatting, niet bindend").
4. The business opens `/klus/<token>`: AI brief (labelled "door AI gemaakt"), the customer's own words,
   photos and answers, and a quote form: price type (vaste prijs / vanaf / per uur / na bezichtiging),
   amount incl. btw, start date, message (optional example text the business edits itself). Or "Niet beschikbaar".
   The customer's contact details are **not** shown until the customer chooses this business.
5. The customer gets an email per first quote and sees all quotes **side by side** on
   `/hulp/status/<token>` (price, start date, message, verified star rating, "Laagste prijs" /
   "Best beoordeeld" badges, link to the business page) and taps **Kies deze offerte**.
   That reuses `acceptJob()` (via `quote`): the winner gets the customer's contact details, the others
   are told the customer chose someone else, the customer gets the winner's details.
6. **No quote within 24 h** (`QUOTE_ROUND_HOURS`) → the next 3 businesses are invited (round 2, then 3).
   When every business of a round taps "Niet beschikbaar", the next round starts at once. After the last
   round (or when no more businesses match) the customer is told our team follows up personally and the
   admin gets a `request_unanswered` alert.
7. **Job done**: the customer ("Ja, de klus is klaar" on the status page) or the chosen business
   ("Markeer als klaar" on its job page) closes the job. The customer then gets **one** review request
   (`/beoordeling/<token>`) — also for classic and spoed jobs. Reviews can only be written for a completed
   job, by that job's customer, once; they show on the business page with "Geverifieerde klus". Nothing is
   ever AI-written or seeded.

## Matching (`lib/matching.ts`)

Category-id based: every request category maps to the business categories that do that work
(primary, then secondary). This fixes the old substring regex where "car" (Automotive) matched
"care"/"childcare" and "it" matched "keuken". Businesses with a custom category ("Overig" + own words)
are matched on whole-word keywords (Postgres `\m…\M`). Ranking: category fit → rating from verified
reviews (Bayesian: no reviews = 3.5, so good ratings rise and poor ones sink) → same postcode area →
featured → newest. The classic form keeps up to 10 matches; the AI flow takes the top 3 per round.
The rule-based classifier fallback (`lib/urgent/llm.ts`) uses word boundaries on short words too.
The public directory's relevance order also adds the verified-review score (`lib/directory/search.ts`).

## Pieces

| Part | Where |
| --- | --- |
| Questions API | `POST /api/intake/questions` (`lib/urgent/ai-request.ts` followUpQuestions) |
| AI job brief | `lib/urgent/ai-request.ts` jobBrief, stored per language in `service_requests.ai_brief` |
| Quote logic, rounds, done, reviews | `lib/urgent/quotes.ts` |
| Emails | `lib/urgent/quote-mail.ts` |
| Business answers | `/klus/<token>` (`components/quote-respond.tsx`), `POST /api/quotes` |
| Customer picks | status page (`components/urgent-status.tsx`), `POST /api/quotes/choose` |
| Job done | `POST /api/jobs/done` (customer status token or the business's job token) |
| Verified review | `/beoordeling/<token>` (`components/verified-review-form.tsx`), `POST /api/reviews/verified` |
| Next-3 fallback | `GET /api/cron/requests` (Bearer `CRON_SECRET`, idempotent: rows are claimed with `FOR UPDATE SKIP LOCKED`); `/api/cron/urgent` and status/job page views also run it |
| Database | `db/migrations/0006_b_quotes_reviews.sql` (additive). Rollback: `db/migrations/rollback/0006_b_quotes_reviews.down.sql` |

## Environment variables

| Name | Effect |
| --- | --- |
| `QUOTE_FLOW_ENABLED` | `1` = the AI request flow for non-urgent jobs (needs `JOB_ALERTS_EMAIL_ENABLED=1` and migration 0006) |
| `QUOTE_ROUND_HOURS` | Hours without a quote before the next 3 businesses are invited (default 24; previews use 0.05 = 3 min) |

AI keys: the same `GROQ_API_KEY` / `KIMI_*` / … as the classifier (owner's own keys). No key = rule-based
questions and a plain (non-AI) brief without price; the flow still works.

## Switching on in production

1. Take a Neon snapshot branch of production, then apply migration 0006 (`npm run db:migrate`).
2. Set `QUOTE_FLOW_ENABLED=1` (Production) next to `URGENT_INTAKE_ENABLED=1` and `JOB_ALERTS_EMAIL_ENABLED=1`, redeploy.
3. For exact 24 h rounds add an external cron for `https://uithoorn.online/api/cron/requests` (or rely on
   `/api/cron/urgent`, which runs the rounds too).

To switch off: remove the flag and redeploy. Quotes and reviews stay; nothing else changes.
