-- Keep customer/provider RPCs callable only by signed-in users.
-- Internal trigger/event functions do not need API execution privileges.
revoke execute on function public.accept_service_request(uuid, uuid) from public, anon;
revoke execute on function public.match_service_request(uuid) from public, anon;
revoke execute on function public.send_conversation_message(uuid, text) from public, anon;
revoke execute on function public.is_business_owner(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

grant execute on function public.accept_service_request(uuid, uuid) to authenticated;
grant execute on function public.match_service_request(uuid) to authenticated;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
