'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Loader2, Siren, X } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { useLang } from './lang-context';
import { useSpamTrap } from './spam-trap';
import UrgentStatus from './urgent-status';

// "Hulp nodig?" — chat-style intake (docs/URGENT_HANDLING.md). The assistant asks what is wrong,
// classifies it (AI when configured, rules otherwise), then asks how urgent, where and how to reach
// the customer, and creates a normal request. After sending, the live status takes over.

type Level = 'spoed' | 'today' | 'week' | 'flexible';
type Classification = { category: string; urgency: Level; summary: string; tip: string | null; followUp: string | null; source: 'ai' | 'rules'; provider?: string };
type Step = 'problem' | 'thinking' | 'category' | 'followup' | 'urgency' | 'postcode' | 'contact' | 'review' | 'sending' | 'done';
type Msg = { from: 'bot' | 'me'; text: string; tone?: 'tip' };
export type IntakeUser = { name: string; email: string; phone: string | null } | null;

const T = {
  nl: {
    hello: 'Hoi! Ik ben de hulp-assistent van Uithoorn.online. Beschrijf kort wat er aan de hand is, dan zoek ik direct een lokale vakman.',
    problemPh: 'Bijv. "Mijn keukenkraan lekt en ik krijg hem niet meer dicht"', send: 'Verstuur', photos: 'Foto toevoegen', thinking: 'Even kijken…',
    sounds: 'Dat klinkt als', right: 'Klopt de categorie? Pas hem anders aan:', ok: 'Ja, klopt', skip: 'Overslaan', answerPh: 'Je antwoord (optioneel)',
    urgencyQ: 'Hoe dringend is het?', suggestion: 'voorstel', postcodeQ: 'Wat is de postcode van het adres?', postcodeErr: 'Vul een geldige postcode in, bijv. 1421 AB.',
    contactQ: 'Hoe kunnen de vakmensen je bereiken?', name: 'Naam', phone: 'Mobiel nummer', phoneSpoed: 'Mobiel nummer (nodig bij spoed)', email: 'E-mailadres',
    terms: 'Ik ga akkoord met de voorwaarden en privacyverklaring', next: 'Verder', reviewQ: 'Klopt alles? Dan waarschuw ik nu de vakmensen.', confirm: 'Ja, zoek hulp',
    edit: 'Opnieuw beginnen', sending: 'Bezig met versturen…', errors: { generic: 'Er ging iets mis. Probeer het opnieuw.', rate_limited: 'Te veel aanvragen achter elkaar. Probeer het over een uur opnieuw.', phone_required: 'Bij spoed hebben we je mobiele nummer nodig.', invalid_phone: 'Dat telefoonnummer klopt niet.', invalid_email: 'Vul een geldig e-mailadres in.', name_required: 'Vul je naam in.', terms_required: 'Ga akkoord met de voorwaarden.', invalid_request: 'Controleer je beschrijving en postcode.', customer_required: 'Je bent ingelogd als bedrijf. Log uit om als inwoner een aanvraag te doen.', account_unavailable: 'Dit account kan geen aanvragen doen.' },
    levels: { spoed: ['🚨 Spoed', 'nu meteen hulp nodig'], today: ['Vandaag', 'liefst vandaag nog'], week: ['Deze week', 'binnen een paar dagen'], flexible: ['Flexibel', 'geen haast'] } as Record<Level, [string, string]>,
    fields: { what: 'Wat', category: 'Categorie', when: 'Wanneer', where: 'Postcode', who: 'Contact' }, danger: 'Direct gevaar (brand, gas, letsel)? Bel eerst 112.',
    tooShort: 'Vertel iets meer (minstens een paar woorden).', photoNote: 'max. 3 foto’s',
  },
  en: {
    hello: "Hi! I'm the help assistant of Uithoorn.online. Briefly describe what's wrong and I'll find a local professional right away.",
    problemPh: 'E.g. "My kitchen tap is leaking and won\'t close"', send: 'Send', photos: 'Add photo', thinking: 'Let me see…',
    sounds: 'That sounds like', right: 'Is the category right? Change it if not:', ok: 'Yes, correct', skip: 'Skip', answerPh: 'Your answer (optional)',
    urgencyQ: 'How urgent is it?', suggestion: 'suggested', postcodeQ: 'What is the postcode of the address?', postcodeErr: 'Enter a valid postcode, e.g. 1421 AB.',
    contactQ: 'How can the professionals reach you?', name: 'Name', phone: 'Mobile number', phoneSpoed: 'Mobile number (needed for urgent)', email: 'Email',
    terms: 'I agree to the terms and privacy policy', next: 'Next', reviewQ: "All correct? Then I'll alert the professionals now.", confirm: 'Yes, find help',
    edit: 'Start over', sending: 'Sending…', errors: { generic: 'Something went wrong. Please try again.', rate_limited: 'Too many requests. Please try again in an hour.', phone_required: 'For urgent requests we need your mobile number.', invalid_phone: "That phone number doesn't look right.", invalid_email: 'Enter a valid email address.', name_required: 'Enter your name.', terms_required: 'Please accept the terms.', invalid_request: 'Check your description and postcode.', customer_required: "You're signed in as a business. Sign out to post as a resident.", account_unavailable: 'This account cannot post requests.' },
    levels: { spoed: ['🚨 Urgent', 'need help right now'], today: ['Today', 'preferably today'], week: ['This week', 'within a few days'], flexible: ['Flexible', 'no rush'] } as Record<Level, [string, string]>,
    fields: { what: 'What', category: 'Category', when: 'When', where: 'Postcode', who: 'Contact' }, danger: 'Immediate danger (fire, gas, injury)? Call 112 first.',
    tooShort: 'Tell me a bit more (at least a few words).', photoNote: 'max. 3 photos',
  },
};

async function compress(file: File): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', 0.72);
    return url.length < 1_300_000 ? url : canvas.toDataURL('image/jpeg', 0.5);
  } catch { return null; }
}

export default function UrgentIntake({ user, categories }: { user: IntakeUser; categories: [string, string][] }) {
  const lang = useLang();
  const t = T[lang === 'en' ? 'en' : 'nl'];
  const label = (v: string) => categories.find(([k]) => k === v)?.[1] ?? v;
  const { fields: spamFields, trap } = useSpamTrap();
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: t.hello }]);
  const [step, setStep] = useState<Step>('problem');
  const [problem, setProblem] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [ai, setAi] = useState<Classification | null>(null);
  const [category, setCategory] = useState('');
  const [answer, setAnswer] = useState('');
  const [level, setLevel] = useState<Level>('flexible');
  const [postcode, setPostcode] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [statusToken, setStatusToken] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const say = (m: Msg | Msg[]) => setMsgs((prev) => [...prev, ...(Array.isArray(m) ? m : [m])]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, step]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const out: string[] = [];
    for (const f of Array.from(files).slice(0, 3 - photos.length)) { const d = await compress(f); if (d) out.push(d); }
    setPhotos((p) => [...p, ...out].slice(0, 3));
  }

  async function sendProblem(e: FormEvent) {
    e.preventDefault(); setError('');
    const text = problem.trim();
    if (text.length < 8) { setError(t.tooShort); return; }
    say({ from: 'me', text: text + (photos.length ? ` (+${photos.length} 📷)` : '') });
    setStep('thinking');
    let c: Classification;
    try {
      const r = await fetch('/api/intake/classify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang }) });
      if (!r.ok) throw new Error(String(r.status));
      c = await r.json();
    } catch { c = { category: categories[0][0], urgency: 'flexible', summary: text.slice(0, 200), tip: null, followUp: null, source: 'rules' }; }
    setAi(c); setCategory(c.category); setLevel(c.urgency);
    const out: Msg[] = [{ from: 'bot', text: `${t.sounds}: ${label(c.category)}${c.urgency === 'spoed' ? (lang === 'en' ? ' — and it sounds urgent.' : ' — en het klinkt als spoed.') : '.'}` }];
    if (c.tip) out.push({ from: 'bot', text: c.tip, tone: 'tip' });
    out.push({ from: 'bot', text: t.right });
    say(out); setStep('category');
  }

  function confirmCategory() {
    say({ from: 'me', text: label(category) });
    if (ai?.followUp) { say({ from: 'bot', text: ai.followUp }); setStep('followup'); }
    else { say({ from: 'bot', text: t.urgencyQ }); setStep('urgency'); }
  }
  function sendAnswer(skip = false) {
    if (!skip && answer.trim()) say({ from: 'me', text: answer.trim() }); else setAnswer('');
    say({ from: 'bot', text: t.urgencyQ }); setStep('urgency');
  }
  function pickLevel(l: Level) {
    setLevel(l); say([{ from: 'me', text: t.levels[l][0] }, ...(l === 'spoed' ? [{ from: 'bot' as const, text: t.danger, tone: 'tip' as const }] : []), { from: 'bot', text: t.postcodeQ }]); setStep('postcode');
  }
  function sendPostcode(e: FormEvent) {
    e.preventDefault(); setError('');
    const pc = postcode.trim().toUpperCase().replace(/^(\d{4})\s*([A-Z]{2})$/, '$1 $2');
    if (!/^\d{4} [A-Z]{2}$/.test(pc)) { setError(t.postcodeErr); return; }
    setPostcode(pc); say([{ from: 'me', text: pc }, { from: 'bot', text: t.contactQ }]); setStep('contact');
  }
  function sendContact(e: FormEvent) {
    e.preventDefault(); setError('');
    if (!name.trim()) { setError(t.errors.name_required); return; }
    if (level === 'spoed' && phone.replace(/\D/g, '').length < 9) { setError(t.errors.phone_required); return; }
    if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError(t.errors.invalid_email); return; }
    if (!user && !terms) { setError(t.errors.terms_required); return; }
    say([{ from: 'me', text: [name.trim(), phone.trim(), user ? '' : email.trim()].filter(Boolean).join(' · ') }, { from: 'bot', text: t.reviewQ }]); setStep('review');
  }
  async function submit() {
    setError(''); setStep('sending');
    try {
      const r = await fetch('/api/intake/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        ...spamFields, lang, category, description: problem.trim(), followUpAnswer: answer.trim(), followUp: ai?.followUp ?? '', summary: ai?.summary ?? '',
        level, postcode, name: name.trim(), phone: phone.trim(), email: email.trim(), acceptTerms: terms, photos,
        ai: ai?.source === 'ai', provider: ai?.provider ?? '', suggestedCategory: ai?.category ?? '', suggestedLevel: ai?.urgency ?? '',
      }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError((t.errors as Record<string, string>)[data.error] ?? t.errors.generic); setStep('review'); return; }
      setStatusToken(String(data.statusToken)); setStep('done');
    } catch { setError(t.errors.generic); setStep('review'); }
  }

  if (step === 'done' && statusToken) return <UrgentStatus token={statusToken} fresh />;

  return <div className="ui-chat" aria-live="polite">{trap}
    <div className="ui-log">
      {msgs.map((m, i) => <div key={i} className={`ui-msg ui-${m.from}${m.tone === 'tip' ? ' ui-tip' : ''}`}>{m.tone === 'tip' ? <Siren aria-hidden="true" /> : null}<span>{m.text}</span></div>)}
      {step === 'thinking' || step === 'sending' ? <div className="ui-msg ui-bot ui-typing"><Loader2 aria-hidden="true" className="ui-spin" /><span>{step === 'thinking' ? t.thinking : t.sending}</span></div> : null}
      <div ref={endRef} />
    </div>

    <div className="ui-input">
      {step === 'problem' && <form onSubmit={sendProblem}>
        <textarea autoFocus rows={3} maxLength={2000} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder={t.problemPh} aria-label={t.problemPh} />
        <div className="ui-row">
          <label className="ui-photo-btn"><Camera aria-hidden="true" /> {t.photos} <small>({t.photoNote})</small><input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} disabled={photos.length >= 3} /></label>
          <button className="primary" type="submit">{t.send} <ArrowRight aria-hidden="true" /></button>
        </div>
        {photos.length ? <div className="ui-thumbs">{photos.map((p, i) => <span key={i}><img src={p} alt="" /><button type="button" aria-label="x" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}><X aria-hidden="true" /></button></span>)}</div> : null}
      </form>}

      {step === 'category' && <div className="ui-stack">
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t.fields.category}>{categories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="primary" type="button" onClick={confirmCategory}>{category === ai?.category ? t.ok : t.next} <Check aria-hidden="true" /></button>
      </div>}

      {step === 'followup' && <form className="ui-stack" onSubmit={(e) => { e.preventDefault(); sendAnswer(); }}>
        <input autoFocus value={answer} maxLength={600} onChange={(e) => setAnswer(e.target.value)} placeholder={t.answerPh} aria-label={t.answerPh} />
        <div className="ui-row"><button type="button" className="ui-ghost" onClick={() => sendAnswer(true)}>{t.skip}</button><button className="primary" type="submit">{t.next} <ArrowRight aria-hidden="true" /></button></div>
      </form>}

      {step === 'urgency' && <div className="ui-levels">
        {(['spoed', 'today', 'week', 'flexible'] as Level[]).map((l) => <button key={l} type="button" className={`ui-level ui-level-${l}${ai?.urgency === l ? ' ui-suggested' : ''}`} onClick={() => pickLevel(l)}>
          <strong>{t.levels[l][0]}</strong><small>{t.levels[l][1]}{ai?.urgency === l ? ` · ${t.suggestion}` : ''}</small></button>)}
      </div>}

      {step === 'postcode' && <form className="ui-stack" onSubmit={sendPostcode}>
        <input autoFocus autoComplete="postal-code" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="1421 AB" aria-label={t.fields.where} />
        <button className="primary" type="submit">{t.next} <ArrowRight aria-hidden="true" /></button>
      </form>}

      {step === 'contact' && <form className="ui-form" onSubmit={sendContact}>
        <label>{t.name}<input autoFocus autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></label>
        <label>{level === 'spoed' ? t.phoneSpoed : t.phone}<input type="tel" autoComplete="tel" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} placeholder="06 12345678" /></label>
        {!user && <label>{t.email}<input type="email" autoComplete="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} /></label>}
        {!user && <label className="ui-check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> <span>{t.terms} (<a href={lp(lang, '/voorwaarden')} target="_blank">{lang === 'en' ? 'terms' : 'voorwaarden'}</a>, <a href={lp(lang, '/privacy')} target="_blank">privacy</a>)</span></label>}
        <button className="primary" type="submit">{t.next} <ArrowRight aria-hidden="true" /></button>
      </form>}

      {(step === 'review' || step === 'sending') && <div className="ui-review">
        <dl>
          <div><dt>{t.fields.what}</dt><dd>{ai?.summary || problem}</dd></div>
          <div><dt>{t.fields.category}</dt><dd>{label(category)}</dd></div>
          <div><dt>{t.fields.when}</dt><dd>{t.levels[level][0]}</dd></div>
          <div><dt>{t.fields.where}</dt><dd>{postcode}</dd></div>
          <div><dt>{t.fields.who}</dt><dd>{[name, phone, user ? user.email : email].filter(Boolean).join(' · ')}</dd></div>
        </dl>
        <div className="ui-row">
          <button type="button" className="ui-ghost" disabled={step === 'sending'} onClick={() => { setMsgs([{ from: 'bot', text: t.hello }]); setStep('problem'); setAi(null); setAnswer(''); setError(''); }}>{t.edit}</button>
          <button className="primary" type="button" disabled={step === 'sending'} onClick={submit}>{step === 'sending' ? t.sending : t.confirm} <ArrowRight aria-hidden="true" /></button>
        </div>
      </div>}

      {error ? <p className="platform-error" role="alert">{error}</p> : null}
    </div>
  </div>;
}
