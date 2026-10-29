'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { getBackendDict } from '../lib/i18n/backend';
import { useSpamTrap } from './spam-trap';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';

type Role = 'customer' | 'provider';
// Values are stored as-is; labels are translated.
// Same list as the provider profile form (lead matching uses the category), plus the two older values.
const providerCategories = ['Klus & onderhoud', 'Schoonmaak', 'Elektricien & installatie', 'Tuin & buiten', 'Loodgieter', 'Transport & logistiek', 'Automotive', 'Kapper & beauty', 'Eten & catering', 'Professionele diensten', 'Workshop', 'Indian food'];

export default function AccountSignup({ initialRole = 'customer' }: { initialRole?: Role }) {
  const lang = useLang();
  const t = useDict();
  const s = t.signup;
  const b = getBackendDict(lang).auth;
  const { fields, trap } = useSpamTrap();
  const [password, setPassword] = useState(''); const [accept, setAccept] = useState(false);
  const [role, setRole] = useState<Role>(initialRole);
  const [form, setForm] = useState({ name: '', email: '', phone: '', business: '', category: providerCategories[0], description: '', website: '', postcode: '' });
  const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError('');
    if (role === 'provider' && form.description.trim().length < 20) { setError(s.errDesc); return; }
    if (role === 'provider' && !/^\d{4}\s?[A-Z]{2}$/i.test(form.postcode.trim())) { setError(t.common.postcodeError); return; }
    if (password.length < 10) { setError(b.weakPassword); return; }
    if (!accept) { setError(b.termsRequired); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fields, email: form.email.trim(), password, fullName: form.name.trim(), phone: form.phone.trim(), role, businessName: form.business.trim(), businessCategory: form.category, businessDescription: form.description.trim(), website: form.website.trim(), postcode: form.postcode.trim().toUpperCase(), acceptTerms: accept, lang }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { window.location.href = data.redirect || lp(lang, role === 'provider' ? '/provider' : '/account'); return; }
      setError(data.error === 'email_exists' ? s.errExists : data.error === 'password_too_short' ? b.weakPassword : data.error === 'terms_required' ? b.termsRequired : data.error === 'invalid_postcode' ? t.common.postcodeError : data.error === 'invalid_website' ? t.common.websiteError : data.error === 'rate_limited' ? b.rateLimited : s.errFailed);
    } catch {
      setError(t.common.network);
    } finally {
      setLoading(false);
    }
  }
  if (sent) return <div className="platform-card" role="status"><span className="uo-kicker">{s.sentKicker}</span><h1>{s.sentTitle}</h1><p>{s.sentText}</p><a className="primary platform-button-link" href={lp(lang, '/login')}>{s.toLogin} <ArrowRight aria-hidden="true" /></a></div>;
  return <div className="platform-card wide"><span className="uo-kicker">{s.kicker}</span><h1>{s.title}</h1><p>{s.intro}</p>
    <div className="role-switch" role="group"><button className={role === 'customer' ? 'active' : ''} aria-pressed={role === 'customer'} onClick={() => setRole('customer')} type="button"><UserRound aria-hidden="true" /> {s.customer}</button><button className={role === 'provider' ? 'active' : ''} aria-pressed={role === 'provider'} onClick={() => setRole('provider')} type="button"><BriefcaseBusiness aria-hidden="true" /> {s.provider}</button></div>
    <form className="platform-form" onSubmit={submit} style={{ position: 'relative' }}>
      <label>{t.common.name}<input required autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
      <label>{t.common.email}<input type="email" required autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label>
      <label>{b.password}<input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><small>{b.passwordHint}</small></label>
      <label>{t.common.phone}<input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder={s.phonePlaceholder} /></label>
      {role === 'provider' && <>
        <label>{t.common.businessName}<input required autoComplete="organization" value={form.business} onChange={(e) => update('business', e.target.value)} /></label>
        <label>{t.common.category}<select value={form.category} onChange={(e) => update('category', e.target.value)}>{providerCategories.map((value) => <option key={value} value={value}>{s.categories[value] ?? t.provider.profileCategories[value] ?? value}</option>)}</select></label>
        <label>{t.common.description}<textarea required minLength={20} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder={s.descPlaceholder} /></label>
        <label>{t.common.website}<input type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" /></label>
        <label>{t.common.postcode}<input required inputMode="text" autoComplete="postal-code" value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} placeholder="1421 AB" /></label>
      </>}
      <label className="checkbox-row"><input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)} /> <span>{b.acceptTerms} <a href={lp(lang, '/voorwaarden')} target="_blank" rel="noopener">{b.terms}</a> {b.and} <a href={lp(lang, '/privacy')} target="_blank" rel="noopener">{b.privacy}</a>{b.read}</span></label>
      {trap}
      {error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}
      <button className="primary" disabled={loading} type="submit">{loading ? s.sending : s.submit} <ArrowRight aria-hidden="true" /></button>
    </form>
    <a className="platform-secondary-link" href={lp(lang, '/login')}>{s.haveAccount}</a>
  </div>;
}
