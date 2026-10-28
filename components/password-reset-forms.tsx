'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { useLang } from './lang-context';

const T = {
  nl: {
    fKicker: 'Wachtwoord vergeten', fTitle: 'Nieuw wachtwoord aanvragen', fIntro: 'Vul je e-mailadres in. Als er een account bij hoort, sturen we je een link om een nieuw wachtwoord in te stellen. De link werkt één keer en verloopt na 60 minuten.',
    email: 'E-mailadres', send: 'Stuur resetlink', sending: 'Versturen…', sentTitle: 'Check je inbox', sentText: 'Als dit e-mailadres bij een account hoort, staat er binnen een paar minuten een e-mail met een link klaar. Kijk ook in je spammap.',
    rTitle: 'Kies een nieuw wachtwoord', rIntro: 'Minimaal 10 tekens. Na het opslaan ben je ingelogd en op andere apparaten uitgelogd.', pw: 'Nieuw wachtwoord', pw2: 'Herhaal wachtwoord', save: 'Wachtwoord opslaan', saving: 'Opslaan…',
    mismatch: 'De wachtwoorden zijn niet gelijk.', short: 'Gebruik minimaal 10 tekens.', invalid: 'Deze link is ongeldig, al gebruikt of verlopen. Vraag een nieuwe aan.', again: 'Nieuwe link aanvragen',
    rate: 'Te veel pogingen. Probeer het over een uur opnieuw.', unavailable: 'E-mail is nog niet ingesteld. Neem contact met ons op.', failed: 'Er ging iets mis. Probeer het opnieuw.', back: 'Terug naar inloggen', done: 'Gelukt! Je wordt doorgestuurd…',
  },
  en: {
    fKicker: 'Forgot password', fTitle: 'Reset your password', fIntro: "Enter your email address. If it belongs to an account, we'll send you a link to set a new password. The link works once and expires in 60 minutes.",
    email: 'Email address', send: 'Send reset link', sending: 'Sending…', sentTitle: 'Check your inbox', sentText: 'If this email address belongs to an account, an email with a link will arrive within a few minutes. Check your spam folder too.',
    rTitle: 'Choose a new password', rIntro: "At least 10 characters. After saving you're signed in and signed out on other devices.", pw: 'New password', pw2: 'Repeat password', save: 'Save password', saving: 'Saving…',
    mismatch: "The passwords don't match.", short: 'Use at least 10 characters.', invalid: 'This link is invalid, already used or expired. Request a new one.', again: 'Request a new link',
    rate: 'Too many attempts. Try again in an hour.', unavailable: "Email isn't set up yet. Please contact us.", failed: 'Something went wrong. Please try again.', back: 'Back to sign in', done: 'Done! Redirecting…',
  },
};

export function ForgotPasswordForm() {
  const lang = useLang(); const t = T[lang];
  const [email, setEmail] = useState(''); const [loading, setLoading] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), lang }) });
      if (res.ok) setSent(true); else setError(res.status === 429 ? t.rate : res.status === 503 ? t.unavailable : t.failed);
    } catch { setError(t.failed); } finally { setLoading(false); }
  }
  return <div className="platform-card">
    <span className="uo-kicker">{t.fKicker}</span><h1>{t.fTitle}</h1><p>{t.fIntro}</p>
    {sent ? <div className="platform-success" role="status"><Check aria-hidden="true" /><div><strong>{t.sentTitle}</strong><p>{t.sentText}</p></div></div> :
      <form className="platform-form" onSubmit={submit}>
        <label>{t.email}<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {error && <p className="platform-error" role="alert">{error}</p>}
        <button className="primary" disabled={loading} type="submit">{loading ? t.sending : t.send} <ArrowRight aria-hidden="true" /></button>
      </form>}
    <a className="platform-secondary-link" href={lp(lang, '/login')}>{t.back}</a>
  </div>;
}

export function ResetPasswordForm() {
  const lang = useLang(); const t = T[lang];
  const [token, setToken] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [invalid, setInvalid] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token') || '';
    setToken(value); if (!value) setInvalid(true);
    // Drop the token from the address bar (and from any later Referer header).
    if (value) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError('');
    if (pw.length < 10) { setError(t.short); return; }
    if (pw !== pw2) { setError(t.mismatch); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: pw }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setDone(true); window.location.href = data.redirect || lp(lang, '/account'); return; }
      if (data.error === 'invalid_or_expired_token') setInvalid(true); else setError(res.status === 429 ? t.rate : data.error === 'password_too_short' ? t.short : t.failed);
    } catch { setError(t.failed); } finally { setLoading(false); }
  }
  return <div className="platform-card">
    <span className="uo-kicker">{t.fKicker}</span><h1>{t.rTitle}</h1>
    {invalid ? <><p className="platform-error" role="alert">{t.invalid}</p><a className="primary platform-button-link" href={lp(lang, '/forgot-password')}>{t.again} <ArrowRight aria-hidden="true" /></a></> :
      done ? <div className="platform-success" role="status"><Check aria-hidden="true" /><div><strong>{t.done}</strong></div></div> :
      <><p>{t.rIntro}</p><form className="platform-form" onSubmit={submit}>
        <label>{t.pw}<input type="password" required minLength={10} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label>{t.pw2}<input type="password" required minLength={10} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        {error && <p className="platform-error" role="alert">{error}</p>}
        <button className="primary" disabled={loading || !token} type="submit">{loading ? t.saving : t.save} <ArrowRight aria-hidden="true" /></button>
      </form></>}
    <a className="platform-secondary-link" href={lp(lang, '/login')}>{t.back}</a>
  </div>;
}
