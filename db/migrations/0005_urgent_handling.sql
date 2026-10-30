-- 0005: 24/7 urgent handling (phase 1): AI intake, instant multi-channel job alerts with one-tap accept,
-- spoed escalation to 24/7 businesses. Purely additive (new nullable/defaulted columns + new tables),
-- so the running app is unaffected until the feature flags are switched on.
-- Rollback: db/migrations/rollback/0005_urgent_handling.down.sql (or restore the Neon snapshot branch).

-- Requests: how urgent (normalised), where they came from, contact details from the intake,
-- who accepted first, and the escalation state machine for spoed requests.
alter table service_requests add column if not exists urgency_level text
  check (urgency_level is null or urgency_level in ('spoed', 'today', 'week', 'flexible'));
alter table service_requests add column if not exists source text not null default 'form'
  check (char_length(source) <= 20);
alter table service_requests add column if not exists contact_name text check (contact_name is null or char_length(contact_name) <= 120);
alter table service_requests add column if not exists contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40);
alter table service_requests add column if not exists contact_email text check (contact_email is null or char_length(contact_email) <= 254);
alter table service_requests add column if not exists intake jsonb;
alter table service_requests add column if not exists accepted_business_id uuid references businesses(id) on delete set null;
alter table service_requests add column if not exists accepted_at timestamptz;
alter table service_requests add column if not exists accepted_via text check (accepted_via is null or char_length(accepted_via) <= 20);
alter table service_requests add column if not exists escalation_stage text not null default 'none'
  check (escalation_stage in ('none', 'waiting', 'escalated', 'calling', 'exhausted', 'done'));
alter table service_requests add column if not exists escalation_next_at timestamptz;
alter table service_requests add column if not exists escalation_index integer not null default 0;
alter table service_requests add column if not exists alerts_sent_at timestamptz;

create index if not exists service_requests_escalation_due_idx
  on service_requests (escalation_next_at)
  where escalation_next_at is not null and accepted_business_id is null;

-- Businesses: how they want to be alerted.
alter table businesses add column if not exists alert_email boolean not null default true;
alter table businesses add column if not exists alert_sms boolean not null default false;
alter table businesses add column if not exists alert_whatsapp boolean not null default false;
alter table businesses add column if not exists alert_phone text check (alert_phone is null or char_length(alert_phone) <= 40);
alter table businesses add column if not exists spoed_24_7 boolean not null default false;
alter table businesses add column if not exists quiet_start time;
alter table businesses add column if not exists quiet_end time;

-- Every alert attempt, per channel (admin view: alert log + accept times).
create table if not exists job_alerts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  audience text not null default 'business' check (audience in ('business', 'customer', 'admin')),
  channel text not null check (channel in ('email', 'sms', 'whatsapp', 'voice')),
  stage text not null default 'initial' check (stage in ('initial', 'escalation', 'call', 'taken', 'accepted', 'update')),
  status text not null check (status in ('sent', 'skipped', 'failed', 'disabled')),
  recipient text check (recipient is null or char_length(recipient) <= 254),
  provider_id text check (provider_id is null or char_length(provider_id) <= 200),
  error text check (error is null or char_length(error) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists job_alerts_request_idx on job_alerts (request_id, created_at);

-- Optional photos from the intake (small, client-side compressed JPEGs).
create table if not exists request_photos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null check (octet_length(data) <= 1500000),
  created_at timestamptz not null default now()
);
create index if not exists request_photos_request_idx on request_photos (request_id);
