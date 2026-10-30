-- 0006: free browser/PWA push notifications for businesses (lane C, instant lead alerts).
-- One row per browser/device a business owner switched notifications on for. No phone numbers.
-- Rollback: db/migrations/rollback/0006_web_push.down.sql
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  failures integer not null default 0
);
create index if not exists push_subscriptions_business_idx on push_subscriptions (business_id);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- The alert log (0005) gets a 'push' channel.
alter table job_alerts drop constraint if exists job_alerts_channel_check;
alter table job_alerts add constraint job_alerts_channel_check check (channel in ('email', 'sms', 'whatsapp', 'voice', 'push'));
