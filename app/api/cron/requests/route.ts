import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runDueRounds } from '@/lib/urgent/quotes';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// "No quote within 24 h → the next 3 businesses" (docs/AI_REQUESTS.md). Idempotent: due rows are claimed
// with FOR UPDATE SKIP LOCKED, so calling it every minute (or twice at once) never double-invites.
// Header `Authorization: Bearer $CRON_SECRET`. /api/cron/urgent runs it too, and status pages nudge it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  if (!safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const out = await runDueRounds(10);
    if (out.ran) console.log('[cron/requests]', JSON.stringify(out));
    return NextResponse.json({ ok: true, ...out });
  } catch (error) {
    console.error('[cron/requests] failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'requests_tick_failed' }, { status: 500 });
  }
}
