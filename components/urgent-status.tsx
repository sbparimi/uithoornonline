'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle2, Clock, FileText, Loader2, Phone, Siren, Star, Users } from 'lucide-react';
import VerifiedReviewForm from './verified-review-form';
import { lp } from '../lib/i18n/config';
import { useLang } from './lang-context';
import WhatsAppFallback, { type WaContext } from './whatsapp-fallback';

// Live status of an intake request (polls /api/intake/status, which also advances spoed escalation).
type Status = { category: string; level: string | null; postcode: string; createdAt: string; stage: string; status: string; alerted: number; escalated: number; alertsSentAt: string | null; escalateMinutes?: number;
  accepted: { name: string; phone: string | null; website: string | null; at: string } | null;
  // AI request flow (quotes): optional so older API answers still render.
  quoteMode?: boolean; quotes?: Quote[]; round?: number; invited?: number; roundHours?: number; completed?: boolean; reviewed?: boolean; reviewToken?: string | null };
type Quote = { id: string; businessId: string; business: string; verified: boolean; amountCents: number | null; priceType: string; message: string; availableFrom: string | null; status: string; at: string; rating: number | null; reviews: number };

const Q = {
  nl: { sent: (n: number, round: number) => round > 1 ? `${n} bedrijven gevraagd (ronde ${round} van 3)` : `Naar de ${n} best passende ${n === 1 ? 'bedrijf' : 'bedrijven'} gestuurd`, none: 'We zoeken passende bedrijven…',
    waitQuotes: (h: number) => `Wachten op offertes. Komt er binnen ${h >= 1 ? `${Math.round(h)} uur` : `${Math.max(1, Math.round(h * 60))} minuten`} geen offerte, dan vragen we automatisch de volgende 3 bedrijven.`,
    quotes: (n: number) => n === 1 ? '1 offerte ontvangen' : `${n} offertes ontvangen`, compare: 'Vergelijk en kies', choose: 'Kies deze offerte', choosing: 'Bezig…', confirm: (b: string) => `Kies je de offerte van ${b}? Het bedrijf krijgt dan je contactgegevens en de anderen horen dat je gekozen hebt.`,
    visit: 'Prijs na bezichtiging', from: 'vanaf', hour: 'per uur', start: 'Kan starten', noReviews: 'Nog geen beoordelingen', reviews: (n: number) => `${n} ${n === 1 ? 'beoordeling' : 'beoordelingen'}`, view: 'Bekijk bedrijf',
    cheapest: 'Laagste prijs', best: 'Best beoordeeld', verified: 'Geverifieerd', chosen: 'gekozen', more: 'Er kunnen nog meer offertes binnenkomen. Je contactgegevens gaan pas naar een bedrijf als je kiest.',
    done: 'Is de klus klaar?', doneBtn: 'Ja, de klus is klaar', doneOk: 'Fijn dat de klus klaar is!', rate: (b: string) => `Hoe heeft ${b} het gedaan?`, rated: 'Bedankt voor je beoordeling!', chooseErr: 'Kiezen lukte niet. Probeer het opnieuw.' },
  en: { sent: (n: number, round: number) => round > 1 ? `Asked ${n} businesses so far (round ${round} of 3)` : `Sent to the ${n} best-matching ${n === 1 ? 'business' : 'businesses'}`, none: 'Finding matching businesses…',
    waitQuotes: (h: number) => `Waiting for quotes. If no quote comes in within ${h >= 1 ? `${Math.round(h)} hours` : `${Math.max(1, Math.round(h * 60))} minutes`}, we automatically ask the next 3 businesses.`,
    quotes: (n: number) => n === 1 ? '1 quote received' : `${n} quotes received`, compare: 'Compare and choose', choose: 'Choose this quote', choosing: 'Working…', confirm: (b: string) => `Choose the quote from ${b}? The business then gets your contact details and the others hear you have chosen.`,
    visit: 'Price after a visit', from: 'from', hour: 'per hour', start: 'Can start', noReviews: 'No reviews yet', reviews: (n: number) => `${n} ${n === 1 ? 'review' : 'reviews'}`, view: 'View business',
    cheapest: 'Lowest price', best: 'Best rated', verified: 'Verified', chosen: 'chosen', more: 'More quotes may still come in. Your contact details only go to a business once you choose.',
    done: 'Is the job done?', doneBtn: 'Yes, the job is done', doneOk: 'Great, the job is done!', rate: (b: string) => `How did ${b} do?`, rated: 'Thanks for your review!', chooseErr: "Couldn't choose. Please try again." },
};

const T = {
  nl: { got: 'Je aanvraag is ontvangen', yours: 'Ontvangen om', alerted: (n: number) => n ? `${n} lokale ${n === 1 ? 'vakman' : 'vakmensen'} gewaarschuwd` : 'We zoeken een passende vakman', alerting: 'Vakmensen worden gewaarschuwd…',
    spoedWait: (m: number) => `Spoed: reageert er binnen ${m} minuten niemand, dan benaderen we 24/7 spoedbedrijven`, escalated: (n: number) => `${n} ${n === 1 ? 'bedrijf' : 'bedrijven'} met 24/7 spoedservice benaderd`,
    exhausted: 'Nog niemand gevonden: ons team is gewaarschuwd en zoekt persoonlijk verder. Bij direct gevaar: bel 112.', waiting: 'Wachten op een vakman die de klus aanneemt…',
    accepted: 'neemt je klus aan!', call: 'Bel', mail: 'Je krijgt ook een e-mail met deze gegevens. Houd deze pagina open of kom later terug via de link in je e-mail.', account: 'Naar je account', live: 'Live bijgewerkt',
    level: { spoed: '🚨 Spoed', today: 'Vandaag', week: 'Deze week', flexible: 'Flexibel' } as Record<string, string>, error: 'Status kon niet worden geladen.' },
  en: { got: 'We received your request', yours: 'Received at', alerted: (n: number) => n ? `${n} local ${n === 1 ? 'professional' : 'professionals'} alerted` : "We're finding a matching professional", alerting: 'Alerting professionals…',
    spoedWait: (m: number) => `Urgent: if nobody responds within ${m} minutes, we contact 24/7 emergency businesses`, escalated: (n: number) => `${n} ${n === 1 ? 'business' : 'businesses'} with 24/7 emergency service contacted`,
    exhausted: 'Nobody found yet: our team has been alerted and is looking personally. In immediate danger: call 112.', waiting: 'Waiting for a professional to accept…',
    accepted: 'is taking your job!', call: 'Call', mail: "You'll also get an email with these details. Keep this page open or come back via the link in your email.", account: 'Go to your account', live: 'Live updates',
    level: { spoed: '🚨 Urgent', today: 'Today', week: 'This week', flexible: 'Flexible' } as Record<string, string>, error: 'Could not load the status.' },
};

export default function UrgentStatus({ token, fresh = false, escalateMinutes = 10, whatsapp = null, labels = [], waCtx = {} }: {
  token: string; fresh?: boolean; escalateMinutes?: number; whatsapp?: string | null; labels?: [string, string][]; waCtx?: WaContext;
}) {
  const lang = useLang();
  const t = T[lang === 'en' ? 'en' : 'nl'];
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let stop = false; let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const r = await fetch(`/api/intake/status?t=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (!r.ok) throw new Error();
        const data: Status = await r.json();
        if (!stop) { setS(data); setErr(false); }
        if (!stop && !data.accepted) timer = setTimeout(load, data.quoteMode && data.alertsSentAt ? 20000 : !data.alertsSentAt && Date.now() - new Date(data.createdAt).getTime() < 60000 ? 2500 : data.level === 'spoed' ? 15000 : 30000);
      } catch { if (!stop) { setErr(true); timer = setTimeout(load, 30000); } }
    }
    load();
    // Phones pause a page in the background (e.g. while the customer checks Gmail). Refresh the moment it
    // is back on screen: that poll also advances a due spoed escalation, so nothing waits for the timer.
    const onVisible = () => { if (document.visibilityState === 'visible' && !stop) { clearTimeout(timer); load(); } };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [token, reload]);

  const time = (v: string) => new Date(v).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
  // WhatsApp fallback (docs/URGENT_HANDLING.md): shown when the status cannot be loaded or nobody was found.
  const wa = (reason: string) => {
    if (!whatsapp) return null;
    const ctx: WaContext = s ? {
      ...waCtx, category: labels.find(([k]) => k === s.category)?.[1] ?? waCtx.category ?? s.category,
      level: (t.level[s.level ?? 'flexible'] ?? s.level ?? '').replace('🚨 ', ''), postcode: s.postcode, createdAt: time(s.createdAt),
    } : waCtx;
    return <WhatsAppFallback number={whatsapp} lang={lang} ctx={ctx} reason={reason} kind="status" />;
  };
  if (!s) return <div className="ui-status">{err ? <><p className="platform-error" role="alert">{t.error}</p>{wa('status_error')}</> : <p><Loader2 className="ui-spin" aria-hidden="true" /> …</p>}</div>;
  const spoed = s.level === 'spoed';
  // Alerts go out right after the request is saved; until they are all out, show "alerting" rather than a partial count.
  const alertsDone = Boolean(s.alertsSentAt) || (s.alerted > 0 && Date.now() - new Date(s.createdAt).getTime() > 60000);
  const stage = s.stage && s.stage !== 'none' ? s.stage : '';
  const waiting = stage === 'waiting' || (!stage && !s.alertsSentAt);
  // No stage once alerts are out = escalation is switched off for this site: no promise about it.
  const spoedRow = spoed && !s.accepted && (Boolean(stage) || !s.alertsSentAt);

  const q = Q[lang === 'en' ? 'en' : 'nl'];
  const money = (cents: number) => `€${(cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'nl-NL', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const priceOf = (x: Quote) => x.amountCents === null || x.priceType === 'visit' ? q.visit : `${x.priceType === 'from' ? `${q.from} ` : ''}${money(x.amountCents)}${x.priceType === 'hourly' ? ` ${q.hour}` : ''}`;
  const day = (d: string) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  async function post(url: string, body: Record<string, unknown>, key: string) {
    setBusy(key); setActionErr('');
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ t: token, ...body }) });
      if (!r.ok) throw new Error();
      setReload((n) => n + 1);
    } catch { setActionErr(q.chooseErr); }
    setBusy('');
  }
  // After a business is chosen/accepted: "job done?" and then the verified review (all requests, not only quotes).
  const after = s.accepted ? (s.completed
    ? (s.reviewToken ? <div className="ui-after"><h3>{q.rate(s.accepted.name)}</h3><VerifiedReviewForm token={s.reviewToken} businessName={s.accepted.name} compact /></div>
      : s.reviewed ? <p className="ui-muted"><CheckCircle2 aria-hidden="true" className="ui-inline-icon" /> {q.rated}</p> : null)
    : <div className="ui-after ui-done-ask"><span>{q.done}</span><button type="button" className="ui-ghost" disabled={busy === 'done'} onClick={() => post('/api/jobs/done', {}, 'done')}>{busy === 'done' ? <Loader2 className="ui-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} {q.doneBtn}</button></div>) : null;

  if (s.quoteMode) {
    const quotes = (s.quotes ?? []).filter((x) => x.status !== 'withdrawn');
    const priced = quotes.filter((x) => x.amountCents !== null && x.priceType === 'fixed');
    const cheapest = priced.length > 1 ? priced.reduce((a, b) => (a.amountCents! <= b.amountCents! ? a : b)).id : '';
    const rated = quotes.filter((x) => x.rating !== null && x.reviews > 0);
    const best = rated.length > 1 ? rated.reduce((a, b) => ((a.rating ?? 0) >= (b.rating ?? 0) ? a : b)).id : '';
    const invited = s.invited ?? s.alerted;
    return <div className="ui-status" role="status">
      <div className="ui-status-head"><CheckCircle2 aria-hidden="true" /><div><h2>{t.got}</h2><p>{t.level[s.level ?? 'flexible'] ?? s.level} · {s.postcode} · {t.yours} {time(s.createdAt)}</p></div></div>
      <ol className="ui-steps">
        <li className="done"><CheckCircle2 aria-hidden="true" /><span>{t.got}</span></li>
        <li className={s.alertsSentAt ? 'done' : 'now'}>{s.alertsSentAt ? <Users aria-hidden="true" /> : <Loader2 className="ui-spin" aria-hidden="true" />}<span>{s.alertsSentAt ? (invited ? q.sent(invited, s.round ?? 1) : q.none) : t.alerting}</span></li>
        {s.accepted
          ? <li className="done ui-won"><CheckCircle2 aria-hidden="true" /><span><strong>{s.accepted.name}</strong> {lang === 'en' ? 'is doing your job.' : 'doet je klus.'}{s.accepted.phone ? <a className="primary platform-button-link ui-call" href={`tel:${s.accepted.phone}`}><Phone aria-hidden="true" /> {t.call} {s.accepted.phone}</a> : null}</span></li>
          : <li className={quotes.length ? 'done' : 'now'}>{quotes.length ? <FileText aria-hidden="true" /> : <Clock aria-hidden="true" />}<span>{quotes.length ? `${q.quotes(quotes.length)} · ${q.compare}` : q.waitQuotes(s.roundHours ?? 24)}</span></li>}
      </ol>
      {quotes.length ? <div className="ui-quotes" aria-label={q.compare}>
        {quotes.map((x) => <article key={x.id} className={`ui-quote${x.status === 'chosen' ? ' ui-quote-chosen' : ''}${x.status === 'not_chosen' ? ' ui-quote-faded' : ''}`}>
          <div className="ui-quote-badges">{x.id === cheapest ? <span className="ui-badge">{q.cheapest}</span> : null}{x.id === best ? <span className="ui-badge ui-badge-star">{q.best}</span> : null}{x.status === 'chosen' ? <span className="ui-badge ui-badge-ok">✓ {q.chosen}</span> : null}</div>
          <h3>{x.business}{x.verified ? <BadgeCheck aria-label={q.verified} className="ui-inline-icon ui-blue" /> : null}</h3>
          <p className="ui-quote-rating">{x.rating !== null && x.reviews ? <><Star aria-hidden="true" fill="currentColor" /> <strong>{x.rating.toFixed(1)}</strong> · {q.reviews(x.reviews)}</> : <span className="ui-muted">{q.noReviews}</span>}</p>
          <p className="ui-quote-price">{priceOf(x)}</p>
          {x.availableFrom ? <p className="ui-quote-date"><Clock aria-hidden="true" /> {q.start}: {day(x.availableFrom)}</p> : null}
          {x.message ? <p className="ui-quote-msg">{x.message}</p> : null}
          <div className="ui-quote-actions">
            {!s.accepted ? <button type="button" className="primary" disabled={Boolean(busy)} onClick={() => { if (window.confirm(q.confirm(x.business))) post('/api/quotes/choose', { quoteId: x.id }, x.id); }}>{busy === x.id ? q.choosing : q.choose}</button> : null}
            <a className="ui-ghost" href={lp(lang, `/businesses/${x.businessId}`)} target="_blank" rel="noopener">{q.view}</a>
          </div>
        </article>)}
      </div> : null}
      {quotes.length && !s.accepted ? <p className="ui-muted">{q.more}</p> : null}
      {actionErr ? <p className="platform-error" role="alert">{actionErr}</p> : null}
      {after}
      {!s.accepted && s.stage === 'exhausted' ? wa('status_exhausted') : null}
      <p className="ui-muted">{fresh ? t.mail : t.live}</p>
      {fresh ? <a className="ui-ghost" href={lp(lang, '/account')}>{t.account}</a> : null}
    </div>;
  }

  return <div className="ui-status" role="status">
    <div className="ui-status-head"><CheckCircle2 aria-hidden="true" /><div><h2>{t.got}</h2><p>{t.level[s.level ?? 'flexible'] ?? s.level} · {s.postcode} · {t.yours} {time(s.createdAt)}</p></div></div>
    <ol className="ui-steps">
      <li className="done"><CheckCircle2 aria-hidden="true" /><span>{t.got}</span></li>
      <li className={alertsDone ? 'done' : 'now'}>{alertsDone ? <Users aria-hidden="true" /> : <Loader2 className="ui-spin" aria-hidden="true" />}<span>{alertsDone ? t.alerted(s.alerted) : t.alerting}</span></li>
      {spoedRow ? <li className={waiting ? 'now' : 'done'}><Siren aria-hidden="true" /><span>{waiting ? t.spoedWait(s.escalateMinutes ?? escalateMinutes) : s.stage === 'exhausted' ? t.exhausted : t.escalated(s.escalated)}</span></li> : null}
      {s.accepted
        ? <li className="done ui-won"><CheckCircle2 aria-hidden="true" /><span><strong>{s.accepted.name}</strong> {t.accepted}{s.accepted.phone ? <a className="primary platform-button-link ui-call" href={`tel:${s.accepted.phone}`}><Phone aria-hidden="true" /> {t.call} {s.accepted.phone}</a> : null}</span></li>
        : s.stage !== 'exhausted' ? <li className="now"><Clock aria-hidden="true" /><span>{t.waiting}</span></li> : null}
    </ol>
    {!s.accepted && s.stage === 'exhausted' ? wa('status_exhausted') : null}
    {actionErr ? <p className="platform-error" role="alert">{actionErr}</p> : null}
    {after}
    <p className="ui-muted">{fresh ? t.mail : t.live}</p>
    {fresh ? <a className="ui-ghost" href={lp(lang, '/account')}>{t.account}</a> : null}
  </div>;
}
