-- Manual rollback of 0006_ai_business_profile.sql (not run by scripts/db-migrate.mjs).
-- Deploy the previous app version first. Data in these columns/tables is lost.
begin;
drop table if exists business_report_runs;
drop table if exists business_chat_leads;
alter table businesses
  drop column if exists report_email, drop column if exists chat_enabled, drop column if exists ai_profile,
  drop column if exists kvk_number, drop column if exists faqs, drop column if exists services,
  drop column if exists opening_hours, drop column if exists description_en;
delete from schema_migrations where name = '0006_ai_business_profile.sql';
commit;
