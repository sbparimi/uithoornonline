import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) return '/account';
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeNext(requestUrl.searchParams.get('next'));
  if (!code) return NextResponse.redirect(new URL(`/login?error=missing_code&next=${encodeURIComponent(next)}`, requestUrl.origin));
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] code exchange failed', error.message);
      return NextResponse.redirect(new URL(`/login?error=callback_failed&next=${encodeURIComponent(next)}`, requestUrl.origin));
    }
  } catch (error) {
    console.error('[auth/callback] request failed', error instanceof Error ? error.message : error);
    return NextResponse.redirect(new URL(`/login?error=callback_failed&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
