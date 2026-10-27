-- 0001_init.sql — Uithoorn.online schema for Neon Postgres (replaces the old Supabase schema).
-- Access model: the database is reached ONLY from server code (Next.js route handlers and server
-- components) through lib/db.ts. Browsers never talk to the database. Authorization is enforced in
-- lib/data/* and lib/auth/*; the rules that closed the old Supabase holes are noted inline.

create extension if not exists citext;

-- Roles keep the old values: customer = resident ("bewoner"), provider = business ("bedrijf"), admin.
create type user_role as enum ('customer', 'provider', 'admin');
create type request_status as enum ('open', 'matched', 'in_conversation', 'scheduled', 'completed', 'cancelled', 'expired');
create type provider_request_status as enum ('invited', 'viewed', 'accepted', 'declined');
create type conversation_status as enum ('active', 'scheduled', 'completed', 'closed', 'blocked');
create type message_type as enum ('text', 'system');
create type notification_type as enum ('new_request', 'new_message', 'request_update', 'system');
create type moderation_status as enum ('pending', 'approved', 'rejected');

-- Accounts (replaces auth.users + public.profiles). The role can only be changed by an admin
-- (lib/data/admin.ts); there is no self-service path that writes `role`.
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text,
  email_verified_at timestamptz,
  full_name text not null default '',
  phone text,
  role user_role not null default 'customer',
  locale text not null default 'nl' check (locale in ('nl', 'en')),
  terms_accepted_at timestamptz,
  disabled_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_len check (char_length(email) between 3 and 254),
  constraint users_name_len check (char_length(full_name) <= 120),
  constraint users_phone_len check (phone is null or char_length(phone) <= 40)
);

-- Server-side sessions. Only the SHA-256 of the cookie token is stored.
create table sessions (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  auth_method text not null default 'password' check (auth_method in ('password', 'email_link')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);
create index sessions_expiry_idx on sessions(expires_at);

-- One-time tokens for magic-link login / email verification / password reset (hashed).
create table auth_tokens (
  token_hash text primary key,
  email citext not null,
  purpose text not null check (purpose in ('login', 'verify', 'reset')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_email_idx on auth_tokens(email, created_at desc);

-- Businesses. owner_id is nullable so unclaimed listings can exist.
-- `verified`, `featured`, `moderation_status` and `active` are admin-only fields: the owner update
-- path (lib/data/businesses.ts updateOwnBusiness) has a fixed column allow-list without them.
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (char_length(category) <= 120),
  description text not null default '' check (char_length(description) <= 3000),
  postcode text check (postcode is null or char_length(postcode) <= 10),
  address text check (address is null or char_length(address) <= 200),
  website text check (website is null or char_length(website) <= 300),
  phone text check (phone is null or char_length(phone) <= 40),
  moderation_status moderation_status not null default 'pending',
  moderation_note text,
  verified boolean not null default false,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index businesses_owner_idx on businesses(owner_id);
create index businesses_public_idx on businesses(moderation_status, active, featured desc, name);

create table service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references users(id) on delete cascade,
  category text not null check (char_length(category) <= 120),
  description text not null check (char_length(description) between 10 and 3000),
  postcode text not null check (char_length(postcode) <= 10),
  preferred_timing text not null check (char_length(preferred_timing) <= 120),
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  urgency text not null default 'flexible' check (char_length(urgency) <= 40),
  status request_status not null default 'open',
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_requests_budget_check check ((budget_min is null or budget_min >= 0) and (budget_max is null or budget_max >= 0) and (budget_min is null or budget_max is null or budget_max >= budget_min))
);
create index service_requests_customer_idx on service_requests(customer_id, created_at desc);
create index service_requests_created_idx on service_requests(created_at desc);

create table request_providers (
  request_id uuid not null references service_requests(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status provider_request_status not null default 'invited',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (request_id, business_id)
);
create index request_providers_business_idx on request_providers(business_id, status);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  customer_id uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status conversation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, business_id)
);
create index conversations_customer_idx on conversations(customer_id, updated_at desc);
create index conversations_business_idx on conversations(business_id, updated_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid references users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  message_type message_type not null default 'text',
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on messages(conversation_id, created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  conversation_id uuid references conversations(id) on delete cascade,
  request_id uuid references service_requests(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, read_at, created_at desc);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  request_id uuid not null references service_requests(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  hidden boolean not null default false,
  hidden_reason text,
  created_at timestamptz not null default now(),
  unique (conversation_id, customer_id)
);
create index reviews_business_idx on reviews(business_id, created_at desc);

create table community_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('business', 'event', 'tip')),
  name text not null,
  email citext not null,
  phone text,
  title text not null,
  description text not null,
  category text,
  postcode text,
  website text,
  event_date date,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'rejected', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_submissions_status_idx on community_submissions(status, created_at desc);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email citext not null,
  subject text not null default '' check (char_length(subject) <= 200),
  body text not null check (char_length(body) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'handled', 'spam')),
  created_at timestamptz not null default now()
);
create index contact_messages_created_idx on contact_messages(created_at desc);

-- Plans and subscriptions. Payment-provider neutral (Mollie later); today an admin sets the plan
-- after a manual (WhatsApp/bank) payment.
create table business_plans (
  key text primary key check (key in ('free', 'pro', 'pro_plus')),
  name text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  included_leads integer not null default 3 check (included_leads >= 0),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
insert into business_plans(key, name, monthly_price_cents, included_leads, featured) values
  ('free', 'Gratis', 0, 3, false),
  ('pro', 'Pro', 2900, 15, false),
  ('pro_plus', 'Pro+', 5900, 50, true);

create table business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  plan_key text not null default 'free' references business_plans(key),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'cancelled', 'incomplete')),
  payment_provider text check (payment_provider is null or payment_provider in ('manual', 'mollie', 'stripe')),
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_end timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Leads. status 'locked' = the business was over its monthly plan limit when the lead arrived:
-- the row exists (so the owner can see demand / upsell), but the request details are withheld
-- server-side until the plan allows it.
create table leads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'locked', 'viewed', 'accepted', 'declined', 'contacted', 'converted', 'closed')),
  qualified boolean not null default true,
  price_cents integer not null default 0 check (price_cents >= 0),
  billable boolean not null default false,
  counts_toward_limit boolean not null default true,
  viewed_at timestamptz,
  accepted_at timestamptz,
  contacted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, business_id)
);
create index leads_business_status_idx on leads(business_id, status, created_at desc);
create index leads_business_month_idx on leads(business_id, created_at) where counts_toward_limit;
create index leads_request_idx on leads(request_id);

-- Promotions are admin-managed only (the old schema let owners create their own).
create table promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  placement text not null check (placement in ('homepage_spotlight', 'category_spotlight', 'search_sponsored', 'local_spotlight')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  price_cents integer not null default 4900 check (price_cents >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index promotions_active_idx on promotions(placement, status, start_at, end_at);

-- First-party event counts (no cookies, no IP stored).
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  business_id uuid references businesses(id) on delete set null,
  request_id uuid references service_requests(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on analytics_events(event_name, created_at desc);
create index analytics_events_business_idx on analytics_events(business_id, created_at desc);

-- Fixed-window rate limiting shared by all serverless instances.
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);
create index rate_limits_window_idx on rate_limits(window_start);

-- Every transactional email attempt (sent, or skipped because no provider key is configured).
create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  subject text not null,
  kind text not null,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index email_outbox_created_idx on email_outbox(created_at desc);

-- Admin actions, for accountability.
create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on audit_log(created_at desc);

-- Every business gets the free plan row on creation.
create or replace function ensure_business_free_subscription() returns trigger language plpgsql as $$
begin
  insert into business_subscriptions(business_id, plan_key, status) values (new.id, 'free', 'active') on conflict (business_id) do nothing;
  return new;
end; $$;
create trigger business_gets_free_plan after insert on businesses for each row execute procedure ensure_business_free_subscription();

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create trigger users_touch before update on users for each row execute procedure touch_updated_at();
create trigger businesses_touch before update on businesses for each row execute procedure touch_updated_at();
create trigger service_requests_touch before update on service_requests for each row execute procedure touch_updated_at();
create trigger conversations_touch before update on conversations for each row execute procedure touch_updated_at();
create trigger leads_touch before update on leads for each row execute procedure touch_updated_at();
