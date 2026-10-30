-- Manual rollback of 0005_urgent_handling.sql (not run by scripts/db-migrate.mjs).
-- Run only after switching the URGENT_* / JOB_ALERTS_* flags off. Data in these columns/tables is lost.
begin;
drop table if exists request_photos;
drop table if exists job_alerts;
drop index if exists service_requests_escalation_due_idx;
alter table service_requests
  drop column if exists alerts_sent_at, drop column if exists escalation_index, drop column if exists escalation_next_at,
  drop column if exists escalation_stage, drop column if exists accepted_via, drop column if exists accepted_at,
  drop column if exists accepted_business_id, drop column if exists intake, drop column if exists contact_email,
  drop column if exists contact_phone, drop column if exists contact_name, drop column if exists source,
  drop column if exists urgency_level;
alter table businesses
  drop column if exists quiet_end, drop column if exists quiet_start, drop column if exists spoed_24_7,
  drop column if exists alert_phone, drop column if exists alert_whatsapp, drop column if exists alert_sms,
  drop column if exists alert_email;
delete from schema_migrations where name = '0005_urgent_handling.sql';
commit;
