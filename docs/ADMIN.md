# Admin console, email and password reset

## Admin console (`/admin`, admins only)
Tabs: Overview · Businesses · Accounts · Requests (+ leads) · Payments · Contacts (form + inbound email) · Issues · Reviews · Emails · Audit log · Settings.
- Every action posts to `/api/admin` (one action per form), re-checks `requireRole('admin')` server-side and writes `audit_log`
  with who, what, when and a before/after snapshot (`details.before` / `details.after`).
- CSRF: form posts must carry an Origin/Referer from this host; JSON calls need no CORS (never allowed); cookie is SameSite=Lax.
- Lists have search, filters, pagination and CSV export (`/api/admin/export?type=…`, same filters, formula-injection safe).
- Deletes need a typed confirmation (DELETE, or the account's email).

## Payments ledger (no processor; payments via WhatsApp/Tikkie/bank/cash)
Pricing is currently switched off (see `lib/pricing.ts` / docs/BACKEND.md): everything is free and leads are unlimited,
so the plan and credit fields below are dormant. They keep working for when pricing returns.

Recording a **paid** payment applies it: a plan payment sets the plan for N months (extends the current period when it's the
same plan), a single-lead payment adds extra lead credits (`business_lead_credits`). This month's locked leads that now fit
are unlocked. Marking unpaid / deleting reverts the credits (a plan is left as is). Optional receipt email to the owner.
A new lead that arrives over the monthly allowance uses a credit automatically (stored with `counts_toward_limit = false`).

## Password
- `/forgot-password` → `POST /api/auth/password-reset` emails a one-time link (60 min, single use, hashed in `auth_tokens`,
  purpose `reset`). Same answer whether the email exists; rate-limited 4/h per email, 10/h per IP.
- `/reset-password?token=…` → `POST /api/auth/password-reset/confirm` sets the password, ends all other sessions, signs in.
- Logged in: Account → Settings → change password (existing). Both send a "password changed" email.
- Admins can send a reset link from Accounts.

## Email (Resend)
- `lib/email/send.ts`: every email is also BCC'd to `ADMIN_EMAIL` (default reachparimi@gmail.com) unless the admin is already
  a recipient; every attempt is logged in `email_outbox` (to, bcc, kind, status, Resend id, error) and visible under Emails.
- Templates (`lib/email/templates.ts`, NL/EN, HTML + text): welcome, password reset, password changed, request confirmation,
  new lead, lead accepted, new chat message (max 1 per conversation per 15 min), business approved/rejected, payment receipt,
  contact auto-reply, admin reply, admin alerts (signup, business, request, contact, issue, review, payment, inbound email).
- Inbound: Resend webhook `POST /api/email/inbound` (Svix signature, `RESEND_WEBHOOK_SECRET`), only for `INBOUND_DOMAINS`
  (default uithoorn.online). Stored in Contacts and forwarded to the admin with Reply-To = sender.
- Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL`, `RESEND_WEBHOOK_SECRET`, `INBOUND_DOMAINS`, `EMAIL_SUBJECT_PREFIX` (Preview: "[Preview] ").

## DNS for uithoorn.online (Mijndomein)
uithoorn.online is still verified on ANOTHER Resend team. A claim was started on 2026-10-28 (expires 2026-11-04).
1. Ownership: `TXT  @  resend-domain-verification=8eadaa7e36d3914d7659e0f38bd227ed`
2. After the claim completes, sending. The zone now has OLD Resend records for the other team (`resend._domainkey` TXT and a `send` record pointing to send.forge.rmta.net): replace/remove those first.
   - `TXT  resend._domainkey  p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDLImz+ZAfSg+Z/BTMeTdamYMMuksi8uERiouYaS0HUEDh1XOOVfJxdqn7B3hRnC4rkUqQ5Ofa7faYD7zwirn4YiHoTVenUS5/YPWErzvNUqnQRUuyO/by+ltN7Qyoeu9MQx3m6FuSt6Jd2U+ISCoy98/FabKTfJpVAygSapilvOQIDAQAB`
   - `MX   send  feedback-smtp.eu-west-1.amazonses.com  (priority 10)`
   - `TXT  send  v=spf1 include:amazonses.com ~all`
3. Receiving (after enabling receiving on the domain in Resend): `MX  @  inbound-smtp.eu-west-1.amazonaws.com  (priority 10)`
Then set `RESEND_FROM_EMAIL="Uithoorn.online <noreply@uithoorn.online>"` and enable webhook b57367f5.

## Tests
`npm run test:admin` (needs a LOCAL database and the mock settings in the script header), plus `test:security`.
