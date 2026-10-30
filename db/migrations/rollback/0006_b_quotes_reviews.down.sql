-- Manual rollback of 0006_b_quotes_reviews.sql. Run inside a transaction, then remove the
-- schema_migrations row so the migration could be re-applied later:
--   delete from schema_migrations where name = '0006_b_quotes_reviews.sql';
-- Prefer restoring the Neon snapshot branch taken before applying it when data must be kept as it was.
drop index if exists reviews_business_visible_idx;
alter table reviews drop column if exists source;
drop table if exists quotes;
alter table leads drop column if exists match_round;
drop index if exists service_requests_next_round_idx;
alter table service_requests drop column if exists review_requested_at;
alter table service_requests drop column if exists completed_by;
alter table service_requests drop column if exists completed_at;
alter table service_requests drop column if exists next_round_at;
alter table service_requests drop column if exists match_round;
alter table service_requests drop column if exists quote_mode;
alter table service_requests drop column if exists ai_brief;
