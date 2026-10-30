import { after } from 'next/server';
import { errorJson, handle, json } from '@/lib/http';
import { verifyToken } from '@/lib/urgent/tokens';
import { requestStatus, tickQuietly } from '@/lib/urgent/alerts';

export const dynamic = 'force-dynamic';

// Live status for the customer's page (polled every ~20 s). Each poll also nudges the spoed
// escalation scheduler, so escalation runs on time while the customer has the page open.
export async function GET(request: Request) {
  return handle(async () => {
    const t = new URL(request.url).searchParams.get('t');
    const ids = verifyToken('status', t);
    if (!ids) return errorJson('invalid_token', 404);
    after(tickQuietly);
    const r = await requestStatus(ids[0]);
    if (!r) return errorJson('not_found', 404);
    return json({
      category: r.category, level: r.urgency_level, postcode: r.postcode, createdAt: r.created_at, stage: r.escalation_stage, status: r.status,
      alerted: r.alerted, escalated: r.escalated, alertsSentAt: r.alerts_sent_at,
      accepted: r.biz_name ? { name: r.biz_name, phone: r.biz_phone, website: r.biz_website, at: r.accepted_at } : null,
    });
  }, 'intake/status');
}
