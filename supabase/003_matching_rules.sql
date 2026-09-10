-- Phase 1 marketplace matching: prioritize service relevance and local proximity.
create or replace function public.match_service_request(p_request_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare
  matched integer;
  request_category text;
  request_postcode text;
begin
  select lower(category), left(regexp_replace(postcode, '[^0-9]', '', 'g'), 4)
    into request_category, request_postcode
  from public.service_requests where id = p_request_id and customer_id = auth.uid();
  if request_category is null then raise exception 'not_authorized'; end if;

  insert into public.request_providers(request_id, business_id)
  select p_request_id, b.id
  from public.businesses b
  where b.active = true and b.verified = true
    and lower(b.category) not like '%indian food%'
    and lower(b.category) not like '%workshop%'
    and not exists (select 1 from public.request_providers rp where rp.request_id = p_request_id and rp.business_id = b.id)
    and (
      left(regexp_replace(coalesce(b.postcode, ''), '[^0-9]', '', 'g'), 4) = request_postcode
      or request_postcode = ''
    )
    and (
      (request_category like '%garden%' and lower(b.category || ' ' || b.description) ~ '(garden|tuin|hovenier|landschap|bestrating|schutting|buiten)')
      or (request_category like '%plumb%' and lower(b.category || ' ' || b.description) ~ '(plumb|loodgiet|water|lekkage|verwarming|cv)')
      or (request_category like '%electric%' and lower(b.category || ' ' || b.description) ~ '(elektr|install|electri)')
      or (request_category like '%clean%' and lower(b.category || ' ' || b.description) ~ '(clean|schoon|huishoud|ramen|window)')
      or (request_category like '%transport%' and lower(b.category || ' ' || b.description) ~ '(transport|verhuis|moving|koerier|courier|delivery)')
      or (request_category like '%handyman%' and lower(b.category || ' ' || b.description) ~ '(handyman|klus|montage|reparatie|repair|onderhoud)')
      or (request_category like '%home improvement%' and lower(b.category || ' ' || b.description) ~ '(klus|bouw|renov|schilder|timmer|vloer|paving|tiling|fenc)')
      or (request_category like '%auto%' and lower(b.category || ' ' || b.description) ~ '(auto|garage|car|fiets|bicycle|repair)')
      or (request_category like '%food%' and lower(b.category || ' ' || b.description) ~ '(food|eten|cater|restaurant|bakery)')
      or (request_category like '%beauty%' and lower(b.category || ' ' || b.description) ~ '(barber|kapper|hair|beauty|salon)')
      or lower(b.category || ' ' || b.description) like '%' || split_part(request_category, ' ', 1) || '%'
    )
  order by
    case when left(regexp_replace(coalesce(b.postcode, ''), '[^0-9]', '', 'g'), 4) = request_postcode then 0 else 1 end,
    b.created_at desc
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
