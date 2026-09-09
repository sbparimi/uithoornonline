create table if not exists public.community_submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('business', 'event', 'tip')),
  name text not null,
  email text not null,
  phone text,
  title text not null,
  description text not null,
  category text,
  postcode text,
  website text,
  event_date date,
  status text not null default 'pending' check (status in ('pending','reviewed','rejected','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_submissions_status_idx on public.community_submissions(status, created_at desc);
create index if not exists community_submissions_kind_idx on public.community_submissions(kind, created_at desc);

alter table public.community_submissions enable row level security;
drop policy if exists "public can submit community content" on public.community_submissions;
create policy "public can submit community content" on public.community_submissions
  for insert with check (status = 'pending');
