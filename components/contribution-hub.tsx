'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Building2, CalendarDays, CheckCircle2, Lightbulb } from 'lucide-react';

type Kind = 'business' | 'event' | 'tip';
const options: Array<{ kind: Kind; title: string; text: string; icon: typeof Building2 }> = [
  { kind: 'business', title: 'Een bedrijf toevoegen', text: 'Help buurtbewoners een lokale onderneming of dienstverlener te vinden.', icon: Building2 },
  { kind: 'event', title: 'Een evenement delen', text: 'Meld een evenement, activiteit, les of initiatief in Uithoorn of De Kwakel.', icon: CalendarDays },
  { kind: 'tip', title: 'Een lokale tip delen', text: 'Deel een handige tip die de buurt echt verder helpt.', icon: Lightbulb },
];

const emptyForm = { name: '', email: '', phone: '', title: '', description: '', category: '', postcode: '', website: '', eventDate: '' };

export default function ContributionHub({ initialKind = 'business' }: { initialKind?: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [form, setForm] = useState(emptyForm);
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorKey, setErrorKey] = useState('');
  const [reference, setReference] = useState('');
  const selected = useMemo(() => options.find((option) => option.kind === kind)!, [kind]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  function choose(next: Kind) { if (state === 'sending') return; setKind(next); setState('idle'); setErrorKey(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('idle'); setErrorKey('');
    const name = form.name.trim(); const email = form.email.trim(); const title = form.title.trim(); const description = form.description.trim();
    if (name.length < 2) { setState('error'); setErrorKey('Ongeldige bijdrage. Controleer je naam, e-mailadres, titel en beschrijving.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setState('error'); setErrorKey('Je e-mailadres is niet geldig.'); return; }
    if (title.length < 3) { setState('error'); setErrorKey('Ongeldige bijdrage. Controleer je naam, e-mailadres, titel en beschrijving.'); return; }
    if (description.length < 15) { setState('error'); setErrorKey('De beschrijving moet minimaal 15 tekens bevatten.'); return; }
    if (kind === 'event' && form.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate)) { setState('error'); setErrorKey('De evenementdatum is niet geldig.'); return; }
    setState('sending');
    try {
      const response = await fetch('/api/community-submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, name, email, title, description, kind }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const key = String(data.error || 'submission_failed');
        setErrorKey(key === 'invalid_submission' ? 'Ongeldige bijdrage. Controleer je naam, e-mailadres, titel en beschrijving.' : key === 'invalid_event_date' ? 'De evenementdatum is niet geldig.' : key === 'submission_unavailable' ? 'Bijdragen zijn tijdelijk niet beschikbaar. Probeer het over een minuut opnieuw.' : 'Er ging iets mis bij het opslaan. Probeer het opnieuw.');
        setState('error');
        return;
      }
      setReference(String(data.id || '').slice(0, 8).toUpperCase()); setState('success');
      setForm(emptyForm);
    } catch {
      setErrorKey('Er ging iets mis met de verbinding. Je gegevens zijn niet opgeslagen. Probeer het opnieuw.');
      setState('error');
    }
  }
  if (state === 'success') return <div className="contribution-success"><CheckCircle2 /><div><span className="uo-kicker">Ingediend</span><h2>Bedankt voor je bijdrage.</h2><p>We hebben je bijdrage ontvangen. Ons team controleert de informatie voordat deze openbaar wordt.</p><strong>Referentie: {reference}</strong><button className="discovery-primary" onClick={() => { setState('idle'); setErrorKey(''); }}>Nog iets delen <ArrowRight /></button></div></div>;
  return <div className="contribution-hub">
    <div className="contribution-options" role="tablist" aria-label="Wat wil je delen?">{options.map(({ kind: optionKind, title, text, icon: Icon }) => <button key={optionKind} type="button" role="tab" aria-selected={kind === optionKind} className={kind === optionKind ? 'active' : ''} onClick={() => choose(optionKind)}><Icon /><span><strong>{title}</strong><small>{text}</small></span></button>)}</div>
    <div className="contribution-form-wrap"><div className="contribution-form-intro"><span className="uo-kicker">{selected.title}</span><h2>Help Uithoorn <em>lokaal</em> sterker te maken.</h2><p>{selected.text} Alles wordt eerst gecontroleerd.</p></div><form className="contribution-form" onSubmit={submit}>
      <div className="contribution-two"><label>Je naam<input required autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} /></label><label>E-mailadres<input required type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label></div>
      <div className="contribution-two"><label>Telefoon <span>(optioneel)</span><input autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label><label>Postcode <span>(optioneel)</span><input autoComplete="postal-code" value={form.postcode} onChange={(e) => update('postcode', e.target.value)} placeholder="1421 AB" /></label></div>
      <label>{kind === 'business' ? 'Bedrijfsnaam' : kind === 'event' ? 'Naam van het evenement' : 'Titel van je tip'}<input required value={form.title} onChange={(e) => update('title', e.target.value)} /></label>
      {kind === 'business' && <div className="contribution-two"><label>Categorie<input value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Bijv. loodgieter, tuin, restaurant" /></label><label>Website <span>(optioneel)</span><input type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" /></label></div>}
      {kind === 'event' && <div className="contribution-two"><label>Datum <span>(optioneel)</span><input type="date" value={form.eventDate} onChange={(e) => update('eventDate', e.target.value)} /></label><label>Categorie<input value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Bijv. muziek, sport, markt" /></label></div>}
      <label>Beschrijving<textarea required minLength={15} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder={kind === 'business' ? 'Wat biedt dit bedrijf aan en voor welke klanten?' : kind === 'event' ? 'Wat gebeurt er, waar is het en voor wie is het bedoeld?' : 'Wat is je tip en waarom is deze nuttig voor Uithoorn?'} /></label>
      {state === 'error' && <p className="platform-error" role="alert" aria-live="assertive">{errorKey}</p>}
      <button className="discovery-primary" disabled={state === 'sending'} type="submit">{state === 'sending' ? 'Bezig met indienen…' : 'Bijdrage indienen'} <ArrowRight /></button><small>Je bijdrage wordt eerst gecontroleerd. Alleen goedgekeurde informatie wordt openbaar gepubliceerd.</small>
    </form></div>
  </div>;
}
