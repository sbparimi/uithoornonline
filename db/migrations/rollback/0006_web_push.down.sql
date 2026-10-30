-- Rollback of 0006_web_push.sql. Run manually, then: delete from schema_migrations where name = '0006_web_push.sql';
delete from job_alerts where channel = 'push';
alter table job_alerts drop constraint if exists job_alerts_channel_check;
alter table job_alerts add constraint job_alerts_channel_check check (channel in ('email', 'sms', 'whatsapp', 'voice'));
drop table if exists push_subscriptions;
