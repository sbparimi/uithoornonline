-- Run after schema.sql.
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer,
  price_cents integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.workshop_rsvps (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  seats integer not null default 1 check (seats between 1 and 20),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled','waitlist')),
  created_at timestamptz not null default now(),
  unique(workshop_id, customer_id)
);

create index workshops_start_idx on public.workshops(starts_at) where active = true;
create index workshop_rsvps_customer_idx on public.workshop_rsvps(customer_id, created_at desc);

alter table public.workshops enable row level security;
alter table public.workshop_rsvps enable row level security;
create policy "public active workshops read" on public.workshops for select using (active = true);
create policy "organizers manage own workshops" on public.workshops for all using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "customers create own rsvp" on public.workshop_rsvps for insert with check (customer_id = auth.uid());
create policy "customers read own rsvp" on public.workshop_rsvps for select using (customer_id = auth.uid());
create policy "customers update own rsvp" on public.workshop_rsvps for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "organizers read rsvps" on public.workshop_rsvps for select using (exists (select 1 from public.workshops w where w.id = workshop_id and w.organizer_id = auth.uid()));

create policy "admins read businesses" on public.businesses for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins update businesses" on public.businesses for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins read profiles" on public.profiles for select using (id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admins read requests" on public.service_requests for select using (customer_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
