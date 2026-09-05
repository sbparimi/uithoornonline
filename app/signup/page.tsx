'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export default function SignupPage() {
  const [role, setRole] = useState<'customer' | 'provider'>('customer');
  const [form, setForm] = useState({ name: '', email: '', phone: '', business: '', category: 'Klus & onderhoud', postcode: '' });
  const [sent, setSent] = useState(false); const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm(v => ({ ...v, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: crypto.randomUUID(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${role === 'provider' ? '/provider' : '/account'}`, data: { full_name: form.name, phone: form.phone, role, business_name: form.business, business_category: form.category, postcode: form.postcode } },
    });
    if (authError) setError(authError.message); else setSent(true);
  }
  if (sent) return <main className="platform-shell"><div className="platform-card"><a className="uo-brand" href="/"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><span className="uo-kicker">Registratie</span><h1>Check je e-mail.</h1><p>Je account is aangemaakt. Bevestig je e-mailadres om verder te gaan.</p><a className="primary platform-button-link" href="/login">Naar inloggen <ArrowRight /></a></div></main>;
  return <main className="platform-shell"><div className="platform-card wide"><a className="uo-brand" href="/"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><span className="uo-kicker">Account</span><h1>Word onderdeel van lokaal.</h1><p>Maak een account als klant of lokale aanbieder.</p><div className="role-switch"><button className={role === 'customer' ? 'active' : ''} onClick={() => setRole('customer')} type="button"><UserRound /> Ik zoek iets</button><button className={role === 'provider' ? 'active' : ''} onClick={() => setRole('provider')} type="button"><BriefcaseBusiness /> Ik bied iets aan</button></div><form className="platform-form" onSubmit={submit}><label>Naam<input required value={form.name} onChange={e => update('name', e.target.value)} /></label><label>E-mailadres<input type="email" required value={form.email} onChange={e => update('email', e.target.value)} /></label><label>Telefoon<input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="Optioneel" /></label>{role === 'provider' && <><label>Bedrijfsnaam<input required value={form.business} onChange={e => update('business', e.target.value)} /></label><label>Categorie<select value={form.category} onChange={e => update('category', e.target.value)}><option>Klus & onderhoud</option><option>Schoonmaak</option><option>Elektricien & installatie</option><option>Tuin & buiten</option><option>Workshop</option><option>Indian food</option></select></label><label>Postcode<input required value={form.postcode} onChange={e => update('postcode', e.target.value)} placeholder="1421AB" /></label></>}{error && <p className="platform-error">{error}</p>}<button className="primary" type="submit">Account aanmaken <ArrowRight /></button></form><a className="platform-secondary-link" href="/login">Al een account? Inloggen</a></div></main>;
}
