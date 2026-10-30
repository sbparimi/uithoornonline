'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Clock, HelpCircle, ImageIcon, Loader2, MessageSquare, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useLang } from '../lang-context';
import { OTHER_CATEGORY, categoryLabel, categoryOptions } from '../../lib/categories';
import { DAYS, DAY_LABELS, cleanHours, type Day, type OpeningHours } from '../../lib/hours';

type Business = { id: string; name: string; category: string; description: string; postcode: string | null; address: string | null; website: string | null; phone: string | null; public_email?: string | null; verified: boolean };
type Service = { nl: string; en: string };
type Faq = { q_nl: string; a_nl: string; q_en: string; a_en: string };
type Extras = { description_en: string | null; opening_hours: OpeningHours | null; services: Service[]; faqs: Faq[]; chat_enabled: boolean; kvk_number: string | null; photos: { id: string; url: string; alt: string }[] } | null;
type Draft = {
  name: string | null; category: string | null; description_nl: string | null; description_en: string | null; services: Service[]; faqs: Faq[]; opening_hours: OpeningHours | null;
  phone: string | null; public_email: string | null; address: string | null; postcode: string | null; website: string | null; kvk_number: string | null;
  photos: { url: string; alt: string }[]; ai: { used: boolean; provider: string | null; fields: string[] }; source: { website: string | null }; warnings: string[];
};
type DayRow = { open: boolean; from: string; to: string; known: boolean };

export const DRAFT_KEY = 'uo_ai_profile_draft';

function rowsFromHours(h: OpeningHours | null): Record<Day, DayRow> {
  return Object.fromEntries(DAYS.map((d) => {
    const r = h?.[d];
    return [d, Array.isArray(r) ? { known: true, open: r.length > 0, from: r[0]?.[0] ?? '09:00', to: r[0]?.[1] ?? '17:00' } : { known: false, open: false, from: '09:00', to: '17:00' }];
  })) as Record<Day, DayRow>;
}
function hoursFromRows(rows: Record<Day, DayRow>, note: string): OpeningHours | null {
  const out: Record<string, unknown> = {};
  for (const d of DAYS) if (rows[d].known) out[d] = rows[d].open ? [[rows[d].from, rows[d].to]] : [];
  if (note.trim()) out.note = note.trim();
  return cleanHours(out);
}

export function ProfileStudio({ business, extras, aiAvailable }: { business: Business; extras: Extras; aiAvailable: boolean }) {
  const lang = useLang();
  const en = lang === 'en';
  const L = (nl: string, e: string) => (en ? e : nl);
  const categories = useMemo(() => { const c = categoryOptions(lang); return c.includes(business.category) ? c : [business.category, ...c]; }, [lang, business.category]);

  const [f, setF] = useState({ name: business.name, category: business.category, otherCategory: '', description: business.description, description_en: extras?.description_en ?? '', postcode: business.postcode ?? '', address: business.address ?? '', website: business.website ?? '', phone: business.phone ?? '', public_email: business.public_email ?? '', kvk: extras?.kvk_number ?? '' });
  const [services, setServices] = useState<Service[]>(extras?.services ?? []);
  const [faqs, setFaqs] = useState<Faq[]>(extras?.faqs ?? []);
  const [rows, setRows] = useState(() => rowsFromHours(extras?.opening_hours ?? null));
  const [note, setNote] = useState(extras?.opening_hours?.note ?? '');
  const [chatOn, setChatOn] = useState(extras?.chat_enabled ?? true);
  const [photos, setPhotos] = useState(extras?.photos ?? []);
  const [removePhotos, setRemovePhotos] = useState<string[]>([]);
  const [found, setFound] = useState<{ url: string; alt: string; pick: boolean }[]>([]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [aiFields, setAiFields] = useState<string[]>([]);
  const [aiMeta, setAiMeta] = useState<{ provider: string | null; fields: string[]; source: string | null; generated_at: string } | null>(null);
  const [about, setAbout] = useState('');
  const [gen, setGen] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [genMsg, setGenMsg] = useState('');
  const [stash, setStash] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [error, setError] = useState('');
  const set = (k: keyof typeof f, v: string) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const ai = (k: string) => aiFields.includes(k) ? <span className="aib-ai-badge" title={L('Voorstel van AI: controleer dit', 'AI suggestion: please check')}><Sparkles aria-hidden="true" /> AI</span> : null;

  useEffect(() => { try { const raw = sessionStorage.getItem(DRAFT_KEY); if (raw) setStash(JSON.parse(raw)); } catch { /* none */ } }, []);

  function applyDraft(d: Draft) {
    const filled: string[] = [];
    const pick = (k: string, v: string | null | undefined, cur: string) => { if (v && v !== cur) { filled.push(k); return v; } return cur; };
    // Computed from the current form right away (not inside a state updater) so the list of filled
    // fields is complete when we count it and mark the AI badges.
    const x = f;
    setF({
      ...x,
      name: x.name || pick('name', d.name, x.name),
      category: d.category && categories.includes(d.category) ? pick('category', d.category, x.category) : x.category,
      description: pick('description', d.description_nl, x.description),
      description_en: pick('description_en', d.description_en, x.description_en),
      postcode: pick('postcode', d.postcode, x.postcode), address: pick('address', d.address, x.address),
      website: pick('website', d.website, x.website), phone: pick('phone', d.phone, x.phone),
      public_email: pick('public_email', d.public_email, x.public_email), kvk: pick('kvk', d.kvk_number, x.kvk),
    });
    if (d.services?.length) { setServices(d.services); filled.push('services'); }
    if (d.faqs?.length) { setFaqs(d.faqs); filled.push('faqs'); }
    if (d.opening_hours) { setRows(rowsFromHours(d.opening_hours)); setNote(d.opening_hours.note ?? ''); filled.push('hours'); }
    setFound((d.photos ?? []).filter((p) => !photos.some((x) => x.url === p.url)).map((p) => ({ ...p, pick: false })));
    setAiFields(filled);
    setAiMeta({ provider: d.ai?.provider ?? null, fields: d.ai?.fields ?? [], source: d.source?.website ?? null, generated_at: new Date().toISOString() });
    setSaved(false);
    return filled.length;
  }

  async function generate() {
    if (gen === 'busy') return;
    setGen('busy'); setGenMsg('');
    try {
      const res = await fetch('/api/ai/profile-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ website: f.website, kvk: f.kvk, name: f.name, about, lang }), signal: AbortSignal.timeout(70000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGen('error');
        setGenMsg(data.error === 'need_website_or_about' ? L('Vul je website in, of vertel in een paar zinnen wat je doet.', 'Enter your website, or describe in a few sentences what you do.')
          : data.error === 'site_unreadable' ? (data.reason === 'robots_disallow' ? L('Je website staat niet toe dat we hem lezen (robots.txt). Vertel hieronder wat je doet, dan schrijft AI je profiel.', "Your website doesn't allow reading (robots.txt). Describe what you do below and AI writes your profile.") : L('We konden je website niet openen. Klopt het adres? Je kunt ook hieronder vertellen wat je doet.', "We couldn't open your website. Is the address right? You can also describe what you do below."))
          : data.error === 'invalid_kvk' ? L('Een KvK-nummer heeft 8 cijfers.', 'A KvK number has 8 digits.')
          : data.error === 'rate_limited' ? L('Je hebt het al vaak geprobeerd. Wacht even en probeer het opnieuw.', "You've tried a lot already. Wait a bit and try again.")
          : L('Er ging iets mis. Probeer het opnieuw.', 'Something went wrong. Please try again.'));
        return;
      }
      const n = applyDraft(data.draft as Draft);
      setGen('done');
      setGenMsg(n ? L(`${n} onderdelen ingevuld. Controleer alles hieronder en pas aan waar nodig. Er is nog niets opgeslagen.`, `${n} parts filled in. Check everything below and edit where needed. Nothing is saved yet.`)
        : L('We vonden weinig nieuwe informatie op je website. Vul de rest zelf aan, of vertel hierboven wat je doet.', 'We found little new information on your website. Fill in the rest yourself, or describe what you do above.'));
      if ((data.draft as Draft).warnings?.includes('ai_unavailable')) setGenMsg((m) => `${m} ${L('(AI-tekst was even niet beschikbaar; contactgegevens en tijden komen rechtstreeks van je website.)', '(AI text was briefly unavailable; contact details and hours come straight from your website.)')}`);
    } catch { setGen('error'); setGenMsg(L('Dat duurde te lang. Probeer het opnieuw.', 'That took too long. Please try again.')); }
  }

  async function save(e: FormEvent) {
    e.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const body = {
        business: { name: f.name.trim(), category: f.category === OTHER_CATEGORY ? (f.otherCategory.trim() || OTHER_CATEGORY) : f.category, description: f.description.trim(), postcode: f.postcode.trim().toUpperCase(), address: f.address.trim(), website: f.website.trim(), phone: f.phone.trim(), public_email: f.public_email.trim() },
        extras: { description_en: f.description_en.trim(), opening_hours: hoursFromRows(rows, note), services: services.filter((s) => s.nl.trim() || s.en.trim()), faqs: faqs.filter((q) => (q.q_nl.trim() && q.a_nl.trim()) || (q.q_en.trim() && q.a_en.trim())), kvk_number: f.kvk.trim(), chat_enabled: chatOn, ...(aiMeta ? { ai_profile: aiMeta } : {}) },
        photo_consent: photoConsent, add_photos: photoConsent ? found.filter((p) => p.pick).map(({ url, alt }) => ({ url, alt })) : [], remove_photos: removePhotos,
      };
      const res = await fetch('/api/provider/ai-profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m: Record<string, string> = { invalid_website: L('Dat websiteadres klopt niet.', 'That website address looks wrong.'), invalid_postcode: L('Vul een postcode in zoals 1421 AB.', 'Enter a postcode like 1421 AB.'), invalid_public_email: L('Dat e-mailadres klopt niet.', 'That email address looks wrong.'), invalid_kvk: L('Een KvK-nummer heeft 8 cijfers.', 'A KvK number has 8 digits.'), description_too_short: L('Schrijf minimaal 20 tekens over je bedrijf.', 'Write at least 20 characters about your business.'), invalid_name: L('Vul je bedrijfsnaam in.', 'Enter your business name.') };
        setError(m[data.error] ?? L('Opslaan lukte niet. Probeer het opnieuw.', 'Saving failed. Please try again.'));
        return;
      }
      setPhotos(data.extras?.photos ?? photos); setRemovePhotos([]); setFound((x) => x.filter((p) => !p.pick)); setPhotoConsent(false);
      setAiFields([]); setSaved(true);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } setStash(null);
    } catch { setError(L('Opslaan lukte niet. Probeer het opnieuw.', 'Saving failed. Please try again.')); } finally { setSaving(false); }
  }

  const copyWeekdays = () => setRows((r) => ({ ...r, ...Object.fromEntries((['tue', 'wed', 'thu', 'fri'] as Day[]).map((d) => [d, { ...r.mon }])) }));

  return (
    <div className="aib-studio">
      {stash && gen === 'idle' && (
        <div className="aib-banner" role="status"><Sparkles aria-hidden="true" /><div><strong>{L('Je AI-profiel van de aanmelding staat klaar', 'Your AI profile from sign-up is ready')}</strong><p>{L('Met openingstijden, diensten, veelgestelde vragen en Engelse tekst. Vul het in en controleer het.', 'With opening hours, services, FAQs and English text. Fill it in and check it.')}</p></div><button type="button" className="aib-btn aib-btn-primary" onClick={() => { const n = applyDraft(stash); setGen('done'); setGenMsg(L(`${n} onderdelen ingevuld. Controleer en klik op Opslaan.`, `${n} parts filled in. Check and click Save.`)); }}>{L('Invullen', 'Fill in')}</button></div>
      )}

      <section className="aib-ai-box" aria-labelledby="aib-ai-title">
        <div className="aib-ai-box-head"><span aria-hidden="true"><Wand2 /></span><div><h2 id="aib-ai-title">{L('Maak mijn profiel met AI', 'Build my profile with AI')}</h2><p>{L('Vul je website in. AI leest je eigen site en schrijft je profiel in het Nederlands en Engels, met diensten, openingstijden en veelgestelde vragen. Jij controleert alles voordat het online komt.', 'Enter your website. AI reads your own site and writes your profile in Dutch and English, with services, opening hours and FAQs. You check everything before it goes live.')}</p></div></div>
        <div className="aib-grid2">
          <label>{L('Je website', 'Your website')}<input type="text" inputMode="url" placeholder="www.jouwbedrijf.nl" value={f.website} onChange={(e) => set('website', e.target.value)} /></label>
          <label>{L('KvK-nummer (optioneel)', 'KvK number (optional)')}<input inputMode="numeric" maxLength={8} placeholder="12345678" value={f.kvk} onChange={(e) => set('kvk', e.target.value.replace(/\D/g, ''))} /></label>
        </div>
        <label>{L('Geen website? Vertel in een paar zinnen wat je doet (optioneel)', 'No website? Describe in a few sentences what you do (optional)')}<textarea rows={2} maxLength={1500} value={about} onChange={(e) => setAbout(e.target.value)} placeholder={L('Bijv. "Wij zijn een loodgietersbedrijf uit De Kwakel. We repareren lekkages en installeren cv-ketels. Ma–vr 8–17 uur."', 'E.g. "We are a plumbing company from De Kwakel. We fix leaks and install boilers. Mon–Fri 8–17."')} /></label>
        <button type="button" className="aib-btn aib-btn-primary aib-btn-wide" onClick={generate} disabled={gen === 'busy'}>{gen === 'busy' ? <><Loader2 aria-hidden="true" className="aib-spin" /> {L('AI leest je website… (± 20 sec)', 'AI is reading your website… (± 20 sec)')}</> : <><Sparkles aria-hidden="true" /> {gen === 'done' ? L('Opnieuw maken', 'Make again') : L('Maak mijn profiel met AI', 'Build my profile with AI')}</>}</button>
        {!aiAvailable && <p className="aib-hint">{L('AI-tekst staat in deze omgeving uit; contactgegevens en tijden worden wel van je website gehaald.', 'AI text is off in this environment; contact details and hours are still read from your website.')}</p>}
        {genMsg && <p className={gen === 'error' ? 'aib-error' : 'aib-ok'} role={gen === 'error' ? 'alert' : 'status'}>{gen !== 'error' && <Check aria-hidden="true" />} {genMsg}</p>}
      </section>

      <form className="aib-form" onSubmit={save}>
        <fieldset><legend>{L('Je bedrijf', 'Your business')}</legend>
          <label>{L('Bedrijfsnaam', 'Business name')} {ai('name')}<input required minLength={2} maxLength={120} value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label>{L('Categorie', 'Category')} {ai('category')}<select value={f.category} onChange={(e) => set('category', e.target.value)}>{categories.map((c) => <option key={c} value={c}>{categoryLabel(c, lang)}</option>)}</select></label>
          {f.category === OTHER_CATEGORY && <label>{L('Jouw categorie', 'Your category')}<input required minLength={2} maxLength={80} value={f.otherCategory} onChange={(e) => set('otherCategory', e.target.value)} /></label>}
          <div className="aib-grid2">
            <label>{L('Telefoon', 'Phone')} {ai('phone')}<input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label>{L('E-mail op je pagina', 'Email on your page')} {ai('public_email')}<input type="email" inputMode="email" maxLength={254} value={f.public_email} onChange={(e) => set('public_email', e.target.value)} /></label>
            <label>{L('Adres', 'Address')} {ai('address')}<input value={f.address} onChange={(e) => set('address', e.target.value)} /></label>
            <label>{L('Postcode', 'Postcode')} {ai('postcode')}<input required value={f.postcode} onChange={(e) => set('postcode', e.target.value.toUpperCase())} /></label>
          </div>
        </fieldset>

        <fieldset><legend>{L('Over je bedrijf', 'About your business')}</legend>
          <label>{L('Beschrijving (Nederlands)', 'Description (Dutch)')} {ai('description')}<textarea required minLength={20} maxLength={3000} rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
          <label>{L('Beschrijving (Engels, voor Engelstalige bezoekers)', 'Description (English, for English-speaking visitors)')} {ai('description_en')}<textarea maxLength={3000} rows={4} value={f.description_en} onChange={(e) => set('description_en', e.target.value)} /></label>
        </fieldset>

        <fieldset><legend>{L('Diensten', 'Services')} {ai('services')}</legend>
          {services.map((s, i) => <div className="aib-row" key={i}>
            <input aria-label={L('Dienst (NL)', 'Service (NL)')} placeholder={L('Dienst (NL)', 'Service (NL)')} maxLength={80} value={s.nl} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, nl: e.target.value } : x)))} />
            <input aria-label={L('Dienst (EN)', 'Service (EN)')} placeholder={L('Dienst (EN)', 'Service (EN)')} maxLength={80} value={s.en} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} />
            <button type="button" className="aib-icon-btn" aria-label={L('Verwijder', 'Remove')} onClick={() => setServices(services.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></button>
          </div>)}
          {services.length < 12 && <button type="button" className="aib-btn" onClick={() => setServices([...services, { nl: '', en: '' }])}><Plus aria-hidden="true" /> {L('Dienst toevoegen', 'Add service')}</button>}
        </fieldset>

        <fieldset><legend><Clock aria-hidden="true" /> {L('Openingstijden', 'Opening hours')} {ai('hours')}</legend>
          <p className="aib-hint">{L('Hiermee verschijn je bij het filter "Nu open". Laat een dag op "Onbekend" als je het niet wilt tonen.', 'This puts you in the "Open now" filter. Leave a day on "Unknown" if you don\'t want to show it.')}</p>
          <div className="aib-hours-edit">
            {DAYS.map((d) => { const r = rows[d]; const state = !r.known ? 'unknown' : r.open ? 'open' : 'closed'; return <div className="aib-hours-row" key={d}>
              <span className="aib-day">{DAY_LABELS[lang][d]}</span>
              <select aria-label={`${DAY_LABELS[lang][d]}: ${L('status', 'status')}`} value={state} onChange={(e) => { const v = e.target.value; setSaved(false); setRows({ ...rows, [d]: { ...r, known: v !== 'unknown', open: v === 'open' } }); }}>
                <option value="open">{L('Open', 'Open')}</option><option value="closed">{L('Gesloten', 'Closed')}</option><option value="unknown">{L('Onbekend', 'Unknown')}</option>
              </select>
              {state === 'open' && <><input type="time" aria-label={`${DAY_LABELS[lang][d]} ${L('van', 'from')}`} value={r.from} onChange={(e) => setRows({ ...rows, [d]: { ...r, from: e.target.value } })} /><span aria-hidden="true">–</span><input type="time" aria-label={`${DAY_LABELS[lang][d]} ${L('tot', 'to')}`} value={r.to} onChange={(e) => setRows({ ...rows, [d]: { ...r, to: e.target.value } })} /></>}
            </div>; })}
          </div>
          <button type="button" className="aib-btn" onClick={copyWeekdays}>{L('Maandag kopiëren naar di t/m vr', 'Copy Monday to Tue–Fri')}</button>
          <label>{L('Opmerking (optioneel)', 'Note (optional)')}<input maxLength={160} placeholder={L('Bijv. "Ook op afspraak"', 'E.g. "Also by appointment"')} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </fieldset>

        <fieldset><legend><HelpCircle aria-hidden="true" /> {L('Veelgestelde vragen', 'Frequently asked questions')} {ai('faqs')}</legend>
          <p className="aib-hint">{L('Deze staan op je pagina en de AI-assistent gebruikt ze om vragen van bezoekers te beantwoorden.', 'These appear on your page and the AI assistant uses them to answer visitors.')}</p>
          {faqs.map((q, i) => <div className="aib-faq-edit" key={i}>
            <input placeholder={L('Vraag (NL)', 'Question (NL)')} maxLength={200} value={q.q_nl} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q_nl: e.target.value } : x)))} />
            <textarea placeholder={L('Antwoord (NL)', 'Answer (NL)')} rows={2} maxLength={800} value={q.a_nl} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a_nl: e.target.value } : x)))} />
            <details><summary>{L('Engelse versie', 'English version')}</summary>
              <input placeholder="Question (EN)" maxLength={200} value={q.q_en} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q_en: e.target.value } : x)))} />
              <textarea placeholder="Answer (EN)" rows={2} maxLength={800} value={q.a_en} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a_en: e.target.value } : x)))} />
            </details>
            <button type="button" className="aib-icon-btn" aria-label={L('Verwijder vraag', 'Remove question')} onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></button>
          </div>)}
          {faqs.length < 8 && <button type="button" className="aib-btn" onClick={() => setFaqs([...faqs, { q_nl: '', a_nl: '', q_en: '', a_en: '' }])}><Plus aria-hidden="true" /> {L('Vraag toevoegen', 'Add question')}</button>}
        </fieldset>

        {(photos.length > 0 || found.length > 0) && <fieldset><legend><ImageIcon aria-hidden="true" /> {L("Foto's", 'Photos')}</legend>
          {photos.length > 0 && <div className="aib-photos">{photos.map((p) => <figure key={p.id} className={removePhotos.includes(p.id) ? 'is-removed' : ''}><img src={p.url} alt={p.alt || f.name} loading="lazy" /><button type="button" className="aib-icon-btn" onClick={() => setRemovePhotos((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))} aria-label={L('Verwijder foto', 'Remove photo')}><Trash2 aria-hidden="true" /></button></figure>)}</div>}
          {found.length > 0 && <>
            <p className="aib-hint">{L("Gevonden op je eigen website. Kies welke op je pagina mogen.", 'Found on your own website. Choose which may appear on your page.')}</p>
            <div className="aib-photos">{found.map((p, i) => <label key={p.url} className={`aib-photo-pick ${p.pick ? 'is-picked' : ''}`}><img src={p.url} alt={p.alt || ''} loading="lazy" referrerPolicy="no-referrer" /><input type="checkbox" checked={p.pick} onChange={(e) => setFound(found.map((x, j) => (j === i ? { ...x, pick: e.target.checked } : x)))} /> <span>{p.pick ? L('Gekozen', 'Chosen') : L('Kies', 'Choose')}</span></label>)}</div>
            <label className="aib-check"><input type="checkbox" checked={photoConsent} onChange={(e) => setPhotoConsent(e.target.checked)} /><span>{L("Deze foto's staan op mijn eigen website en ik mag ze gebruiken.", 'These photos are on my own website and I may use them.')}</span></label>
          </>}
        </fieldset>}

        <fieldset><legend><MessageSquare aria-hidden="true" /> {L('AI-assistent op je pagina', 'AI assistant on your page')}</legend>
          <label className="aib-check"><input type="checkbox" checked={chatOn} onChange={(e) => { setSaved(false); setChatOn(e.target.checked); }} /><span>{L('Bezoekers kunnen vragen stellen. De assistent antwoordt alleen met de informatie uit dit profiel en stuurt overige vragen als lead naar je e-mail.', 'Visitors can ask questions. The assistant only answers with the information in this profile and sends other questions to your email as a lead.')}</span></label>
        </fieldset>

        <div className="aib-save">
          {error && <p className="aib-error" role="alert">{error}</p>}
          {saved && <p className="aib-ok" role="status"><Check aria-hidden="true" /> {L('Opgeslagen. Je pagina is bijgewerkt.', 'Saved. Your page is updated.')}</p>}
          {aiFields.length > 0 && !saved && <p className="aib-hint"><Sparkles aria-hidden="true" /> {L('Velden met "AI" zijn voorstellen. Controleer ze voordat je opslaat.', 'Fields marked "AI" are suggestions. Check them before saving.')}</p>}
          <button className="aib-btn aib-btn-primary aib-btn-wide" type="submit" disabled={saving}>{saving ? <Loader2 aria-hidden="true" className="aib-spin" /> : null}{saving ? L('Opslaan…', 'Saving…') : L('Opslaan', 'Save')} <ArrowRight aria-hidden="true" /></button>
          <a className="aib-link" href={`${en ? '/en' : ''}/businesses/${business.id}`} target="_blank" rel="noopener noreferrer">{L('Bekijk je pagina', 'View your page')}</a>
        </div>
      </form>
    </div>
  );
}
