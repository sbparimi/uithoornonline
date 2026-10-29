-- 0003: indexes for the main dashboard/admin sort orders and for foreign keys used by deletes
-- (account deletion, retention job). Additive only; safe to run on a live database.
create index if not exists leads_business_created_idx on leads(business_id, created_at desc);
create index if not exists leads_created_idx on leads(created_at desc);
create index if not exists notifications_user_created_idx on notifications(user_id, created_at desc);
create index if not exists notifications_conversation_idx on notifications(conversation_id) where conversation_id is not null;
create index if not exists notifications_request_idx on notifications(request_id) where request_id is not null;
create index if not exists messages_sender_idx on messages(sender_id) where sender_id is not null;
create index if not exists reviews_customer_idx on reviews(customer_id);
create index if not exists reviews_request_idx on reviews(request_id);
create index if not exists analytics_events_request_idx on analytics_events(request_id) where request_id is not null;
create index if not exists audit_log_actor_idx on audit_log(actor_id) where actor_id is not null;
create index if not exists users_created_idx on users(created_at desc);
create index if not exists businesses_created_idx on businesses(created_at desc);
create index if not exists contact_replies_contact_idx on contact_replies(contact_message_id) where contact_message_id is not null;
create index if not exists contact_replies_inbound_idx on contact_replies(inbound_email_id) where inbound_email_id is not null;
create index if not exists issues_contact_idx on issues(contact_message_id) where contact_message_id is not null;
create index if not exists issues_inbound_idx on issues(inbound_email_id) where inbound_email_id is not null;
create index if not exists issues_business_idx on issues(business_id) where business_id is not null;
create index if not exists payments_created_by_idx on payments(created_by) where created_by is not null;
create index if not exists promotions_business_idx on promotions(business_id);
create index if not exists auth_tokens_email_purpose_idx on auth_tokens(email, purpose) where used_at is null;
