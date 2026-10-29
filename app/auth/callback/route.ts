import { NextResponse } from 'next/server';
import { consumeAuthTokenFor } from '@/lib/auth/tokens';
import { createSession } from '@/lib/auth/session';
import { findUserByEmail, markEmailVerified } from '@/lib/data/users';
import { isSafeLocalPath } from '../../../lib/safe-path';

function safeNext(value: string | null) {
  return isSafeLocalPath(value) ? value : null;
}

// Magic-link landing: one-time token -> session cookie -> redirect.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const next = safeNext(url.searchParams.get('next'));
  const fail = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, url.origin));
  try {
    // Only sign-in tokens: a reset link must go through /reset-password (it ends other sessions).
    const consumed = await consumeAuthTokenFor(token, 'login');
    if (!consumed) return fail('link_invalid');
    const user = await findUserByEmail(consumed.email);
    if (!user || user.disabled_at) return fail('link_invalid');
    await markEmailVerified(user.id);
    await createSession(user.id, 'email_link');
    const prefix = user.locale === 'en' ? '/en' : '';
    const home = user.role === 'admin' ? '/admin' : user.role === 'provider' ? '/provider' : '/account';
    return NextResponse.redirect(new URL(next ?? `${prefix}${home}`, url.origin));
  } catch (error) {
    console.error('[auth/callback] failed', error instanceof Error ? error.message : error);
    return fail('callback_failed');
  }
}
