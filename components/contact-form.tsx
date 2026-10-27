'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useLang } from './lang-context';
import { getBackendDict } from '../lib/i18n/backend';
import { useSpamTrap } from './spam-trap';

export function ContactForm() {
  const lang = useLang();
  const c = getBackendDict(lang).contact;
  const { fields, trap } = useSpamTrap();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault(); if (state === 'sending') return; setError(''); setState('sending');
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, ...fields }) });
      if (res.ok) { setState('sent'); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error === 'rate_limited' ? c.rateLimited : c.failed);
    } catch { setError(c.failed); }
    setState('idle');
  }
  if (state === 'sent') return <div className="platform-success" role="status"><Check aria-hidden="true" /><div><strong>{c.sent}</strong></div></div>;
  return <form className="platform-form" onSubmit={submit} style={{ position: 'relative' }}>
    {trap}
    <label>{c.name}<input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
    <label>{c.email}<input type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
    <label>{c.subject}<input maxLength={200} value={form.subject} onChange={(e) => update('subject', e.target.value)} /></label>
    <label>{c.message}<textarea required minLength={10} maxLength={5000} rows={6} value={form.message} onChange={(e) => update('message', e.target.value)} /></label>
    <p className="platform-note">{c.privacyNote}</p>
    {error && <p className="platform-error" role="alert">{error}</p>}
    <button className="primary" type="submit" disabled={state === 'sending'}>{state === 'sending' ? c.sending : c.send} <ArrowRight aria-hidden="true" /></button>
  </form>;
}
