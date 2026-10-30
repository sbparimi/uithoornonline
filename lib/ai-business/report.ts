import 'server-only';
import { query, queryOne } from '../db';
import { sendEmailDetailed } from '../email/send';
import { layout, localPath, siteUrl } from '../email/templates';
import { notMigrated } from './profile';

// Monthly "Jouw leads" report per business: what Uithoorn.online did for them this month.
// Same numbers on the dashboard page (/provider/leads) and in the monthly email.

export type Report = {
  period: string; views: number; phone: number; website: number; whatsapp: number; chatOpens: number;
  chatLeads: number; requests: number; accepted: number; total: number;
};

export function currentPeriod(at = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit' }).format(at);
  return p.slice(0, 7);
}
export function previousPeriod(period: string) {
  const [y, m] = period.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
export const validPeriod = (p: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(p);

const RANGE = `($2 || '-01')::timestamp at time zone 'Europe/Amsterdam'`;
const RANGE_END = `(($2 || '-01')::timestamp + interval '1 month') at time zone 'Europe/Amsterdam'`;

async function safeCount(sql: string, params: unknown[]): Promise<number> {
  try { return (await queryOne<{ n: number }>(sql, params))?.n ?? 0; } catch (e) { if (notMigrated(e)) return 0; throw e; }
}

export async function computeReport(businessId: string, period: string): Promise<Report> {
  const ev = await query<{ event_name: string; n: number }>(
    `select event_name, count(*)::int as n from analytics_events where business_id = $1 and created_at >= ${RANGE} and created_at < ${RANGE_END}
      and event_name in ('business_view','phone_click','website_click','whatsapp_click','chat_open') group by event_name`, [businessId, period]);
  const e = (n: string) => ev.find((r) => r.event_name === n)?.n ?? 0;
  const chatLeads = await safeCount(`select count(*)::int as n from business_chat_leads where business_id = $1 and status <> 'spam' and created_at >= ${RANGE} and created_at < ${RANGE_END}`, [businessId, period]);
  const requests = await safeCount(`select count(distinct request_id)::int as n from (
      select request_id from leads where business_id = $1 and created_at >= ${RANGE} and created_at < ${RANGE_END}
      union select request_id from job_alerts where business_id = $1 and audience = 'business' and stage in ('initial','escalation') and status = 'sent' and created_at >= ${RANGE} and created_at < ${RANGE_END}) x`, [businessId, period])
    || await safeCount(`select count(distinct request_id)::int as n from leads where business_id = $1 and created_at >= ${RANGE} and created_at < ${RANGE_END}`, [businessId, period]);
  const accepted = await safeCount(`select count(distinct id)::int as n from (
      select id from service_requests where accepted_business_id = $1 and accepted_at >= ${RANGE} and accepted_at < ${RANGE_END}
      union select request_id as id from conversations where business_id = $1 and created_at >= ${RANGE} and created_at < ${RANGE_END}) x`, [businessId, period])
    || await safeCount(`select count(*)::int as n from conversations where business_id = $1 and created_at >= ${RANGE} and created_at < ${RANGE_END}`, [businessId, period]);
  const r = { period, views: e('business_view'), phone: e('phone_click'), website: e('website_click'), whatsapp: e('whatsapp_click'), chatOpens: e('chat_open'), chatLeads, requests, accepted, total: 0 };
  r.total = r.phone + r.website + r.whatsapp + r.chatLeads + r.requests;
  return r;
}

export type ChatLeadRow = { id: string; name: string; email: string | null; phone: string | null; question: string; created_at: string; status: string };
export async function recentChatLeads(businessId: string, limit = 20): Promise<ChatLeadRow[]> {
  try { return await query<ChatLeadRow>('select id, name, email, phone, question, created_at, status from business_chat_leads where business_id = $1 order by created_at desc limit $2', [businessId, limit]); }
  catch (e) { if (notMigrated(e)) return []; throw e; }
}

export function monthName(period: string, lang: 'nl' | 'en') {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nl-NL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function reportEmail(lang: 'nl' | 'en', businessName: string, r: Report, prev: Report) {
  const L = (nl: string, en: string) => (lang === 'en' ? en : nl);
  const delta = (a: number, b: number) => (b ? ` (${a >= b ? '+' : ''}${a - b} ${L('t.o.v. vorige maand', 'vs last month')})` : '');
  const month = monthName(r.period, lang);
  const contacts = r.phone + r.website + r.whatsapp;
  const intro = r.total || r.views
    ? L(`In ${month} keken ${r.views} mensen naar je pagina op Uithoorn.online en namen ${r.total} keer contact op of stuurden een aanvraag.`, `In ${month}, ${r.views} people viewed your page on Uithoorn.online and ${r.total} got in touch or sent a request.`)
    : L(`In ${month} was het nog rustig op je pagina. Een compleet profiel (met openingstijden, diensten en veelgestelde vragen) wordt vaker gevonden. Met "Maak mijn profiel met AI" is dat in 2 minuten klaar.`, `${month} was quiet on your page. A complete profile (opening hours, services, FAQs) gets found more often. "Build my profile with AI" does it in 2 minutes.`);
  return layout(lang, L(`Jouw leads in ${month}: ${businessName}`, `Your leads in ${month}: ${businessName}`), {
    heading: L(`Jouw leads in ${month}`, `Your leads in ${month}`),
    paragraphs: [intro],
    rows: [
      [L('Bekeken', 'Page views'), `${r.views}${delta(r.views, prev.views)}`],
      [L('Gebeld / website / WhatsApp', 'Calls / website / WhatsApp'), `${r.phone} / ${r.website} / ${r.whatsapp}`],
      [L('Vragen via de AI-assistent', 'Questions via the AI assistant'), String(r.chatLeads)],
      [L('Klusaanvragen voor jou', 'Job requests for you'), String(r.requests)],
      [L('Klussen aangenomen', 'Jobs accepted'), String(r.accepted)],
      [L('Totaal contact', 'Total contacts'), `${contacts + r.chatLeads + r.requests}${delta(r.total, prev.total)}`],
    ],
    button: { label: L('Bekijk je leads', 'View your leads'), url: `${siteUrl()}${localPath(lang, '/provider/leads')}` },
    note: L('Je krijgt dit overzicht één keer per maand. Uitzetten kan op dezelfde pagina.', 'You get this summary once a month. You can switch it off on the same page.'),
  });
}

/** The email exactly as a business would get it, for a preview (cron route with ?html=1). Sends nothing. */
export async function previewReportEmail(businessId: string, period: string) {
  const b = await queryOne<{ name: string; locale: string | null }>(`select b.name, u.locale from businesses b left join users u on u.id = b.owner_id where b.id = $1`, [businessId]);
  if (!b) return null;
  const lang = b.locale === 'en' ? 'en' : 'nl';
  const [r, prev] = await Promise.all([computeReport(businessId, period), computeReport(businessId, previousPeriod(period))]);
  return reportEmail(lang, b.name, r, prev);
}

/**
 * Sends the report for `period` to every approved, active business whose owner has an email and has
 * not switched it off. Idempotent: a business+month is claimed in business_report_runs first, so a
 * repeated call (cron retry, double trigger) sends nothing twice.
 */
export async function sendMonthlyReports(period: string, opts: { dryRun?: boolean; businessId?: string; limit?: number } = {}) {
  const rows = await query<{ id: string; name: string; email: string; locale: string | null }>(
    `select b.id, b.name, u.email, u.locale from businesses b join users u on u.id = b.owner_id
      where b.moderation_status = 'approved' and b.active = true and b.report_email = true and u.disabled_at is null
        and ($1::uuid is null or b.id = $1::uuid)
        and not exists (select 1 from business_report_runs r where r.business_id = b.id and r.period = $2 and r.status <> 'failed')
      order by b.created_at limit $3`, [opts.businessId ?? null, period, Math.min(500, opts.limit ?? 200)]);
  const results: { business: string; status: string }[] = [];
  for (const b of rows) {
    if (opts.dryRun) { results.push({ business: b.name, status: 'would_send' }); continue; }
    const claimed = await queryOne<{ business_id: string }>(`insert into business_report_runs(business_id, period) values ($1, $2) on conflict (business_id, period) do update set status = 'claimed', created_at = now() where business_report_runs.status = 'failed' returning business_id`, [b.id, period]);
    if (!claimed) { results.push({ business: b.name, status: 'already_done' }); continue; }
    const lang = b.locale === 'en' ? 'en' : 'nl';
    const [r, prev] = await Promise.all([computeReport(b.id, period), computeReport(b.id, previousPeriod(period))]);
    const mail = reportEmail(lang, b.name, r, prev);
    const sent = await sendEmailDetailed({ to: b.email, subject: mail.subject, text: mail.text, html: mail.html, kind: 'leads_report', lang, ref: `leads_report:${b.id}:${period}` });
    await query('update business_report_runs set status = $3 where business_id = $1 and period = $2', [b.id, period, sent.status === 'sent' ? 'sent' : sent.status]);
    results.push({ business: b.name, status: sent.status });
  }
  return { period, count: results.length, results };
}
