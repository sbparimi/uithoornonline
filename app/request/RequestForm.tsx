'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

const categories = ['Home improvement & renovation','Garden & outdoor','Plumber','Handyman','Cleaning & household','Transport & logistics','Property services','Automotive','Family & personal','Events & occasions','Food & catering','Professional services'];
const timingOptions = ['Today', 'This week', 'Next week', 'This month', 'Flexible'];
const urgencyOptions = ['As soon as possible', 'Within a week', 'Within a month', 'No urgency'];
const categoryAliases: Record<string, string> = {
  'tuin & buiten': 'Garden & outdoor',
  'garden & outdoor': 'Garden & outdoor',
  'garden': 'Garden & outdoor',
  'huis & klus': 'Home improvement & renovation',
  'home improvement': 'Home improvement & renovation',
  'home improvement & renovation': 'Home improvement & renovation',
  'loodgieter': 'Plumber',
  'plumber': 'Plumber',
  'handyman': 'Handyman',
  'klus': 'Handyman',
};

function resolveCategory(value: string) {
  const normalized = value.trim().toLowerCase();
  return categoryAliases[normalized] || categories.find((item) => item.toLowerCase() === normalized) || categories.find((item) => item.toLowerCase().includes(normalized)) || categories[0];
}

function validDutchPostcode(value: string) { return /^\d{4}\s?[A-Z]{2}$/i.test(value.trim()); }

export default function RequestForm({ initialCategory = '' }: { initialCategory?: string }) {
  const normalizedCategory = useMemo(() => resolveCategory(initialCategory), [initialCategory]);
  const [category, setCategory] = useState(normalizedCategory);
  const [description, setDescription] = useState('');
  const [postcode, setPostcode] = useState('');
  const [preferredTiming, setPreferredTiming] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [urgency, setUrgency] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    const cleanDescription = description.trim();
    const cleanPostcode = postcode.trim().toUpperCase();
    const min = budgetMin === '' ? null : Number(budgetMin);
    const max = budgetMax === '' ? null : Number(budgetMax);
    if (cleanDescription.length < 15) { setError('Beschrijf de taak in minimaal 15 tekens.'); return; }
    if (!validDutchPostcode(cleanPostcode)) { setError('Vul een geldige Nederlandse postcode in, bijvoorbeeld 1421 AB.'); return; }
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && max < min)) { setError('Controleer het budget: bedragen moeten positief zijn en het maximum mag niet lager zijn dan het minimum.'); return; }
    if (!preferredTiming || !urgency) { setError('Kies wanneer de klus moet gebeuren en hoe dringend deze is.'); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ category, description: cleanDescription, postcode: cleanPostcode, preferredTiming, budgetMin, budgetMax, urgency }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; return; }
      if (!response.ok) {
        setError(data.error === 'invalid_request' ? 'Vul alle verplichte velden in en controleer je budget.' : data.error === 'customer_required' ? 'Gebruik een klantaccount om een lokale hulpvraag te plaatsen.' : 'Je aanvraag kon niet worden verstuurd. Probeer het opnieuw.');
        return;
      }
      setSuccess(String(data.id));
      setDescription(''); setPostcode(''); setPreferredTiming(''); setBudgetMin(''); setBudgetMax(''); setUrgency('');
    } catch {
      setError('Er ging iets mis. Controleer je internetverbinding en probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  return success ? <div className="request-success"><Check /><div><span className="uo-kicker">Aanvraag ontvangen</span><h2>We gaan dit lokaal regelen.</h2><p>Je aanvraag staat klaar voor passende, geverifieerde lokale aanbieders. Je aanvraagnummer is <strong>{success.slice(0, 8).toUpperCase()}</strong>.</p><a className="primary platform-button-link" href="/account">Bekijk mijn aanvragen <ArrowRight /></a></div></div> : <form className="request-form" onSubmit={submit}>
    <label>Wat moet er geregeld worden?<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
    <label>Beschrijf de taak<textarea required minLength={15} value={description} onChange={e => setDescription(e.target.value)} placeholder="Bijvoorbeeld: Mijn tuin is sterk overwoekerd. Ik wil deze laten renoveren met nieuwe bestrating en beplanting." /></label>
    <label>Postcode<input required inputMode="text" autoComplete="postal-code" value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="1421 AB" /></label>
    <label>Wanneer moet het gebeuren?<select required value={preferredTiming} onChange={e => setPreferredTiming(e.target.value)}><option value="" disabled>Selecteer een optie</option>{timingOptions.map(item => <option key={item}>{item}</option>)}</select></label>
    <div className="request-budget-fields"><label>Budget vanaf (€)<input type="number" min="0" step="1" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="100" /></label><label>Budget tot (€)<input type="number" min="0" step="1" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="500" /></label></div>
    <label>Hoe dringend is de aanvraag?<select required value={urgency} onChange={e => setUrgency(e.target.value)}><option value="" disabled>Selecteer een optie</option>{urgencyOptions.map(item => <option key={item}>{item}</option>)}</select></label>
    {error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}
    <button className="primary" disabled={loading} type="submit">{loading ? 'Aanvraag versturen…' : 'Laat Uithoorn.online dit regelen'} <ArrowRight /></button>
    <small>We delen je aanvraag alleen met relevante, geverifieerde lokale aanbieders. Er wordt in deze fase nog geen task-completion fee in rekening gebracht.</small>
  </form>;
}
