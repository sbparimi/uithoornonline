'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { createClient } from '../lib/supabase/client';

type Role = 'customer' | 'provider';

export default function AccountSignup({ initialRole = 'customer' }: { initialRole?: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [form, setForm] = useState({ name: '', email: '', phone: '', business: '', category: 'Klus & onderhoud', description: '', website: '', postcode: '' });
  const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm((v) => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError('');
    if (role === 'provider' && form.description.trim().length < 20) { setError('Beschrijf je bedrijf in minimaal 20 tekens.'); return; }
    if (role === 'provider' && !/^\d{4}\s?[A-Z]{2}$/i.test(form.postcode.trim())) { setError('Vul een geldige Nederlandse postcode in, bijvoorbeeld 1421 AB.'); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: crypto.randomUUID(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${role === 'provider' ? '/provider' : '/account'}`, data: { full_name: form.name.trim(), phone: form.phone.trim(), role, business_name: form.business.trim(), business_category: form.category, business_description: form.description.trim(), website: form.website.trim(), postcode: form.postcode.trim().toUpperCase() } }
      });
      if (authError) {
        const message = authError.message || '';
        setError(/already registered|already exists/i.test(message) ? 'Er bestaat al een account met dit e-mailadres. Gebruik Inloggen om een nieuwe inloglink te ontvangen.' : message || 'Het account kon niet worden aangemaakt. Probeer het opnieuw.');
        return;
      }
      if (data.session) {
        window.location.href = role === 'provider' ? '/provider' : '/account';
        return;
      }
      setSent(true);
    } catch {
      setError('Er ging iets mis met de verbinding. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }
  if (sent) return <main className="platform-shell"><div className="platform-card"><a className="uo-brand" href="/"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span className="uo-kicker">Registratie</span><h1>Check je e-mail.</h1><p>Je account is aangemaakt. Bevestig je e-mailadres om verder te gaan. Je bedrijfsprofiel blijft onzichtbaar totdat Uithoorn.online het heeft geverifieerd.</p><a className="primary platform-button-link" href="/login">Naar inloggen <ArrowRight /></a></div></main>;
  return <main className="platform-shell"><div className="platform-card wide"><a className="uo-brand" href="/"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span className="uo-kicker">Account</span><h1>Word onderdeel van lokaal.</h1><p>Maak een account als klant of lokale aanbieder.</p><div className="role-switch"><button className={role === 'customer' ? 'active' : ''} onClick={() => setRole('customer')} type="button"><UserRound /> Ik zoek iets</button><button className={role === 'provider' ? 'active' : ''} onClick={() => setRole('provider')} type="button"><BriefcaseBusiness /> Ik bied iets aan</button></div><form className="platform-form" onSubmit={submit}><label>Naam<input required autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} /></label><label>E-mailadres<input type="email" required autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label><label>Telefoon<input autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Optioneel" /></label>{role === 'provider' && <><label>Bedrijfsnaam<input required autoComplete="organization" value={form.business} onChange={(e) => update('business', e.target.value)} /></label><label>Categorie<select value={form.category} onChange={(e) => update('category', e.target.value)}><option>Klus & onderhoud</option><option>Schoonmaak</option><option>Elektricien & installatie</option><option>Tuin & buiten</option><option>Workshop</option><option>Indian food</option></select></label><label>Beschrijving<textarea required minLength={20} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Wat doet je bedrijf en voor welke lokale klanten?" /></label><label>Website<input type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" /></label><label>Postcode<input required inputMode="text" autoComplete="postal-code" value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} placeholder="1421 AB" /></label></>}{error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}<button className="primary" disabled={loading} type="submit">{loading ? 'Account aanmaken…' : 'Account aanmaken'} <ArrowRight /></button></form><a className="platform-secondary-link" href="/login">Al een account? Inloggen</a></div></main>;
}
