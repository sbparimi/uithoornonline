import { errorJson, handle, json } from '@/lib/http';
import { verifyToken } from '@/lib/urgent/tokens';
import { requestStatus, tickQuietly } from '@/lib/urgent/alerts';
import { escalateAfterMinutes, quoteRoundHours } from '@/lib/urgent/flags';
import { quotesForRequest, roundsQuietly } from '@/lib/urgent/quotes';
import { queryOne } from '@/lib/db';
import { signToken } from '@/lib/urgent/tokens';

export const dynamic = 'force-dynamic';

// Live status for the customer's page (polled every ~20 s). Each poll also nudges the spoed
// escalation scheduler, so escalation runs on time while the customer has the page open.
export async function GET(request: Request) {
  return handle(async () => {
    const t = new URL(request.url).searchParams.get('t');
    const ids = verifyToken('status', t);
    if (!ids) return errorJson('invalid_token', 404);
    await tickQuietly(); // advance a due spoed escalation before answering (no-op otherwise)
    await roundsQuietly(); // and a due "next 3 businesses" round of the AI request flow
    const r = await requestStatus(ids[0]);
    if (!r) return errorJson('not_found', 404);
    // Migration 0006 (AI request flow) may not be applied on every database yet: then this is simply null.
    const extra = await queryOne<{ quote_mode: boolean; match_round: number; completed_at: string | null; reviewed: boolean; invited: number; next_round_at: string | null }>(
      `select r.quote_mode, r.match_round, r.completed_at, r.next_round_at,
              exists (select 1 from reviews rv where rv.request_id = r.id and rv.customer_id = r.customer_id) as reviewed,
              (select count(*)::int from leads l where l.request_id = r.id and l.status <> 'locked') as invited
         from service_requests r where r.id = $1`, [ids[0]]).catch(() => null);
    const quoteMode = Boolean(extra?.quote_mode);
    const completed = Boolean(extra?.completed_at) || r.status === 'completed';
    const quotes = quoteMode ? (await quotesForRequest(ids[0])).map((q) => ({
      id: q.id, businessId: q.business_id, business: q.business_name, verified: q.verified, amountCents: q.amount_cents, priceType: q.price_type,
      message: q.message, availableFrom: q.available_from, status: q.status, at: q.created_at, rating: q.rating, reviews: q.reviews,
    })) : [];
    return json({
      category: r.category, level: r.urgency_level, postcode: r.postcode, createdAt: r.created_at, stage: r.escalation_stage, status: r.status,
      alerted: r.alerted, escalated: r.escalated, alertsSentAt: r.alerts_sent_at, escalateMinutes: escalateAfterMinutes(),
      accepted: r.biz_name ? { name: r.biz_name, phone: r.biz_phone, website: r.biz_website, at: r.accepted_at } : null,
      quoteMode, quotes, round: extra?.match_round ?? 1, invited: extra?.invited ?? 0, roundHours: quoteRoundHours(), completed, reviewed: Boolean(extra?.reviewed),
      // Verified review link once the job is done (the customer's own status token proves it is them).
      reviewToken: completed && r.biz_name && !extra?.reviewed ? signToken('review', [ids[0]], 60) : null,
    });
  }, 'intake/status');
}
