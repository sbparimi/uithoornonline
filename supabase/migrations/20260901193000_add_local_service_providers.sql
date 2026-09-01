create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  description text,
  categories text[] not null default '{}',
  service_area text not null default 'Uithoorn',
  postcode text,
  phone text,
  email text,
  website text,
  whatsapp text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_providers enable row level security;

grant select, insert, update on public.service_providers to authenticated;
grant all on public.service_providers to service_role;

create policy "Providers can view their own profile" on public.service_providers
  for select to authenticated using (auth.uid() = user_id);
create policy "Providers can create their own profile" on public.service_providers
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Providers can update their own profile" on public.service_providers
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists service_providers_status_idx on public.service_providers(status);
create index if not exists service_providers_categories_idx on public.service_providers using gin(categories);
