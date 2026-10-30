'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Lightbulb } from 'lucide-react';
import { useDict, useLang } from './lang-context';
import { SignupAiFill } from './ai-business/signup-ai-fill';
import '../app/ai-business.css';
import { useSpamTrap } from './spam-trap';

type Kind = 'business' | 'tip';
const icons: Record<Kind, typeof Building2> = { business: Building2, tip: Lightbulb };
const kinds: Kind[] = ['business', 'tip'];
const emptyForm = { name: '', email: '', phone: '', title: '', description: '', category: '', postcode: '', website: '' };

export default function ContributionHub({ initialKind = 'business' }: { initialKind?: Kind }) {
  const t = useDict();
  const lang = useLang();
  const c = t.contribution;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [form, setForm] = useState(emptyForm);
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');
  const [reference, setReference] = useState('');
  const { fields: spamFields, trap } = useSpamTrap();
  const [selectedTitle, selectedText] = c.options[kind];
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  function choose(next: Kind) { if (state === 'sending') return; setKind(next); setState('idle'); setErrorText(''); }
  function fail(text: string) { setState('error'); setErrorText(text); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('idle'); setErrorText('');
    const name = form.name.trim(); const email = form.email.trim(); const title = form.title.trim(); const description = form.description.trim();
    if (name.length < 2 || title.length < 3) return fail(c.errInvalid);
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(c.errEmail);
    if (description.length < 15) return fail(c.errDesc);
    setState('sending');
    try {
      const response = await fetch('/api/community-submissions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, ...spamFields, name, email, title, description, kind }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const key = String(data.error || 'submission_failed');
        return fail(key === 'invalid_submission' ? c.errInvalid : key === 'submission_unavailable' ? c.errUnavailable : c.errFailed);
      }
      setReference(String(data.id || '').slice(0, 8).toUpperCase()); setState('success');
      setForm(emptyForm);
    } catch {
      fail(c.errNetwork);
    }
  }
  if (state === 'success') return <div className="contribution-success" role="status"><CheckCircle2 aria-hidden="true" /><div><span className="uo-kicker">{c.successKicker}</span><h2>{c.successTitle}</h2><p>{c.successText}</p>{reference && <strong>{c.reference} {reference}</strong>}<button className="discovery-primary" onClick={() => { setState('idle'); setErrorText(''); }}>{c.again} <ArrowRight aria-hidden="true" /></button></div></div>;
  return <div className="contribution-hub">
    <div className="contribution-options" role="tablist" aria-label={c.tablist}>{kinds.map((optionKind) => { const Icon = icons[optionKind]; const [title, text] = c.options[optionKind]; return <button key={optionKind} type="button" role="tab" aria-selected={kind === optionKind} className={kind === optionKind ? 'active' : ''} onClick={() => choose(optionKind)}><Icon aria-hidden="true" /><span><strong>{title}</strong><small>{text}</small></span></button>; })}</div>
    <div className="contribution-form-wrap"><div className="contribution-form-intro"><span className="uo-kicker">{selectedTitle}</span><h2>{c.formTitle[0]}<em>{c.formTitle[1]}</em>{c.formTitle[2]}</h2><p>{selectedText} {c.checked}</p></div><form className="contribution-form" onSubmit={submit} noValidate style={{ position: 'relative' }}>{trap}
      <div className="contribution-two"><label>{c.yourName}<input required autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} /></label><label>{t.common.email}<input required type="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label></div>
      <div className="contribution-two"><label>{t.common.phone} <span>{t.common.optional}</span><input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label><label>{t.common.postcode} <span>{t.common.optional}</span><input autoComplete="postal-code" value={form.postcode} onChange={(e) => update('postcode', e.target.value)} placeholder="1421 AB" /></label></div>
      {kind === 'business' && <SignupAiFill lang={lang} variant="listing" onFill={(d) => setForm((v) => ({ ...v, title: v.title || d.name || '', category: v.category || d.category || '', description: v.description || d.description || '', postcode: v.postcode || d.postcode || '', website: v.website || d.website || '' }))} />}
      <label>{kind === 'business' ? t.common.businessName : c.tipTitle}<input required value={form.title} onChange={(e) => update('title', e.target.value)} /></label>
      {kind === 'business' && <div className="contribution-two"><label>{t.common.category}<input value={form.category} onChange={(e) => update('category', e.target.value)} placeholder={c.categoryPlaceholder} /></label><label>{t.common.website} <span>{t.common.optional}</span><input type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://" /></label></div>}
      <label>{t.common.description}<textarea required minLength={15} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder={kind === 'business' ? c.descBusiness : c.descTip} /></label>
      {state === 'error' && <p className="platform-error" role="alert" aria-live="assertive">{errorText}</p>}
      <button className="discovery-primary" disabled={state === 'sending'} type="submit">{state === 'sending' ? c.sending : c.submit} <ArrowRight aria-hidden="true" /></button><small>{c.note}</small>
    </form></div>
  </div>;
}
