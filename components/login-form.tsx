'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { createClient } from '../lib/supabase/client';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

function getAuthBaseUrl() {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return configured && !isLocal ? configured : window.location.origin;
}

export default function LoginForm() {
  const lang = useLang();
  const t = useDict();
  const l = t.login;
  const fallbackNext = lp(lang, '/account');
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [next, setNext] = useState(fallbackNext); const [callbackError, setCallbackError] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get('next') || fallbackNext);
    setCallbackError(Boolean(params.get('error')));
  }, [fallbackNext]);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : fallbackNext;
      const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${getAuthBaseUrl()}/auth/callback?next=${encodeURIComponent(safeNext)}` } });
      if (authError) setError(l.failed); else setSent(true);
    } catch {
      setError(t.common.network);
    } finally {
      setLoading(false);
    }
  }
  return <div className="platform-card">
    <span className="uo-kicker">{l.kicker}</span><h1>{l.title}</h1><p>{l.intro}</p>
    {callbackError && !sent && <p className="platform-error" role="alert">{l.expired}</p>}
    {sent ? <div className="platform-success" role="status"><Check aria-hidden="true" /><div><strong>{l.sentTitle}</strong><p>{l.sentText}</p></div></div> : <form className="platform-form" onSubmit={submit}><label>{t.common.email}<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={l.placeholder} /></label>{error && <p className="platform-error" role="alert">{error}</p>}<button className="primary" disabled={loading} type="submit">{loading ? l.sending : l.send} <ArrowRight aria-hidden="true" /></button></form>}
    <a className="platform-secondary-link" href={lp(lang, '/signup/account')}>{l.noAccount}</a>
  </div>;
}
