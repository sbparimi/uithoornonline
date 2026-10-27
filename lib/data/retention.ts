import 'server-only';
import { query } from '../db';

// Retention rules (also stated in the privacy policy). Run daily by /api/cron/retention.
export const RETENTION = {
  requestsMonths: 24,          // help requests, their leads, conversations and messages
  inactiveAccountMonths: 36,   // resident accounts with no login and no business for 3 years
  contactMonths: 24,           // contact form messages and community submissions
  analyticsMonths: 26,         // first-party, anonymous event counts
  emailLogMonths: 12,          // email delivery log
  auditMonths: 24,             // admin action log
};

export async function runRetention() {
  const r = RETENTION;
  const out: Record<string, number> = {};
  const run = async (name: string, sql: string) => { const rows = await query<{ n: number }>(`with d as (${sql} returning 1) select count(*)::int as n from d`); out[name] = rows[0]?.n ?? 0; };
  await run('requests', `delete from service_requests where created_at < now() - interval '${r.requestsMonths} months'`);
  await run('inactive_accounts', `delete from users where role = 'customer' and coalesce(last_login_at, created_at) < now() - interval '${r.inactiveAccountMonths} months' and not exists (select 1 from businesses b where b.owner_id = users.id)`);
  await run('contact_messages', `delete from contact_messages where created_at < now() - interval '${r.contactMonths} months'`);
  await run('community_submissions', `delete from community_submissions where created_at < now() - interval '${r.contactMonths} months'`);
  await run('analytics_events', `delete from analytics_events where created_at < now() - interval '${r.analyticsMonths} months'`);
  await run('email_outbox', `delete from email_outbox where created_at < now() - interval '${r.emailLogMonths} months'`);
  await run('audit_log', `delete from audit_log where created_at < now() - interval '${r.auditMonths} months'`);
  await run('sessions', `delete from sessions where expires_at < now()`);
  await run('auth_tokens', `delete from auth_tokens where expires_at < now() - interval '1 day'`);
  await run('rate_limits', `delete from rate_limits where window_start < now() - interval '2 days'`);
  return out;
}
