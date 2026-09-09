'use client';

import { ArrowRight, BadgeCheck, Clock3, Globe, MapPin, MessageCircle, Phone, Search, SlidersHorizontal, Sparkles, UserRoundSearch, Utensils, Wrench, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type ProviderItem = { id: string | null; title: string; meta: string; description: string; postcode: string; website: string | null; phone: string | null; verified: boolean };
type DemandFilter = { value: string; label: string; terms: string };

const demandFilters: DemandFilter[] = [
  { value: 'all', label: 'Alles', terms: '' },
  { value: 'SpiceIndia', label: 'SpiceIndia', terms: 'spiceindia indian food catering biryani dosa idli vada' },
  { value: 'garden', label: 'Tuin & buiten', terms: 'garden tuin hovenier landscaping outdoor bestrating tegels schutting' },
  { value: 'home improvement', label: 'Huis & klus', terms: 'home improvement huis klus handyman renovation renovatie bouw onderhoud schilder timmer' },
  { value: 'plumber', label: 'Loodgieter', terms: 'plumber loodgieter installatie installateur waterleiding lekkage verwarming' },
  { value: 'handyman', label: 'Handyman', terms: 'handyman klusjesman klus onderhoud multiservice montage reparatie' },
];

function profileHref(item: ProviderItem) {
  return item.id ? `/businesses/${item.id}` : `/signup?kind=business&business=${encodeURIComponent(item.title)}`;
}

function inferDemandFilter(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 'all';
  if (normalized.includes('spiceindia')) return 'SpiceIndia';
  if (/garden|tuin|hovenier|landschap|bestrating|schutting|buiten/.test(normalized)) return 'garden';
  if (/home improvement|huis|klus|renov|bouw|onderhoud|schilder|timmer/.test(normalized)) return 'home improvement';
  if (/plumber|loodgiet|lekkage|waterleiding|verwarming|installateur/.test(normalized)) return 'plumber';
  if (/handyman|klusjesman|multiservice|montage|reparatie/.test(normalized)) return 'handyman';
  return 'all';
}

export function ProviderDirectory({ items, initialQuery = '', showDemandFilters = false }: { items: ProviderItem[]; initialQuery?: string; showDemandFilters?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<string>(() => inferDemandFilter(initialQuery));
  const [showFilters, setShowFilters] = useState(false);
  const activeFilter = demandFilters.find((item) => item.value === filter) ?? demandFilters[0];

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.title} ${item.meta} ${item.description} ${item.postcode}`.toLowerCase();
    const q = query.trim().toLowerCase();
    const demandQuery = inferDemandFilter(query);
    const selected = demandFilters.find((item) => item.value === filter);
    const expandedTerms = selected?.terms ?? '';
    const matchesQuery = !q || (demandQuery !== 'all' ? demandQuery === filter : haystack.includes(q) || expandedTerms.split(' ').some((term) => term.length > 3 && haystack.includes(term)));
    if (filter === 'all') return matchesQuery;
    if (filter === 'SpiceIndia') return matchesQuery && item.title.toLowerCase().includes('spiceindia');
    if (filter === 'garden') return matchesQuery && /garden|tuin|landscap|outdoor|hoveni|bestrating|tiling|fenc|schutting/.test(haystack);
    if (filter === 'home improvement') return matchesQuery && /renov|paving|tiling|fenc|klus|onderhoud|bouw|home improvement|schilder|timmer/.test(haystack);
    if (filter === 'plumber') return matchesQuery && /plumb|loodgiet|install|water|lekkage|verwarming/.test(haystack);
    if (filter === 'handyman') return matchesQuery && /handyman|klus|multiservice|montage|reparatie/.test(haystack);
    return matchesQuery;
  }), [items, query, filter]);

  const requestHref = filter === 'all' && !query.trim() ? '/request' : `/request?category=${encodeURIComponent(activeFilter.label)}${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ''}`;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    window.history.replaceState({}, '', value ? `/businesses?search=${encodeURIComponent(value)}` : '/businesses');
    setFilter(inferDemandFilter(value));
  }

  function chooseFilter(value: string) {
    setFilter(value);
    setQuery('');
    const params = value === 'all' ? '' : `?search=${encodeURIComponent(demandFilters.find((item) => item.value === value)?.label ?? '')}`;
    window.history.replaceState({}, '', `/businesses${params}`);
  }

  return <main className="uo-directory">
    <header className="uo-header"><div className="uo-header-inner"><a href="/" className="uo-brand" aria-label="Uithoorn.online home"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><nav className="uo-nav" aria-label="Hoofdnavigatie"><a className="active" href="/businesses">Ontdek</a><a href="/events">Agenda</a><a href="/deals">Aanbiedingen</a><a href="/food">Indian food</a></nav><div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/signup/account?role=provider">Bedrijf toevoegen</a></div></div></header>

    <section className="uo-directory-hero" aria-labelledby="directory-title"><div>
      <span className="uo-kicker">Een plek in Uithoorn</span>
      <h1 id="directory-title">Vind wat je zoekt<span className="directory-title-dot">.</span></h1>
      <p>Ontdek lokale bedrijven, professionals en voorzieningen in Uithoorn en De Kwakel. Zoek op naam, dienst, buurt of gewoon in je eigen woorden.</p>
      <form className="uo-directory-search" onSubmit={submitSearch} role="search">
        <Search aria-hidden="true" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setFilter('all'); }} placeholder="Bijv. loodgieter, tuinman, catering of lekkage…" aria-label="Zoek lokale bedrijven en diensten" autoComplete="off" />
        {query && <button type="button" onClick={() => { setQuery(''); setFilter('all'); window.history.replaceState({}, '', '/businesses'); }} aria-label="Wis zoekopdracht"><X /></button>}
        <button className="directory-search-submit" type="submit">Zoeken</button>
      </form>
      <div className="directory-search-actions" aria-label="Snelle acties">
        <a className="directory-search-action primary" href={requestHref}><Sparkles /> Help mij een lokale aanbieder vinden</a>
        <button className="directory-search-action" type="button" onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal /> Zoek op dienst</button>
      </div>
    </div></section>

    <section className="uo-feature-ad" aria-label="Uitgelicht lokaal bedrijf">
      <div className="uo-feature-ad-main">
        <div className="uo-feature-ad-copy">
          <div className="uo-feature-ad-label"><span>UITGELICHT LOKAAL</span><span className="uo-feature-ad-verified"><BadgeCheck /> Geverifieerd</span></div>
          <h2>South Indian home food,<br /><em>vers bereid in Uithoorn.</em></h2>
          <p className="uo-feature-ad-brand"><Utensils /> <strong>SpiceIndia</strong> · biryani · dosa · idli · vada</p>
          <p className="uo-feature-ad-description">Authentieke South Indian gerechten, takeaway en catering voor lokale momenten. Bestel vooraf en haal vers bereid op in Uithoorn.</p>
          <div className="uo-feature-ad-meta"><span><MapPin /> Uithoorn</span><span><Clock3 /> Dagelijks 08:00–23:00</span><span>Catering 10–100+ gasten</span></div>
        </div>
        <div className="uo-feature-ad-actions">
          <a className="uo-feature-ad-primary" href="https://www.spiceindia.nl/" target="_blank" rel="noreferrer">Bekijk menu <ArrowRight /></a>
          <a className="uo-feature-ad-whatsapp" href="https://wa.me/31645480446" target="_blank" rel="noreferrer"><MessageCircle /> Bestel via WhatsApp</a>
          <span>Pickup only · geen bezorging</span>
        </div>
      </div>
      <div className="uo-feature-ad-art" aria-hidden="true"><div className="uo-feature-ad-dish"><span>SPICE</span><strong>INDIA</strong><i /></div><div className="uo-feature-ad-orbit orbit-a" /><div className="uo-feature-ad-orbit orbit-b" /></div>
    </section>

    <section className="directory-intent-strip" aria-label="Lokale hulp zoeken">
      <a className="directory-intent-card" href="/request?category=Loodgieter"><span className="directory-intent-icon"><Wrench /></span><span><strong>Ik heb een loodgieter nodig</strong><span>Beschrijf je klus en vraag lokale hulp</span></span></a>
      <a className="directory-intent-card" href="/request?category=Tuin%20%26%20buiten"><span className="directory-intent-icon"><MapPin /></span><span><strong>Ik zoek hulp voor tuin & buiten</strong><span>Van bestrating tot schutting en onderhoud</span></span></a>
      <a className="directory-intent-card" href="/request"><span className="directory-intent-icon"><UserRoundSearch /></span><span><strong>Ik weet niet wie ik nodig heb</strong><span>Vertel ons wat je nodig hebt</span></span></a>
    </section>

    <section className="uo-directory-results">
      {showDemandFilters && <div className="directory-demand"><div className="directory-demand-head"><div><span className="uo-kicker">Populaire lokale zoekopdrachten</span><h2>Waar zijn mensen naar op zoek?</h2></div><button type="button" onClick={() => setShowFilters((value) => !value)}><SlidersHorizontal /> {showFilters ? 'Verberg filters' : 'Filters'}</button></div><div className={`directory-filter-list ${showFilters ? 'open' : ''}`}>{demandFilters.map((item) => <button key={item.value} className={filter === item.value ? 'active' : ''} type="button" onClick={() => chooseFilter(item.value)}>{item.label}</button>)}</div></div>}

      <div className="directory-result-intro"><div><span className="uo-kicker">Uithoorn & De Kwakel</span><h2>{filtered.length} {filtered.length === 1 ? 'resultaat' : 'resultaten'}</h2></div><p>Alleen geverifieerde lokale aanbieders worden hier getoond.</p></div>

      {items.length > 0 && <div className="directory-lead-card"><div><span className="uo-kicker">Niet gevonden wat je zoekt?</span><h3>Laat Uithoorn.online het voor je vinden.</h3><p>Beschrijf je klus, vraag of behoefte. We gebruiken je aanvraag om passende lokale aanbieders te vinden.</p></div><a href={requestHref}>Vertel wat je nodig hebt <ArrowRight /></a></div>}

      {items.length === 0 ? <div className="uo-empty"><MapPin /><h3>Nog geen geverifieerde aanbieders</h3><p>De lokale gids groeit. Je kunt direct een hulpvraag plaatsen of je bedrijf aanmelden.</p><div className="discovery-empty-actions"><a href="/request">Lokale hulp vragen <ArrowRight /></a><a href="/signup/account?role=provider">Bedrijf aanmelden <ArrowRight /></a></div></div> : <div className="uo-directory-list">{filtered.map((item) => <article key={item.id ?? item.title}><div className="uo-directory-mark">{item.title.slice(0, 1)}</div><div className="uo-directory-copy"><span>{item.meta} · {item.postcode}{item.verified && <span className="uo-verified"><BadgeCheck /> Geverifieerd</span>}</span><h3>{item.title}</h3><p>{item.description}</p><div className="uo-provider-actions"><a href={profileHref(item)}>Bekijk profiel <ArrowRight /></a>{item.phone && <a href={`tel:${item.phone}`} aria-label={`Bel ${item.title}`}><Phone /></a>}{item.website && <a href={item.website} target="_blank" rel="noreferrer" aria-label={`Website ${item.title}`}><Globe /></a>}</div></div></article>)}</div>}

      {items.length > 0 && filtered.length === 0 && <div className="uo-empty"><Search /><h3>Geen geverifieerde resultaten voor “{query || activeFilter.label}”</h3><p>Geen probleem. Vertel kort wat je zoekt en we helpen je een passende lokale aanbieder te vinden.</p><a href={requestHref}>Start een lokale hulpvraag <ArrowRight /></a></div>}

      <div className="directory-seo-copy"><span className="uo-kicker">Lokale diensten in Uithoorn</span><h2>Vind een lokale professional in Uithoorn en De Kwakel</h2><p>Zoek je een loodgieter, tuinman, klusbedrijf, handyman, cateraar of andere lokale dienstverlener? Gebruik de zoekbalk of vertel wat je nodig hebt. Uithoorn.online helpt bewoners lokale bedrijven en diensten sneller te vinden.</p><div className="directory-seo-links"><a href="/businesses?search=Loodgieter">Loodgieter in Uithoorn</a><a href="/businesses?search=Tuin%20%26%20buiten">Tuin en buiten</a><a href="/businesses?search=Huis%20%26%20klus">Huis en klus</a><a href="/businesses?search=Handyman">Handyman in Uithoorn</a><a href="/businesses?search=SpiceIndia">Indian food in Uithoorn</a></div></div>
    </section>

    <footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>ithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
  </main>;
}
