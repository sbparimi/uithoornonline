'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { createClient } from '../lib/supabase/client';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

type Role = 'customer' | 'provider';
// Values are stored as-is; labels are translated.
const providerCategories = ['Klus & onderhoud', 'Schoonmaak', 'Elektricien & installatie', 'Tuin & buiten', 'Workshop', 'Indian food'];

function getAuthBaseUrl() {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  return configured && !isLocal ? configured : window.location.origin;
}

export default function AccountSignup({ initialRole = 'customer' }: { initialRole?: Role }) {
  const lang = useLang();
  const t = useDict();
  const s = t.signup;
  const [role, setRole] = useState<Role>(initialRole);
  const [form, setForm] = useState({ name: '', email: '', phone: '', business: '', category: providerCategories[0], description: '', website: '', postcode: '' });
  const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError('');
    if (role === 'provider' && form.description.trim().length < 20) { setError(s.errDesc); return; }
    if (role === 'provider' && !/^\d{4}\s?[A-Z]{2}$/i.test(form.postcode.trim())) { setError(t.common.postcodeError); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const destination = lp(lang, role === 'provider' ? '/provider' : '/account');
      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: crypto.randomUUID(),
        options: { emailRedirectTo: `${getAuthBaseUrl()}/auth/callback?next=${encodeURIComponent(destination)}`, data: { full_name: form.name.trim(), phone: form.phone.trim(), role, business_name: form.business.trim(), business_category: form.category, business_description: form.description.trim(), website: form.website.trim(), postcode: form.postcode.trim().toUpperCase() } }
      });
      if (authError) {
        const message = authError.message || '';
        setError(/already registered|already exists/i.test(message) ? s.errExists : s.errFailed);
        return;
      }
      if (data.session) { window.location.href = destination; return; }
      setSent(true);
    } catch {
      setError(t.common.network);
    } finally {
      setLoading(false);
    }
  }
  if (sent) return <div className="platform-card" role="status"><span className="uo-kicker">{s.sentKicker}</span><h1>{s.sentTitle}</h1><p>{s.sentText}</p><a className="primary platform-button-link" href={lp(lang, '/login')}>{s.toLogin} <ArrowRight aria-hidden="true" /></a></div>;
  return <div className="platform-card wide"><span className="uo-kicker">{s.kicker}</span><h1>{s.title}</h1><p>{s.intro}</p>
    <div className="role-switch" role="group"><button className={role === 'customer' ? 'active' : ''} aria-pressed={role === 'customer'} onClick={() => setRole('customer')} type="button"><UserRound aria-hidden="true" /> {s.customer}</button><button className={role === 'provider' ? 'active' : ''} aria-pressed={role === 'provider'} onClick={() => setRole('provider')} type="button"><BriefcaseBusiness aria-hidden="true" /> {s.provider}</button></div>
    <form className="platform-form" onSubmit={submit}>
      <label>{t.common.name}<input required autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
      <label>{t.common.email}<input type="email" required autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
      <label>{t.common.phone}<input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder={s.phonePlaceholder} /></label>
      {role === 'provider' && <>
        <label>{t.common.businessName}<input required autoComplete="organization" value={form.business} onChange={(e) => update('business', e.target.value)} /></label>
        <label>{t.common.category}<select value={form.category} onChange={(e) => update('category', e.target.value)}>{providerCategories.map((value) => <option key={value} value={value}>{s.categories[value] ?? value}</option>)}</select></label>
        <label>{t.common.description}<textarea required minLength={20} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder={s.descPlaceholder} /></label>
        <label>{t.common.website}<input type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" /></label>
        <label>{t.common.postcode}<input required inputMode="text" autoComplete="postal-code" value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} placeholder="1421 AB" /></label>
      </>}
      {error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}
      <button className="primary" disabled={loading} type="submit">{loading ? s.sending : s.submit} <ArrowRight aria-hidden="true" /></button>
    </form>
    <a className="platform-secondary-link" href={lp(lang, '/login')}>{s.haveAccount}</a>
  </div>;
}
