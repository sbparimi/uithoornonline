'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { lp } from '../../../lib/i18n/config';
import { useDict, useLang } from '../../../components/lang-context';
import { useSpamTrap } from '../../../components/spam-trap';

// Option values are stored in the database as-is; only the labels are translated.
const categories = ['Home improvement & renovation', 'Garden & outdoor', 'Plumber', 'Electrician & installation', 'Handyman', 'Cleaning & household', 'Transport & logistics', 'Security & alarm systems', 'Childcare', 'Care & health', 'Hair & beauty', 'Lessons & tutoring', 'Computer & IT help', 'Pets', 'Photography & video', 'Sport & fitness', 'Property services', 'Automotive', 'Family & personal', 'Events & occasions', 'Food & catering', 'Financial & administration', 'Legal advice', 'Professional services'];
const timingOptions = ['Today', 'This week', 'Next week', 'This month', 'Flexible'];
const urgencyOptions = ['As soon as possible', 'Within a week', 'Within a month', 'No urgency'];
const categoryAliases: Record<string, string> = {
  garden: 'Garden & outdoor', 'tuin & buiten': 'Garden & outdoor', 'tuin & groen': 'Garden & outdoor', 'garden & outdoor': 'Garden & outdoor', tuin: 'Garden & outdoor',
  home: 'Home improvement & renovation', 'huis & klus': 'Home improvement & renovation', 'home improvement': 'Home improvement & renovation', 'home improvement & renovation': 'Home improvement & renovation',
  plumber: 'Plumber', loodgieter: 'Plumber', 'loodgieter & elektra': 'Plumber', elektricien: 'Electrician & installation', electrician: 'Electrician & installation',
  beveiliging: 'Security & alarm systems', alarm: 'Security & alarm systems', security: 'Security & alarm systems',
  kinderopvang: 'Childcare', gastouder: 'Childcare', oppas: 'Childcare', childcare: 'Childcare', care: 'Care & health', zorg: 'Care & health',
  bijles: 'Lessons & tutoring', les: 'Lessons & tutoring', computer: 'Computer & IT help', it: 'Computer & IT help', huisdieren: 'Pets', dieren: 'Pets',
  fotograaf: 'Photography & video', fotografie: 'Photography & video', sport: 'Sport & fitness', fitness: 'Sport & fitness',
  handyman: 'Handyman', klus: 'Handyman', klusjesman: 'Handyman',
  cleaning: 'Cleaning & household', schoonmaak: 'Cleaning & household',
  transport: 'Transport & logistics', 'verhuizen & transport': 'Transport & logistics', 'transport & verhuizen': 'Transport & logistics',
  food: 'Food & catering', 'eten & catering': 'Food & catering',
  auto: 'Automotive', 'auto & fiets': 'Automotive', 'auto & vervoer': 'Automotive',
  barber: 'Hair & beauty', kapper: 'Hair & beauty', 'kapper & beauty': 'Hair & beauty',
};
const DRAFT_KEY = 'uithoorn-request-draft';

function resolveCategory(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return categories[0];
  return categoryAliases[normalized] || categories.find((item) => item.toLowerCase() === normalized) || categories.find((item) => item.toLowerCase().includes(normalized)) || categories[0];
}

function validDutchPostcode(value: string) { return /^\d{4}\s?[A-Z]{2}$/i.test(value.trim()); }

export default function RequestForm({ initialCategory = '', initialQuery = '' }: { initialCategory?: string; initialQuery?: string }) {
  const lang = useLang();
  const t = useDict();
  const f = t.requestForm;
  const normalizedCategory = useMemo(() => resolveCategory(initialCategory), [initialCategory]);
  const [category, setCategory] = useState(normalizedCategory);
  const [description, setDescription] = useState(initialQuery);
  const [postcode, setPostcode] = useState('');
  const [preferredTiming, setPreferredTiming] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [urgency, setUrgency] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const { fields: spamFields, trap } = useSpamTrap();

  // Restore what a visitor typed before being sent to the sign-in page.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.category && categories.includes(draft.category)) setCategory(draft.category);
      if (typeof draft.description === 'string') setDescription(draft.description);
      if (typeof draft.postcode === 'string') setPostcode(draft.postcode);
      if (timingOptions.includes(draft.preferredTiming)) setPreferredTiming(draft.preferredTiming);
      if (typeof draft.budgetMin === 'string') setBudgetMin(draft.budgetMin);
      if (typeof draft.budgetMax === 'string') setBudgetMax(draft.budgetMax);
      if (urgencyOptions.includes(draft.urgency)) setUrgency(draft.urgency);
    } catch {}
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    const cleanDescription = description.trim();
    const cleanPostcode = postcode.trim().toUpperCase();
    const min = budgetMin === '' ? null : Number(budgetMin);
    const max = budgetMax === '' ? null : Number(budgetMax);
    if (cleanDescription.length < 15) { setError(f.errDesc); return; }
    if (!validDutchPostcode(cleanPostcode)) { setError(t.common.postcodeError); return; }
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && max < min)) { setError(f.errBudget); return; }
    if (!preferredTiming || !urgency) { setError(f.errTiming); return; }
    setLoading(true);
    try {
      const response = await fetch('/api/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...spamFields, category, description: cleanDescription, postcode: cleanPostcode, preferredTiming, budgetMin, budgetMax, urgency }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ category, description, postcode, preferredTiming, budgetMin, budgetMax, urgency })); } catch {}
        window.location.href = `${lp(lang, '/login')}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      if (!response.ok) {
        setError(data.error === 'invalid_request' ? f.errInvalid : data.error === 'customer_required' ? f.errCustomer : f.errFailed);
        return;
      }
      try { window.sessionStorage.removeItem(DRAFT_KEY); } catch {}
      setSuccess(String(data.id));
      setDescription(''); setPostcode(''); setPreferredTiming(''); setBudgetMin(''); setBudgetMax(''); setUrgency('');
    } catch {
      setError(t.common.network);
    } finally {
      setLoading(false);
    }
  }

  if (success) return <div className="request-success" role="status"><Check aria-hidden="true" /><div><span className="uo-kicker">{f.successKicker}</span><h2>{f.successTitle}</h2><p>{f.successText} <strong>{success.slice(0, 8).toUpperCase()}</strong>.</p><a className="primary platform-button-link" href={lp(lang, '/account')}>{f.successCta} <ArrowRight aria-hidden="true" /></a></div></div>;

  return <form className="request-form" onSubmit={submit} noValidate style={{ position: 'relative' }}>{trap}
    <label>{f.category}<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(item => <option key={item} value={item}>{f.categories[item] ?? item}</option>)}</select></label>
    <label>{f.description}<textarea required minLength={15} value={description} onChange={e => setDescription(e.target.value)} placeholder={f.descPlaceholder} /></label>
    <label>{t.common.postcode}<input required inputMode="text" autoComplete="postal-code" value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="1421 AB" /></label>
    <label>{f.timingLabel}<select required value={preferredTiming} onChange={e => setPreferredTiming(e.target.value)}><option value="" disabled>{t.common.choose}</option>{timingOptions.map(item => <option key={item} value={item}>{f.timing[item] ?? item}</option>)}</select></label>
    <div className="request-budget-fields"><label>{f.budgetMin}<input type="number" inputMode="numeric" min="0" step="1" value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="100" /></label><label>{f.budgetMax}<input type="number" inputMode="numeric" min="0" step="1" value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="500" /></label></div>
    <label>{f.urgencyLabel}<select required value={urgency} onChange={e => setUrgency(e.target.value)}><option value="" disabled>{t.common.choose}</option>{urgencyOptions.map(item => <option key={item} value={item}>{f.urgency[item] ?? item}</option>)}</select></label>
    {error && <p className="platform-error" role="alert" aria-live="assertive">{error}</p>}
    <button className="primary" disabled={loading} type="submit">{loading ? f.sending : f.submit} <ArrowRight aria-hidden="true" /></button>
    <small>{f.note}</small>
  </form>;
}
