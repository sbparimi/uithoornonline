-- Public directory pages need read access to verified, active businesses.
-- Keep writes restricted; only approved rows are exposed by the policy.
grant select on table public.businesses to anon, authenticated;

drop policy if exists "public can read verified businesses" on public.businesses;
create policy "public can read verified businesses"
on public.businesses
for select
to anon, authenticated
using (active = true and verified = true);
