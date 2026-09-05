create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'provider', 'admin');
create type public.request_status as enum ('open', 'matched', 'in_conversation', 'scheduled', 'completed', 'cancelled', 'expired');
create type public.provider_request_status as enum ('invited', 'viewed', 'accepted', 'declined');
create type public.conversation_status as enum ('active', 'scheduled', 'completed', 'closed', 'blocked');
create type public.message_type as enum ('text', 'system');
create type public.notification_type as enum ('new_request', 'new_message', 'request_update', 'workshop_rsvp');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'customer',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null default '',
  postcode text,
  address text,
  website text,
  phone text,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  description text not null,
  postcode text not null,
  preferred_timing text not null,
  status public.request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_providers (
  request_id uuid not null references public.service_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status public.provider_request_status not null default 'invited',
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (request_id, business_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status public.conversation_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id, business_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  message_type public.message_type not null default 'text',
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  request_id uuid references public.service_requests(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index service_requests_customer_idx on public.service_requests(customer_id, created_at desc);
create index request_providers_business_idx on public.request_providers(business_id, status);
create index conversations_customer_idx on public.conversations(customer_id, updated_at desc);
create index conversations_business_idx on public.conversations(business_id, updated_at desc);
create index messages_conversation_idx on public.messages(conversation_id, created_at asc);
create index notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

create or replace function public.is_business_owner(business_uuid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = business_uuid and owner_id = auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'customer');
  business_name text := nullif(trim(coalesce(new.raw_user_meta_data->>'business_name', '')), '');
  business_category text := nullif(trim(coalesce(new.raw_user_meta_data->>'business_category', '')), '');
begin
  if requested_role not in ('customer', 'provider') then requested_role := 'customer'; end if;
  insert into public.profiles(id, full_name, role, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), requested_role::public.user_role, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  if requested_role = 'provider' and business_name is not null then
    insert into public.businesses(owner_id, name, category, description, postcode, website, phone)
    values (new.id, business_name, coalesce(business_category, 'Lokale dienst'), coalesce(new.raw_user_meta_data->>'business_description', ''), new.raw_user_meta_data->>'postcode', new.raw_user_meta_data->>'website', new.raw_user_meta_data->>'phone');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_providers enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;

create policy "profiles own read" on public.profiles for select using (id = auth.uid());
create policy "profiles own update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "businesses public active read" on public.businesses for select using (active = true and verified = true);
create policy "business owners read own" on public.businesses for select using (owner_id = auth.uid());
create policy "business owners update own" on public.businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "customers create requests" on public.service_requests for insert with check (customer_id = auth.uid());
create policy "customers read own requests" on public.service_requests for select using (customer_id = auth.uid());
create policy "providers read matched requests" on public.service_requests for select using (exists (select 1 from public.request_providers rp join public.businesses b on b.id = rp.business_id where rp.request_id = service_requests.id and b.owner_id = auth.uid()));
create policy "customers update own requests" on public.service_requests for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "request participants read matches" on public.request_providers for select using (exists (select 1 from public.service_requests sr where sr.id = request_id and sr.customer_id = auth.uid()) or public.is_business_owner(business_id));
create policy "provider updates own match" on public.request_providers for update using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy "conversation participants read" on public.conversations for select using (customer_id = auth.uid() or public.is_business_owner(business_id));
create policy "customer creates conversation" on public.conversations for insert with check (customer_id = auth.uid());
create policy "conversation participants update" on public.conversations for update using (customer_id = auth.uid() or public.is_business_owner(business_id)) with check (customer_id = auth.uid() or public.is_business_owner(business_id));

create policy "conversation participants read messages" on public.messages for select using (exists (select 1 from public.conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or public.is_business_owner(c.business_id))));
create policy "participants send messages" on public.messages for insert with check (sender_id = auth.uid() and exists (select 1 from public.conversations c where c.id = conversation_id and c.status in ('active','scheduled') and (c.customer_id = auth.uid() or public.is_business_owner(c.business_id))));

create policy "own notifications read" on public.notifications for select using (user_id = auth.uid());
create policy "own notifications update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.conversations;
