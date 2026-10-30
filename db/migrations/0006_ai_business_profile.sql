-- 0006: AI business tools (lane A): AI profile builder fields, opening hours ("Nu open"), page chat leads,
-- monthly "Jouw leads" report. Purely additive (nullable/defaulted columns + new tables), so the running app
-- is unaffected until the new code reads them.
-- Rollback: db/migrations/rollback/0006_ai_business_profile.down.sql (or restore the Neon snapshot branch).

-- Profile extras. opening_hours: {"mon":[["09:00","17:30"]], "tue":[], ..., "note":"..."}
--   a day key with [] = closed that day; a missing day = unknown. Times are Europe/Amsterdam.
-- services: [{"nl":"…","en":"…"}]   faqs: [{"q_nl","a_nl","q_en","a_en"}]
-- ai_profile: internal provenance of AI-written text (never shown publicly): source, provider, when,
--   which fields the AI drafted, and whether the owner reviewed them before saving.
alter table businesses add column if not exists description_en text check (description_en is null or char_length(description_en) <= 3000);
alter table businesses add column if not exists opening_hours jsonb;
alter table businesses add column if not exists services jsonb not null default '[]'::jsonb;
alter table businesses add column if not exists faqs jsonb not null default '[]'::jsonb;
alter table businesses add column if not exists kvk_number text check (kvk_number is null or kvk_number ~ '^[0-9]{8}$');
alter table businesses add column if not exists ai_profile jsonb;
alter table businesses add column if not exists chat_enabled boolean not null default true;
alter table businesses add column if not exists report_email boolean not null default true;

-- Questions/leads from the AI assistant on a business page. Minimal personal data: a name and ONE way
-- to reach the person, plus their question. Deleted with the business.
create table if not exists business_chat_leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  question text not null check (char_length(question) between 3 and 2000),
  transcript jsonb not null default '[]'::jsonb,
  lang text not null default 'nl' check (lang in ('nl', 'en')),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed', 'spam')),
  email_status text check (email_status is null or char_length(email_status) <= 20),
  created_at timestamptz not null default now(),
  constraint business_chat_leads_contact check (email is not null or phone is not null)
);
create index if not exists business_chat_leads_business_idx on business_chat_leads (business_id, created_at desc);

-- One row per business per month once its report email went out (makes the monthly job idempotent:
-- a second call for the same month sends nothing).
create table if not exists business_report_runs (
  business_id uuid not null references businesses(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'skipped', 'failed')),
  created_at timestamptz not null default now(),
  primary key (business_id, period)
);
