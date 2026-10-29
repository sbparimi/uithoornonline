-- 0002_admin_console.sql — admin console: payments ledger, extra lead credits, issues, inbound email,
-- admin replies, site settings, business photos, richer email log, and the owner's admin account.
-- ADDITIVE ONLY: new tables and nullable columns. The live code from 0001 keeps working unchanged.

-- Extra (purchased) lead credits on top of the plan's monthly allowance. One row per business.
create table if not exists business_lead_credits (
  business_id uuid primary key references businesses(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0 and credits <= 10000),
  updated_at timestamptz not null default now()
);

-- Manual payments ledger (payments happen via WhatsApp / Tikkie / bank; there is no processor).
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete set null,
  business_name text not null default '' check (char_length(business_name) <= 120),
  amount_cents integer not null check (amount_cents >= 0 and amount_cents <= 10000000),
  currency text not null default 'EUR' check (currency in ('EUR')),
  kind text not null check (kind in ('plan', 'lead', 'other')),
  plan_key text references business_plans(key),
  lead_credits integer not null default 0 check (lead_credits >= 0 and lead_credits <= 1000),
  months integer not null default 1 check (months between 1 and 24),
  method text not null default 'whatsapp' check (method in ('whatsapp', 'tikkie', 'bank', 'cash', 'other')),
  status text not null default 'unpaid' check (status in ('paid', 'unpaid', 'refunded')),
  paid_on date,
  note text check (note is null or char_length(note) <= 1000),
  applied_at timestamptz,
  receipt_sent_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_business_idx on payments(business_id, created_at desc);
create index if not exists payments_paid_on_idx on payments(paid_on);

-- Inbound email received through Resend (webhook /api/email/inbound).
create table if not exists inbound_emails (
  id uuid primary key default gen_random_uuid(),
  provider_id text unique,
  from_address text not null check (char_length(from_address) <= 320),
  to_addresses text not null default '' check (char_length(to_addresses) <= 2000),
  subject text not null default '' check (char_length(subject) <= 500),
  text_body text not null default '' check (char_length(text_body) <= 100000),
  html_body text check (html_body is null or char_length(html_body) <= 300000),
  status text not null default 'new' check (status in ('new', 'handled', 'spam')),
  forwarded_at timestamptz,
  received_at timestamptz not null default now()
);
create index if not exists inbound_emails_received_idx on inbound_emails(received_at desc);

-- Replies an admin sent from the console (to a contact message or an inbound email).
create table if not exists contact_replies (
  id uuid primary key default gen_random_uuid(),
  contact_message_id uuid references contact_messages(id) on delete cascade,
  inbound_email_id uuid references inbound_emails(id) on delete cascade,
  to_address text not null check (char_length(to_address) <= 320),
  subject text not null check (char_length(subject) <= 300),
  body text not null check (char_length(body) between 1 and 10000),
  email_status text not null default 'sent',
  sent_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Simple issue tracker.
create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 200),
  body text not null default '' check (char_length(body) <= 10000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  source text not null default 'admin' check (source in ('admin', 'contact', 'email', 'report')),
  contact_message_id uuid references contact_messages(id) on delete set null,
  inbound_email_id uuid references inbound_emails(id) on delete set null,
  business_id uuid references businesses(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  notes text not null default '' check (char_length(notes) <= 20000),
  created_by uuid references users(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issues_status_idx on issues(status, created_at desc);

-- Business photos (URLs: files in /public or https links).
create table if not exists business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  url text not null check (char_length(url) between 1 and 500),
  alt text not null default '' check (char_length(alt) <= 200),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists business_photos_business_idx on business_photos(business_id, sort);

-- Richer email log (nullable columns on the existing table).
alter table email_outbox add column if not exists bcc_address text;
alter table email_outbox add column if not exists ref text;
alter table email_outbox add column if not exists lang text;
create index if not exists email_outbox_ref_idx on email_outbox(ref, created_at desc) where ref is not null;
create index if not exists email_outbox_created_idx on email_outbox(created_at desc);

-- The owner's admin account (owner request 2026-10-28): reachparimi@gmail.com is admin.
-- New account: created with NO password (password_hash null), so the only way in is
-- "Wachtwoord vergeten / Forgot password", which emails a one-time link. Existing account: promoted, password kept.
insert into users (email, full_name, role, locale)
values ('reachparimi@gmail.com', 'Suresh Parimi', 'admin', 'nl')
on conflict (email) do update set role = 'admin', disabled_at = null, updated_at = now();
insert into audit_log (actor_id, action, target_type, target_id, details)
values (null, 'role_set_migration', 'user', 'reachparimi@gmail.com', '{"role":"admin","migration":"0002_admin_console"}');
