-- Keep service requests away from workshop and Indian-food listings.
create or replace function public.match_service_request(p_request_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare matched integer;
begin
  if not exists (select 1 from public.service_requests where id = p_request_id and customer_id = auth.uid()) then raise exception 'not_authorized'; end if;
  insert into public.request_providers(request_id, business_id)
  select p_request_id, b.id
  from public.businesses b
  where b.active = true and b.verified = true
    and lower(b.category) not like '%indian food%'
    and lower(b.category) not like '%workshop%'
    and not exists (select 1 from public.request_providers rp where rp.request_id = p_request_id and rp.business_id = b.id)
  limit 10;
  get diagnostics matched = row_count;
  update public.service_requests set status = case when matched > 0 then 'matched' else 'open' end, updated_at = now() where id = p_request_id;
  insert into public.notifications(user_id, type, title, body, request_id)
  select b.owner_id, 'new_request', 'Nieuwe lokale aanvraag', 'Er is een nieuwe aanvraag die past bij jouw bedrijf.', p_request_id
  from public.businesses b join public.request_providers rp on rp.business_id = b.id
  where rp.request_id = p_request_id and rp.status = 'invited';
  return matched;
end; $$;
grant execute on function public.match_service_request(uuid) to authenticated;
