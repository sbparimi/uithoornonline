-- Uithoorn.online monetization + marketplace foundation
create table if not exists public.business_plans (
  key text primary key check (key in ('free','pro','pro_plus')),
  name text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  included_leads integer not null default 3 check (included_leads >= 0),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.business_plans(key,name,monthly_price_cents,included_leads,featured) values
('free','Gratis',0,3,false),
('pro','Pro',2900,15,false),
('pro_plus','Pro+',5900,50,true)
on conflict (key) do update set name=excluded.name, monthly_price_cents=excluded.monthly_price_cents, included_leads=excluded.included_leads, featured=excluded.featured;

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan_key text not null default 'free' references public.business_plans(key),
  status text not null default 'active' check (status in ('active','trialing','past_due','cancelled','incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists business_subscriptions_plan_idx on public.business_subscriptions(plan_key,status);
insert into public.business_subscriptions(business_id,plan_key,status) select b.id,'free','active' from public.businesses b on conflict (business_id) do nothing;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'new' check (status in ('new','viewed','accepted','declined','contacted','converted','closed')),
  qualified boolean not null default true,
  price_cents integer not null default 1000 check (price_cents >= 0),
  billable boolean not null default false,
  viewed_at timestamptz,
  accepted_at timestamptz,
  contacted_at timestamptz,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,business_id)
);
create index if not exists leads_business_status_idx on public.leads(business_id,status,created_at desc);
create index if not exists leads_request_idx on public.leads(request_id,created_at desc);

create or replace function public.create_lead_for_match() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.leads(request_id,business_id) values (new.request_id,new.business_id) on conflict (request_id,business_id) do nothing;
  return new;
end; $$;
drop trigger if exists request_provider_creates_lead on public.request_providers;
create trigger request_provider_creates_lead after insert on public.request_providers for each row execute procedure public.create_lead_for_match();
insert into public.leads(request_id,business_id) select rp.request_id,rp.business_id from public.request_providers rp on conflict (request_id,business_id) do nothing;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  placement text not null check (placement in ('homepage_spotlight','category_spotlight','search_sponsored','local_spotlight')),
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  price_cents integer not null default 4900 check (price_cents >= 0),
  impressions integer not null default 0 check (impressions >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists promotions_active_idx on public.promotions(placement,status,start_at,end_at);
create index if not exists promotions_business_idx on public.promotions(business_id,status);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  business_id uuid references public.businesses(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete set null,
  promotion_id uuid references public.promotions(id) on delete set null,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events(event_name,created_at desc);
create index if not exists analytics_events_business_idx on public.analytics_events(business_id,created_at desc);

alter table public.business_plans enable row level security;
alter table public.business_subscriptions enable row level security;
alter table public.leads enable row level security;
alter table public.promotions enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "public can read business plans" on public.business_plans;
create policy "public can read business plans" on public.business_plans for select to anon,authenticated using (true);
drop policy if exists "business owners read subscription" on public.business_subscriptions;
create policy "business owners read subscription" on public.business_subscriptions for select to authenticated using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists "business owners read leads" on public.leads;
create policy "business owners read leads" on public.leads for select to authenticated using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists "business owners update leads" on public.leads;
create policy "business owners update leads" on public.leads for update to authenticated using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists "business owners manage promotions" on public.promotions;
create policy "business owners manage promotions" on public.promotions for all to authenticated using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists "business owners read analytics" on public.analytics_events;
create policy "business owners read analytics" on public.analytics_events for select to authenticated using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
drop policy if exists "public can insert analytics" on public.analytics_events;
create policy "public can insert analytics" on public.analytics_events for insert to anon,authenticated with check (event_name in ('page_view','search','search_result_click','business_view','business_contact','phone_click','whatsapp_click','website_click','request_started','request_submitted','lead_created','promotion_impression','promotion_click'));

create or replace function public.ensure_business_free_subscription() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.business_subscriptions(business_id,plan_key,status) values (new.id,'free','active') on conflict (business_id) do nothing;
  return new;
end; $$;
drop trigger if exists business_gets_free_plan on public.businesses;
create trigger business_gets_free_plan after insert on public.businesses for each row execute procedure public.ensure_business_free_subscription();

create or replace function public.update_lead_status(p_lead_id uuid,p_status text) returns boolean language plpgsql security definer set search_path=public as $$
declare b_id uuid;
begin
  select l.business_id into b_id from public.leads l where l.id=p_lead_id;
  if b_id is null or not exists(select 1 from public.businesses b where b.id=b_id and b.owner_id=auth.uid()) then raise exception 'not_authorized'; end if;
  if p_status not in ('viewed','accepted','declined','contacted','converted','closed') then raise exception 'invalid_status'; end if;
  update public.leads set status=p_status, viewed_at=case when p_status='viewed' and viewed_at is null then now() else viewed_at end, accepted_at=case when p_status='accepted' then now() else accepted_at end, contacted_at=case when p_status='contacted' then now() else contacted_at end, converted_at=case when p_status='converted' then now() else converted_at end, updated_at=now() where id=p_lead_id;
  return true;
end; $$;
grant execute on function public.update_lead_status(uuid,text) to authenticated;
