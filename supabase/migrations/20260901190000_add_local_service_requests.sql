create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  details text,
  postcode text,
  status text not null default 'new' check (status in ('new','reviewed','matched','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

create policy "Users can create their own service requests" on public.service_requests for insert with check (auth.uid() = user_id);
create policy "Users can view their own service requests" on public.service_requests for select using (auth.uid() = user_id);
create policy "Users can update their own service requests" on public.service_requests for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists service_requests_user_id_idx on public.service_requests(user_id);
create index if not exists service_requests_status_idx on public.service_requests(status);
