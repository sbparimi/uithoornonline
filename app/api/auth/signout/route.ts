import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST(request: Request) {
  await destroySession().catch(() => undefined);
  const accept = request.headers.get('accept') || '';
  if (accept.includes('application/json')) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL('/', request.url), 303);
}
