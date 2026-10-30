'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, Check, Loader2, Siren, X } from 'lucide-react';
import { lp } from '../lib/i18n/config';
import { useLang } from './lang-context';
import { useSpamTrap } from './spam-trap';
import UrgentStatus from './urgent-status';
import WhatsAppFallback, { type WaContext } from './whatsapp-fallback';

// "Hulp nodig?" — chat-style intake (docs/URGENT_HANDLING.md). The assistant asks what is wrong,
// classifies it (AI when configured, rules otherwise), then asks how urgent, where and how to reach
// the customer, and creates a normal request. After sending, the live status takes over.

type Level = 'spoed' | 'today' | 'week' | 'flexible';
type Classification = { category: string; urgency: Level; summary: string; tip: string | null; followUp: string | null; source: 'ai' | 'rules'; provider?: string };
type Step = 'problem' | 'thinking' | 'category' | 'followup' | 'urgency' | 'loadingQ' | 'questions' | 'photoNudge' | 'postcode' | 'contact' | 'review' | 'sending' | 'done';
type Question = { q: string; options: string[] };
type Answer = { q: string; a: string };
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
    photoErr: 'Deze foto kon niet worden toegevoegd. Probeer een andere foto, of ga verder zonder.',
    aiDown: 'De assistent is even niet bereikbaar. Kies hieronder zelf de juiste categorie.', aiDownWa: 'De assistent is even niet bereikbaar. Kies hieronder zelf de juiste categorie, of stuur ons direct een WhatsApp.',
    timeout: 'Het versturen duurt te lang. Controleer je internetverbinding en probeer het opnieuw.',
    helloQuotes: 'Hoi! Ik ben de assistent van Uithoorn.online. Vertel kort wat je nodig hebt: een spoedklus, of een offerte voor bijvoorbeeld een badkamer, schilder, tuin of oppas.',
    qIntro: 'Nog een paar korte vragen, dan kunnen de bedrijven je een goede offerte sturen.', qLoading: 'Ik bedenk de juiste vragen…', qOther: 'Of typ je eigen antwoord', qOf: (i: number, n: number) => `Vraag ${i} van ${n}`,
    photoAsk: 'Heb je een foto van de situatie? Daarmee krijg je een preciezere offerte.', photoSkip: 'Geen foto', photoDone: 'Verder', answers: 'Details',
    reviewQQuotes: 'Klopt alles? Dan stuur ik je vraag naar de 3 best passende bedrijven. Je contactgegevens gaan pas naar een bedrijf als je zijn offerte kiest.', confirmQuotes: 'Ja, vraag offertes aan',
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
    photoErr: "This photo couldn't be added. Try another photo, or continue without one.",
    aiDown: "The assistant isn't available right now. Please pick the right category below.", aiDownWa: "The assistant isn't available right now. Please pick the right category below, or message us on WhatsApp.",
    timeout: 'Sending is taking too long. Check your internet connection and try again.',
    helloQuotes: "Hi! I'm the assistant of Uithoorn.online. Tell me briefly what you need: an urgent repair, or a quote for e.g. a bathroom, painter, garden or babysitter.",
    qIntro: 'A few short questions, so the businesses can send you a good quote.', qLoading: 'Thinking of the right questions…', qOther: 'Or type your own answer', qOf: (i: number, n: number) => `Question ${i} of ${n}`,
    photoAsk: 'Do you have a photo of the situation? It gets you a more precise quote.', photoSkip: 'No photo', photoDone: 'Next', answers: 'Details',
    reviewQQuotes: "All correct? Then I'll send your request to the 3 best-matching businesses. Your contact details only go to a business once you choose its quote.", confirmQuotes: 'Yes, get quotes',
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

const timeout = (ms: number) => (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined);

export default function UrgentIntake({ user, categories, whatsapp = null, quotes = false }: { user: IntakeUser; categories: [string, string][]; whatsapp?: string | null; quotes?: boolean }) {
  const lang = useLang();
  const t = T[lang === 'en' ? 'en' : 'nl'];
  const label = (v: string) => categories.find(([k]) => k === v)?.[1] ?? v;
  const { fields: spamFields, trap } = useSpamTrap();
  const hello = quotes ? t.helloQuotes : t.hello;
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: hello }]);
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
  const [trouble, setTrouble] = useState(''); // why the WhatsApp fallback is shown prominently (ai_failed, …)
  // AI request flow (quotes): 2-4 follow-up questions with tap-to-answer options.
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [qInput, setQInput] = useState('');
  const [qSource, setQSource] = useState('');
  const quoteFlow = quotes && level !== 'spoed';
  const endRef = useRef<HTMLDivElement>(null);
  const say = (m: Msg | Msg[]) => setMsgs((prev) => [...prev, ...(Array.isArray(m) ? m : [m])]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, step]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const out: string[] = [];
    let failed = false;
    for (const f of Array.from(files).slice(0, 3 - photos.length)) { const d = await compress(f); if (d) out.push(d); else failed = true; }
    setPhotos((p) => [...p, ...out].slice(0, 3));
    if (failed) { setError(t.photoErr); setTrouble('photo_failed'); }
  }

  async function sendProblem(e: FormEvent) {
    e.preventDefault(); setError(''); if (trouble === 'photo_failed') setTrouble('');
    const text = problem.trim();
    if (text.length < 8) { setError(t.tooShort); return; }
    say({ from: 'me', text: text + (photos.length ? ` (+${photos.length} 📷)` : '') });
    setStep('thinking');
    let c: Classification;
    let aiDown = false;
    try {
      const r = await fetch('/api/intake/classify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, lang }), signal: timeout(25_000) });
      if (!r.ok) throw new Error(String(r.status));
      c = await r.json();
      if (!c || typeof c.category !== 'string' || !categories.some(([k]) => k === c.category)) throw new Error('bad_answer');
    } catch {
      c = { category: categories[0][0], urgency: 'flexible', summary: text.slice(0, 200), tip: null, followUp: null, source: 'rules' };
      aiDown = true; setTrouble('ai_failed');
    }
    setAi(c); setCategory(c.category); setLevel(c.urgency);
    const out: Msg[] = aiDown ? [{ from: 'bot', text: whatsapp ? t.aiDownWa : t.aiDown }] : [{ from: 'bot', text: `${t.sounds}: ${label(c.category)}${c.urgency === 'spoed' ? (lang === 'en' ? ' — and it sounds urgent.' : ' — en het klinkt als spoed.') : '.'}` }];
    if (c.tip) out.push({ from: 'bot', text: c.tip, tone: 'tip' });
    if (!aiDown) out.push({ from: 'bot', text: t.right });
    say(out); setStep('category');
  }

  function confirmCategory() {
    say({ from: 'me', text: label(category) });
    // Quotes on: timing first, then (non-urgent) the AI follow-up questions; spoed keeps its single question.
    if (quotes) { say({ from: 'bot', text: t.urgencyQ }); setStep('urgency'); return; }
    if (ai?.followUp) { say({ from: 'bot', text: ai.followUp }); setStep('followup'); }
    else { say({ from: 'bot', text: t.urgencyQ }); setStep('urgency'); }
  }
  function sendAnswer(skip = false) {
    if (!skip && answer.trim()) say({ from: 'me', text: answer.trim() }); else setAnswer('');
    if (quotes) { say({ from: 'bot', text: t.postcodeQ }); setStep('postcode'); return; }
    say({ from: 'bot', text: t.urgencyQ }); setStep('urgency');
  }
  function pickLevel(l: Level) {
    setLevel(l);
    if (quotes && l !== 'spoed') { say({ from: 'me', text: t.levels[l][0] }); loadQuestions(l); return; }
    if (quotes && l === 'spoed' && ai?.followUp) { say([{ from: 'me', text: t.levels[l][0] }, { from: 'bot', text: t.danger, tone: 'tip' }, { from: 'bot', text: ai.followUp }]); setStep('followup'); return; }
    say([{ from: 'me', text: t.levels[l][0] }, ...(l === 'spoed' ? [{ from: 'bot' as const, text: t.danger, tone: 'tip' as const }] : []), { from: 'bot', text: t.postcodeQ }]); setStep('postcode');
  }
  async function loadQuestions(l: Level) {
    setStep('loadingQ'); setAnswers([]); setQIndex(0); setQInput('');
    let qs: Question[] = [];
    try {
      const r = await fetch('/api/intake/questions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: problem.trim(), category, level: l, lang }), signal: timeout(20_000) });
      if (r.ok) { const d = await r.json(); qs = Array.isArray(d.questions) ? d.questions : []; setQSource(String(d.source ?? '')); }
    } catch { /* no questions: go straight on */ }
    qs = qs.filter((q) => q && typeof q.q === 'string').slice(0, 4);
    setQuestions(qs);
    if (!qs.length) { afterQuestions(); return; }
    say([{ from: 'bot', text: t.qIntro }, { from: 'bot', text: qs[0].q }]); setStep('questions');
  }
  function answerQuestion(value: string | null) {
    const q = questions[qIndex];
    const a = (value ?? '').trim();
    const next = a ? [...answers, { q: q.q, a }] : answers;
    if (a) say({ from: 'me', text: a }); else say({ from: 'me', text: t.skip });
    setAnswers(next); setQInput('');
    if (qIndex + 1 < questions.length) { setQIndex(qIndex + 1); say({ from: 'bot', text: questions[qIndex + 1].q }); return; }
    afterQuestions();
  }
  function afterQuestions() {
    if (!photos.length) { say({ from: 'bot', text: t.photoAsk }); setStep('photoNudge'); return; }
    say({ from: 'bot', text: t.postcodeQ }); setStep('postcode');
  }
  function photoNext() {
    if (photos.length) say({ from: 'me', text: `📷 × ${photos.length}` });
    say({ from: 'bot', text: t.postcodeQ }); setStep('postcode');
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
    say([{ from: 'me', text: [name.trim(), phone.trim(), user ? '' : email.trim()].filter(Boolean).join(' · ') }, { from: 'bot', text: quoteFlow ? t.reviewQQuotes : t.reviewQ }]); setStep('review');
  }
  async function submit() {
    setError(''); setStep('sending');
    try {
      const r = await fetch('/api/intake/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: timeout(45_000), body: JSON.stringify({
        ...spamFields, lang, category, description: problem.trim(), followUpAnswer: answer.trim(), followUp: ai?.followUp ?? '', summary: ai?.summary ?? '',
        level, postcode, name: name.trim(), phone: phone.trim(), email: email.trim(), acceptTerms: terms, photos,
        ai: ai?.source === 'ai', provider: ai?.provider ?? '', suggestedCategory: ai?.category ?? '', suggestedLevel: ai?.urgency ?? '',
        ...(quoteFlow ? { answers, questionsSource: qSource } : {}),
      }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.statusToken) { setError((t.errors as Record<string, string>)[data.error] ?? t.errors.generic); setTrouble(`submit_${data.error || r.status}`); setStep('review'); return; }
      setStatusToken(String(data.statusToken)); setStep('done');
    } catch (err) {
      const slow = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
      setError(slow ? t.timeout : t.errors.generic); setTrouble(slow ? 'submit_timeout' : 'submit_network'); setStep('review');
    }
  }

  // Everything the resident has typed so far, for the WhatsApp fallback (nothing is lost if the chat fails).
  const waCtx: WaContext = {
    problem: [problem.trim(), answer.trim(), ...answers.map((x) => `${x.q} ${x.a}`)].filter(Boolean).join(' — '),
    category: ai || category ? label(category) : '',
    level: ['category', 'followup', 'urgency', 'thinking', 'problem', 'loadingQ'].includes(step) ? '' : t.levels[level][0].replace('🚨 ', ''),
    postcode: /^\d{4} [A-Z]{2}$/.test(postcode) ? postcode : postcode.trim(),
    name: name.trim(), phone: phone.trim(), email: user ? user.email : email.trim(),
  };
  const waReason = error ? (trouble || `error_${step}`) : trouble;

  if (step === 'done' && statusToken) return <UrgentStatus token={statusToken} fresh whatsapp={whatsapp} labels={categories} waCtx={waCtx} />;

  return <div className="ui-chat" aria-live="polite">{trap}
    <div className="ui-log">
      {msgs.map((m, i) => <div key={i} className={`ui-msg ui-${m.from}${m.tone === 'tip' ? ' ui-tip' : ''}`}>{m.tone === 'tip' ? <Siren aria-hidden="true" /> : null}<span>{m.text}</span></div>)}
      {step === 'thinking' || step === 'sending' || step === 'loadingQ' ? <div className="ui-msg ui-bot ui-typing"><Loader2 aria-hidden="true" className="ui-spin" /><span>{step === 'thinking' ? t.thinking : step === 'loadingQ' ? t.qLoading : t.sending}</span></div> : null}
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

      {step === 'questions' && questions[qIndex] && <form className="ui-stack ui-question" onSubmit={(e) => { e.preventDefault(); if (qInput.trim()) answerQuestion(qInput); }}>
        <small className="ui-q-count">{t.qOf(qIndex + 1, questions.length)}</small>
        {questions[qIndex].options.length ? <div className="ui-chips">{questions[qIndex].options.map((o) => <button key={o} type="button" className="ui-chip" onClick={() => answerQuestion(o)}>{o}</button>)}</div> : null}
        <input key={qIndex} autoFocus={!questions[qIndex].options.length} value={qInput} maxLength={300} onChange={(e) => setQInput(e.target.value)} placeholder={t.qOther} aria-label={questions[qIndex].q} />
        <div className="ui-row"><button type="button" className="ui-ghost" onClick={() => answerQuestion(null)}>{t.skip}</button><button className="primary" type="submit" disabled={!qInput.trim()}>{t.next} <ArrowRight aria-hidden="true" /></button></div>
      </form>}

      {step === 'photoNudge' && <div className="ui-stack">
        <div className="ui-row">
          <label className="ui-photo-btn"><Camera aria-hidden="true" /> {t.photos} <small>({t.photoNote})</small><input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} disabled={photos.length >= 3} /></label>
          <button className="primary" type="button" onClick={photoNext}>{photos.length ? t.photoDone : t.photoSkip} <ArrowRight aria-hidden="true" /></button>
        </div>
        {photos.length ? <div className="ui-thumbs">{photos.map((ph, i) => <span key={i}><img src={ph} alt="" /><button type="button" aria-label="x" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}><X aria-hidden="true" /></button></span>)}</div> : null}
      </div>}

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
          {quoteFlow && answers.length ? <div><dt>{t.answers}</dt><dd>{answers.map((x) => x.a).join(' · ')}</dd></div> : null}
          <div><dt>{t.fields.where}</dt><dd>{postcode}</dd></div>
          <div><dt>{t.fields.who}</dt><dd>{[name, phone, user ? user.email : email].filter(Boolean).join(' · ')}</dd></div>
        </dl>
        <div className="ui-row">
          <button type="button" className="ui-ghost" disabled={step === 'sending'} onClick={() => { setMsgs([{ from: 'bot', text: hello }]); setStep('problem'); setAi(null); setAnswer(''); setAnswers([]); setQuestions([]); setError(''); setTrouble(''); }}>{t.edit}</button>
          <button className="primary" type="button" disabled={step === 'sending'} onClick={submit}>{step === 'sending' ? t.sending : quoteFlow ? t.confirmQuotes : t.confirm} <ArrowRight aria-hidden="true" /></button>
        </div>
      </div>}

      {error ? <p className="platform-error" role="alert">{error}</p> : null}
      {whatsapp && (error || trouble) ? <WhatsAppFallback number={whatsapp} lang={lang} ctx={waCtx} reason={waReason || 'error'} /> : null}
    </div>
    {whatsapp && !error && !trouble ? <WhatsAppFallback number={whatsapp} lang={lang} ctx={waCtx} reason={`link_${step}`} variant="link" /> : null}
  </div>;
}
