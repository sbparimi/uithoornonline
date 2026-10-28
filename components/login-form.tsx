'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { getBackendDict } from '../lib/i18n/backend';
import { useDict, useLang } from './lang-context';

function safe(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('://') ? next : fallback;
}

export default function LoginForm() {
  const lang = useLang();
  const t = useDict();
  const l = t.login;
  const b = getBackendDict(lang).auth;
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [next, setNext] = useState<string | null>(null); const [callbackError, setCallbackError] = useState(false);
  const [magicAvailable, setMagicAvailable] = useState(false); const [mode, setMode] = useState<'password' | 'link'>('password'); const [linkSent, setLinkSent] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get('next'));
    setCallbackError(Boolean(params.get('error')));
    fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      setMagicAvailable(Boolean(d.magicLink));
      if (d.user) window.location.href = safe(params.get('next'), lp(lang, d.user.role === 'admin' ? '/admin' : d.user.role === 'provider' ? '/provider' : '/account'));
    }).catch(() => undefined);
  }, [lang]);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      if (mode === 'link') {
        const res = await fetch('/api/auth/magic-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), lang, next }) });
        if (res.ok) setLinkSent(true); else setError(res.status === 429 ? b.rateLimited : res.status === 503 ? b.linkUnavailable : l.failed);
        return;
      }
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password, lang }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { window.location.href = safe(next, data.redirect || lp(lang, '/account')); return; }
      setError(res.status === 429 ? b.rateLimited : res.status === 503 ? b.unavailable : b.invalid);
    } catch {
      setError(t.common.network);
    } finally {
      setLoading(false);
    }
  }
  return <div className="platform-card">
    <span className="uo-kicker">{l.kicker}</span><h1>{l.title}</h1><p>{mode === 'link' ? l.intro : b.loginIntro}</p>
    {callbackError && <p className="platform-error" role="alert">{l.expired}</p>}
    {linkSent ? <div className="platform-success" role="status"><Check aria-hidden="true" /><div><strong>{l.sentTitle}</strong><p>{b.linkSent}</p></div></div> :
    <form className="platform-form" onSubmit={submit}>
      <label>{t.common.email}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={l.placeholder} /></label>
      {mode === 'password' && <label>{b.password}<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
      {error && <p className="platform-error" role="alert">{error}</p>}
      <button className="primary" disabled={loading} type="submit">{mode === 'link' ? (loading ? l.sending : b.sendLink) : (loading ? b.loggingIn : b.login)} <ArrowRight aria-hidden="true" /></button>
    </form>}
    {!linkSent && <button type="button" className="platform-secondary-link link-button" onClick={() => { setError(''); if (!magicAvailable) { setError(b.linkUnavailable); return; } setMode(mode === 'password' ? 'link' : 'password'); }}>{mode === 'password' ? b.orLink : b.login}</button>}
    {!linkSent && mode === 'password' && <a className="platform-secondary-link" href={lp(lang, '/forgot-password')}>{lang === 'en' ? 'Forgot your password?' : 'Wachtwoord vergeten?'}</a>}
    <a className="platform-secondary-link" href={lp(lang, '/signup/account')}>{l.noAccount}</a>
  </div>;
}
