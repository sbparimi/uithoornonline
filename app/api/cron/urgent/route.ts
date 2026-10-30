import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runDueEscalations } from '@/lib/urgent/alerts';
import { runDueRounds } from '@/lib/urgent/quotes';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Spoed escalation scheduler. Called every few minutes by .github/workflows/urgent-tick.yml (Vercel Hobby
// only allows daily crons) or any external cron, with `Authorization: Bearer $CRON_SECRET`.
// Customer status pages and accept pages also advance it opportunistically.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  if (!safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const out = await runDueEscalations(10);
    if (out.ran) console.log('[cron/urgent]', JSON.stringify(out));
    // The same tick also starts due "next 3 businesses" rounds of the AI request flow (no-op when it is off).
    const rounds = await runDueRounds(10).catch((e) => ({ ran: 0, results: [`error: ${e instanceof Error ? e.message : e}`] }));
    if (rounds.ran) console.log('[cron/urgent] rounds', JSON.stringify(rounds));
    return NextResponse.json({ ok: true, ...out, rounds });
  } catch (error) {
    console.error('[cron/urgent] failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'urgent_tick_failed' }, { status: 500 });
  }
}
