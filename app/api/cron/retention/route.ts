import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runRetention } from '@/lib/data/retention';

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const dynamic = 'force-dynamic';

// Daily data-retention job (vercel.json "crons"). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  if (!safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const deleted = await runRetention();
    console.log('[cron/retention]', JSON.stringify(deleted));
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    console.error('[cron/retention] failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'retention_failed' }, { status: 500 });
  }
}
