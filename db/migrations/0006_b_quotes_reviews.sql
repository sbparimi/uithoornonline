-- 0006 (lane B, customer side): requests for all jobs with AI follow-up questions, best-3 matching with a
-- 24 h "next 3 businesses" fallback, an AI job brief for businesses, business quotes the customer compares
-- and picks, "job done" + verified review requests. Purely additive: new nullable/defaulted columns and one
-- new table, so the running app is unchanged until QUOTE_FLOW_ENABLED=1.
-- Rollback: db/migrations/rollback/0006_b_quotes_reviews.down.sql (or restore the Neon snapshot branch).

-- Requests: AI brief for businesses (labelled AI, indicative price only with a basis), matching rounds,
-- when the next round is due, and the job-done / review-request bookkeeping.
alter table service_requests add column if not exists ai_brief jsonb;
alter table service_requests add column if not exists quote_mode boolean not null default false;
alter table service_requests add column if not exists match_round integer not null default 1;
alter table service_requests add column if not exists next_round_at timestamptz;
alter table service_requests add column if not exists completed_at timestamptz;
alter table service_requests add column if not exists completed_by text check (completed_by is null or completed_by in ('customer', 'business', 'admin'));
alter table service_requests add column if not exists review_requested_at timestamptz;

create index if not exists service_requests_next_round_idx
  on service_requests (next_round_at)
  where next_round_at is not null and accepted_business_id is null;

-- Leads: which matching round a business was picked in (1 = first three).
alter table leads add column if not exists match_round integer not null default 1;

-- Quotes from businesses (from the one-tap job page, no login). The customer compares them on the
-- status page and picks one; the chosen business then gets the customer's contact details.
create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  amount_cents integer check (amount_cents is null or (amount_cents >= 0 and amount_cents <= 100000000)),
  price_type text not null default 'fixed' check (price_type in ('fixed', 'from', 'hourly', 'visit')),
  message text not null default '' check (char_length(message) <= 1000),
  available_from date,
  status text not null default 'sent' check (status in ('sent', 'chosen', 'not_chosen', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, business_id)
);
create index if not exists quotes_request_idx on quotes (request_id, created_at);

-- Reviews: where the review came from ('account' = logged-in form, 'job_link' = the signed link in the
-- review request after a job was marked done). Every review is tied to a real job (conversation).
alter table reviews add column if not exists source text not null default 'account' check (source in ('account', 'job_link'));
create index if not exists reviews_business_visible_idx on reviews (business_id) where hidden = false;
