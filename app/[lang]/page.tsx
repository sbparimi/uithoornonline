import type { Metadata } from 'next';
import { ArrowRight, Check, ChevronRight, MessageCircle, Search } from 'lucide-react';
import { SiteHeader } from '../../components/site-header';
import { SiteFooter } from '../../components/site-footer';
import { isLocale, lp, seo, SITE_URL, whatsappHref, type Locale } from '../../lib/i18n/config';
import { getDictionary } from '../../lib/i18n/dictionaries';
import { AppIcon, HeroChat, type ChatScript } from '../../components/hero-chat';
import { BUSINESS_OFFER_ANCHOR, PRICING_ENABLED } from '../../lib/pricing';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  return { title: { absolute: t.meta.homeTitle }, description: t.meta.homeDescription, ...seo(lang, '/', t.meta.homeTitle, t.meta.homeDescription) };
}

/* Copy for the decorative product mock-up (an example of Uithoorn.online's own request -> lead -> chat flow). */
const mock = {
  nl: {
    status: '9:41', title: 'Uithoorn.online', sub: 'Hulpvraag · voorbeeld', day: 'Vandaag',
    ask: 'Hoi! Mijn kraan lekt. Wie kan deze week langskomen in Uithoorn?',
    cardTitle: 'Hulpvraag geplaatst', cardText: 'Loodgieter · Uithoorn · deze week', cardBadge: 'Gedeeld met lokale bedrijven',
    reply: 'Hoi! Ik ben loodgieter hier in de buurt. Donderdag om 10:00 kan ik langskomen.',
    thanks: 'Top, tot donderdag! 👍', input: 'Bericht', note: 'zo werkt een hulpvraag ↑',
    leadKicker: 'Nieuwe lead', leadTitle: 'Loodgieter gezocht', leadText: 'Uithoorn · deze week',
    free: 'gratis voor bewoners!', bizKicker: 'Voor bedrijven', bizTitle: 'Gratis je bedrijf vermelden', bizText: '',
    bubbles: ['Loodgieter in de buurt?', 'Mijn heg moet gesnoeid worden 🌿', 'Alleen uit de buurt 📍', 'Eerst bekeken ✓'],
    appName: 'uithoorn.online', appSub: 'Voorbeeld · Uithoorn & De Kwakel', pushNow: 'nu',
    pros: { plumber: 'Loodgieter', gardener: 'Hovenier', electrician: 'Elektricien', painter: 'Schilder', cleaner: 'Schoonmaak', handyman: 'Klusjesman', cook: 'Thuiskok' },
    scripts: [
      { push: 'Nieuwe lead: loodgieter in Uithoorn', msgs: [
        { k: 'out', text: 'Hoi! Mijn kraan lekt. Wie kan deze week langskomen in Uithoorn?' },
        { k: 'card', title: 'Hulpvraag geplaatst', text: 'Loodgieter · Uithoorn · deze week', badge: 'Gedeeld met lokale bedrijven' },
        { k: 'in', from: 'Loodgieter · Uithoorn', text: 'Hoi! Ik zit hier in de buurt. Donderdag om 10:00 kan ik langskomen.' },
        { k: 'out', text: 'Top, tot donderdag! 👍' },
        { k: 'ok', text: '✓ Afspraak bevestigd · do 10:00' },
      ] },
      { push: 'Nieuwe lead: hovenier in De Kwakel', msgs: [
        { k: 'out', text: 'Wie kan mijn heg snoeien in De Kwakel? Liefst zaterdag.' },
        { k: 'card', title: 'Hulpvraag geplaatst', text: 'Hovenier · De Kwakel · zaterdag', badge: 'Gedeeld met lokale bedrijven' },
        { k: 'in', from: 'Hovenier · De Kwakel', text: 'Goedemorgen! Zaterdag om 9:00 past. Stuur je even een foto van de heg? 🌿' },
        { k: 'out', text: 'Zeker, komt eraan 📷' },
        { k: 'ok', text: '✓ Afspraak bevestigd · za 9:00' },
      ] },
      { push: 'Nieuwe lead: schilder in Uithoorn', msgs: [
        { k: 'out', text: 'Ik zoek een schilder voor mijn kozijnen, ergens in november.' },
        { k: 'card', title: 'Hulpvraag geplaatst', text: 'Schilder · Uithoorn · november', badge: 'Gedeeld met lokale bedrijven' },
        { k: 'in', from: 'Schilder · Uithoorn', text: 'Hoi! Ik kom dinsdag graag vrijblijvend kijken voor een offerte.' },
        { k: 'out', text: 'Prima, dinsdag is goed!' },
        { k: 'ok', text: '✓ Afspraak bevestigd · di 16:00' },
      ] },
    ] as ChatScript[],
    plansKicker: 'Abonnementen', single: 'Losse lead €10', viaWa: 'alles via WhatsApp, geen checkout',
  },
  en: {
    status: '9:41', title: 'Uithoorn.online', sub: 'Request · example', day: 'Today',
    ask: 'Hi! My tap is leaking. Who can come by in Uithoorn this week?',
    cardTitle: 'Request posted', cardText: 'Plumber · Uithoorn · this week', cardBadge: 'Shared with local businesses',
    reply: 'Hi! I’m a plumber nearby. I can come by on Thursday at 10:00.',
    thanks: 'Great, see you Thursday! 👍', input: 'Message', note: 'this is how a request works ↑',
    leadKicker: 'New lead', leadTitle: 'Plumber wanted', leadText: 'Uithoorn · this week',
    free: 'free for residents!', bizKicker: 'For businesses', bizTitle: 'Free to list your business', bizText: '',
    bubbles: ['A plumber nearby?', 'My hedge needs trimming 🌿', 'Only from around here 📍', 'Checked first ✓'],
    appName: 'uithoorn.online', appSub: 'Example · Uithoorn & De Kwakel', pushNow: 'now',
    pros: { plumber: 'Plumber', gardener: 'Gardener', electrician: 'Electrician', painter: 'Painter', cleaner: 'Cleaner', handyman: 'Handyman', cook: 'Home cook' },
    scripts: [
      { push: 'New lead: plumber in Uithoorn', msgs: [
        { k: 'out', text: 'Hi! My tap is leaking. Who can come by in Uithoorn this week?' },
        { k: 'card', title: 'Request posted', text: 'Plumber · Uithoorn · this week', badge: 'Shared with local businesses' },
        { k: 'in', from: 'Plumber · Uithoorn', text: 'Hi! I’m nearby. I can come by on Thursday at 10:00.' },
        { k: 'out', text: 'Great, see you Thursday! 👍' },
        { k: 'ok', text: '✓ Appointment confirmed · Thu 10:00' },
      ] },
      { push: 'New lead: gardener in De Kwakel', msgs: [
        { k: 'out', text: 'Who can trim my hedge in De Kwakel? Saturday if possible.' },
        { k: 'card', title: 'Request posted', text: 'Gardener · De Kwakel · Saturday', badge: 'Shared with local businesses' },
        { k: 'in', from: 'Gardener · De Kwakel', text: 'Morning! Saturday at 9:00 works. Could you send a photo of the hedge? 🌿' },
        { k: 'out', text: 'Sure, sending one now 📷' },
        { k: 'ok', text: '✓ Appointment confirmed · Sat 9:00' },
      ] },
      { push: 'New lead: painter in Uithoorn', msgs: [
        { k: 'out', text: 'Looking for a painter for my window frames, sometime in November.' },
        { k: 'card', title: 'Request posted', text: 'Painter · Uithoorn · November', badge: 'Shared with local businesses' },
        { k: 'in', from: 'Painter · Uithoorn', text: 'Hi! Happy to come by on Tuesday for a free quote.' },
        { k: 'out', text: 'Perfect, Tuesday works!' },
        { k: 'ok', text: '✓ Appointment confirmed · Tue 16:00' },
      ] },
    ] as ChatScript[],
    plansKicker: 'Plans', single: 'Single lead €10', viaWa: 'all via WhatsApp, no checkout',
  },
} as const;

const photos = [
  { key: 'plumber' }, { key: 'gardener' }, { key: 'painter' }, { key: 'electrician' }, { key: 'cleaner' }, { key: 'cook' },
] as const;

const serviceEmoji = ['🌿', '🧽', '🚚', '💇', '🔨', '🔧', '🍛', '🚲'];
const planKeys = ['free', 'pro', 'pro_plus'] as const;
const prices = { free: '0', pro: '29', pro_plus: '59' } as const;

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const h = t.home;
  const b = t.business;
  const m = mock[lang];
  const search = (q: string) => lp(lang, `/businesses?search=${encodeURIComponent(q)}`);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Uithoorn.online',
    url: lang === 'nl' ? SITE_URL : `${SITE_URL}/en`,
    inLanguage: lang === 'nl' ? 'nl-NL' : 'en',
    description: t.meta.homeDescription,
    potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}${lp(lang, '/businesses')}?search={search_term_string}`, 'query-input': 'required name=search_term_string' },
  };
  const cards: { emoji: string; title: string; text: string; bubble: string; href?: string; cta?: string }[] = [
    { emoji: '🔎', title: h.findTitle, text: h.findText, bubble: m.bubbles[0], href: lp(lang, '/businesses'), cta: h.servicesAll },
    { emoji: '✍️', title: h.helpTitle, text: h.helpText, bubble: m.bubbles[1], href: lp(lang, '/request'), cta: h.orDescribeLink },
    { emoji: '📍', title: h.trust[0][0], text: h.trust[0][1], bubble: m.bubbles[2] },
    { emoji: '✅', title: h.trust[1][0], text: h.trust[1][1], bubble: m.bubbles[3] },
  ];

  return (
    <div className="ds-page f-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      <main id="main">
        <section className="f-hero">
          <div className="f-stage" aria-hidden="true">
            {photos.map((ph) => (
              <figure key={ph.key} className={`f-sticker f-photo f-p-${ph.key}`}>
                <img src={`/img/pros/${ph.key}.webp`} alt="" width={360} height={450} loading="lazy" decoding="async" />
                <figcaption>{m.pros[ph.key]}</figcaption>
              </figure>
            ))}
            <div className="f-sticker f-sticker-yellow f-s2"><small>{m.leadKicker}</small><strong>{m.leadTitle}</strong><span>{m.leadText}</span></div>
            <div className="f-sticker f-sticker-hand f-s5">{m.free}</div>
            <div className="f-sticker f-sticker-blue f-s7"><small>{m.bizKicker}</small><strong>{m.bizTitle}</strong>{m.bizText ? <span>{m.bizText}</span> : null}</div>
            <div className="f-homeicon"><AppIcon /><span>{m.appName}</span></div>

            <div className="f-phone">
              <div className="f-phone-screen">
                <span className="f-phone-island" />
                <div className="f-phone-status"><span>{m.status}</span><span className="f-phone-sig"><i /><i /><i /><b /></span></div>
                <div className="f-phone-head">
                  <span className="f-phone-back">‹</span>
                  <AppIcon className="f-phone-appicon" />
                  <span className="f-phone-titles"><strong>{m.appName}</strong><small>{m.appSub}</small></span>
                </div>
                <HeroChat scripts={m.scripts} day={m.day} pushLabel={m.appName.toUpperCase()} pushNow={m.pushNow} />
                <div className="f-phone-input">{m.input}<b>↑</b></div>
                <span className="f-phone-home" />
              </div>
            </div>
            <p className="f-mock-note">{m.note}</p>
          </div>

          <div className="f-hero-copy">
            <p className="f-hero-place"><i aria-hidden="true" />{h.eyebrow}</p>
            <h1>{h.h1a} <span>{h.h1b}</span></h1>
            <p className="f-hero-intro">{h.intro}</p>
            <form className="f-search" action={lp(lang, '/businesses')} method="get" role="search">
              <Search aria-hidden="true" />
              <input name="search" type="search" placeholder={h.searchPlaceholder} aria-label={h.searchLabel} autoComplete="off" enterKeyHint="search" />
              <button type="submit" className="btn btn-primary">{h.searchButton}</button>
            </form>
            <div className="f-quick">
              {h.quick.map(([label, q]) => <a key={label} href={search(q)}>{label}</a>)}
            </div>
            <div className="f-hero-ctas">
              <a className="f-btn f-btn-dark" href={lp(lang, '/request')}>{h.orDescribeLink} <ArrowRight aria-hidden="true" /></a>
              <a className="f-btn f-btn-white" href={lp(lang, '/voor-bedrijven')}>{h.bizKicker}</a>
            </div>
          </div>

        </section>

        <section className="f-section-tight" aria-label={h.actionsLabel}>
          <div className="ds-container f-cards">
            {cards.map((c) => {
              const inner = <>
                <div className="f-card-art"><div className="f-sticker f-sticker-emoji" aria-hidden="true">{c.emoji}</div><div className="f-bubble" aria-hidden="true">{c.bubble}</div></div>
                <h2>{c.title}</h2>
                <p>{c.text}</p>
                {c.cta && <span className="f-card-cta">{c.cta} <ArrowRight aria-hidden="true" /></span>}
              </>;
              return c.href ? <a key={c.title} href={c.href} className="f-card f-reveal">{inner}</a> : <div key={c.title} className="f-card f-reveal">{inner}</div>;
            })}
          </div>
        </section>

        <section className="f-section" id="diensten">
          <div className="ds-container">
            <div className="f-head"><span className="ds-kicker">{h.servicesKicker}</span><h2>{h.servicesTitle}</h2></div>
            <div className="f-services">
              {h.services.map(([title, text, q], i) => <a key={title} href={search(q)} className="f-service f-reveal"><span className="f-service-emoji" aria-hidden="true">{serviceEmoji[i] ?? '✨'}</span><span><strong>{title}</strong><small>{text}</small></span><ChevronRight aria-hidden="true" /></a>)}
            </div>
            <p style={{ textAlign: 'center', marginTop: 22 }}><a className="ds-link" href={lp(lang, '/businesses')}>{h.servicesAll} <ChevronRight aria-hidden="true" /></a></p>
          </div>
        </section>

        <section className="f-section" style={{ paddingTop: 0 }}>
          <div className="ds-container">
            <div className="f-head"><span className="ds-kicker">{h.howKicker}</span><h2>{h.howTitle}</h2></div>
            <ol className="f-steps">
              {h.steps.map(([title, text], i) => <li key={title} className="f-reveal"><b aria-hidden="true">{i + 1}</b><strong>{title}</strong><span>{text}</span></li>)}
            </ol>
          </div>
        </section>

        <section className="f-section" style={{ paddingTop: 0 }}>
          <div className="ds-container">
            <div className="f-biz f-reveal">
              <div>
                <span className="ds-kicker">{h.bizKicker}</span>
                <h2>{h.bizTitle}</h2>
                <p>{h.bizText}</p>
                <div className="f-biz-actions">
                  <a className="f-btn f-btn-blue" href={lp(lang, '/signup/account?role=provider')}>{h.bizSecondary} <ArrowRight aria-hidden="true" /></a>
                  <a className="f-btn f-btn-white" href={lp(lang, `/voor-bedrijven${BUSINESS_OFFER_ANCHOR}`)}>{h.bizCta}</a>
                </div>
              </div>
              {PRICING_ENABLED ? <div className="f-plans" aria-label={m.plansKicker}>
                {planKeys.map((k) => { const [name, desc] = b.plans[k]; return <div key={k} className="f-plan"><div><strong>{name}</strong><span>{desc}</span></div><em>€{prices[k]}{k !== 'free' && <small> {b.perMonth}</small>}</em></div>; })}
                <div className="f-plan"><div><strong>{m.single}</strong></div><em><MessageCircle aria-hidden="true" style={{ width: 22, height: 22, color: '#25a35a' }} /></em></div>
                <p className="f-plans-note">{m.viaWa}</p>
              </div> : <div className="f-plans" aria-label={b.free.title}>
                <div className="f-plan f-plan-free"><div><strong>{b.free.title}</strong><span>{b.free.desc}</span></div><em>{b.free.name}</em></div>
                <ul className="f-free-list">{b.free.features.map((f) => <li key={f}><Check aria-hidden="true" />{f}</li>)}</ul>
                <p className="f-plans-note">{b.free.note}</p>
              </div>}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter lang={lang} />
      <a className="floating-help" href={whatsappHref(h.whatsappMessage)} target="_blank" rel="noopener noreferrer" aria-label={h.whatsappAria}><MessageCircle aria-hidden="true" /><span>{h.whatsappLabel}</span></a>
    </div>
  );
}
