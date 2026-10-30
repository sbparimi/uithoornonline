import { errorJson, handle, json } from '@/lib/http';
import { currentPeriod, previewReportEmail, previousPeriod, sendMonthlyReports, validPeriod } from '@/lib/ai-business/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Monthly "Jouw leads" email. Call once on the 1st of the month (e.g. cron-job.org, 08:00 Amsterdam):
//   GET /api/cron/leads-report            -> reports for LAST month
//   ?period=2026-10  ?business=<uuid>  ?dry=1 (lists who would get one, sends nothing)
//   ?business=<uuid>&html=1 (shows that business's email as HTML, sends nothing)
// Header: Authorization: Bearer $CRON_SECRET. Idempotent: calling it again never sends a business the
// same month twice (business_report_runs).
async function run(request: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return errorJson('not_configured', 503);
    if (request.headers.get('authorization') !== `Bearer ${secret}`) return errorJson('unauthorized', 401);
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || previousPeriod(currentPeriod());
    if (!validPeriod(period)) return errorJson('invalid_period', 400);
    const business = url.searchParams.get('business');
    if (business && !/^[0-9a-f-]{36}$/i.test(business)) return errorJson('invalid_business', 400);
    if (url.searchParams.get('html') === '1') {
      if (!business) return errorJson('business_required', 400);
      const mail = await previewReportEmail(business, period);
      if (!mail) return errorJson('not_found', 404);
      return new Response(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
    }
    const result = await sendMonthlyReports(period, { dryRun: url.searchParams.get('dry') === '1', businessId: business || undefined });
    return json(result);
  }, 'cron/leads-report');
}
export const GET = run;
export const POST = run;
