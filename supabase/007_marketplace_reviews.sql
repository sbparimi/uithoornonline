-- Phase 1 marketplace trust: completed jobs can be reviewed by the customer.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  unique (conversation_id, customer_id)
);
create index if not exists reviews_business_idx on public.reviews(business_id, created_at desc);

alter table public.reviews enable row level security;
create policy "public read reviews" on public.reviews for select using (true);
create policy "customers create own reviews" on public.reviews for insert with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.request_id = request_id
      and c.business_id = business_id
      and c.customer_id = auth.uid()
      and c.status = 'completed'
  )
);

create or replace function public.complete_conversation(p_conversation_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare customer_id uuid; business_id uuid; request_id uuid;
begin
  select c.customer_id, c.business_id, c.request_id into customer_id, business_id, request_id
  from public.conversations c
  where c.id = p_conversation_id
    and (c.customer_id = auth.uid() or public.is_business_owner(c.business_id));
  if request_id is null then raise exception 'not_authorized'; end if;
  update public.conversations set status = 'completed', updated_at = now() where id = p_conversation_id;
  update public.service_requests set status = 'completed', updated_at = now() where id = request_id;
  insert into public.notifications(user_id, type, title, body, conversation_id, request_id)
  values (customer_id, 'request_update', 'Opdracht afgerond', 'Je gesprek is gemarkeerd als afgerond. Laat een beoordeling achter voor de aanbieder.', p_conversation_id, request_id);
  return true;
end; $$;
grant execute on function public.complete_conversation(uuid) to authenticated;
