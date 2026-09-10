'use client';

import { ArrowRight, BadgeCheck, Globe, MapPin, MessageCircle, Phone, Search, Sparkles, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type ProviderItem = { id: string | null; title: string; meta: string; description: string; postcode: string; website: string | null; phone: string | null; verified: boolean };
type DemandFilter = { value: string; label: string; pattern: RegExp };

const demandFilters: DemandFilter[] = [
  { value: 'all', label: 'Alles', pattern: /.*/ },
  { value: 'garden', label: 'Tuin & groen', pattern: /garden|tuin|landscap|hoven|bestrating|tiling|fenc|schutting/ },
  { value: 'cleaning', label: 'Schoonmaak', pattern: /clean|schoon|window|raam|huishoud|office|kantoor/ },
  { value: 'transport', label: 'Verhuizen & transport', pattern: /transport|moving|verhuiz|koerier|courier|bezorg|delivery/ },
  { value: 'barber', label: 'Kapper & beauty', pattern: /barber|kapper|hairdresser|salon|beauty|kapsel/ },
  { value: 'home', label: 'Huis & klus', pattern: /renov|paving|tiling|fenc|klus|onderhoud|bouw|schilder|timmer|vloer|floor|handyman/ },
  { value: 'plumber', label: 'Loodgieter & elektra', pattern: /plumb|loodgiet|elektr|install|water|lekkage|verwarming|cv/ },
  { value: 'food', label: 'Eten & catering', pattern: /food|eten|restaurant|cater|takeaway|thuiskeuken|bakker|bakery|taart|indian|spiceindia/ },
  { value: 'auto', label: 'Auto & vervoer', pattern: /auto|garage|car|fiets|bicycle|detail|mobiliteit/ },
];

function inferFilter(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 'all';
  return demandFilters.slice(1).find((item) => item.pattern.test(normalized))?.value ?? 'all';
}

function profileHref(item: ProviderItem) {
  return item.id ? `/businesses/${item.id}` : `/signup?kind=business&business=${encodeURIComponent(item.title)}`;
}

export function ProviderDirectory({ items, initialQuery = '' }: { items: ProviderItem[]; initialQuery?: string; showDemandFilters?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(() => inferFilter(initialQuery));
  const activeFilter = demandFilters.find((item) => item.value === filter) ?? demandFilters[0];

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.title} ${item.meta} ${item.description} ${item.postcode}`.toLowerCase();
    const q = query.trim().toLowerCase();
    const queryFilter = inferFilter(query);
    const matchesQuery = !q || (queryFilter !== 'all' ? queryFilter === filter : haystack.includes(q));
    return filter === 'all' ? matchesQuery : matchesQuery && activeFilter.pattern.test(haystack);
  }), [items, query, filter, activeFilter]);

  const requestHref = filter === 'all' && !query.trim()
    ? '/request'
    : `/request?category=${encodeURIComponent(activeFilter.label)}${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ''}`;

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    const nextFilter = inferFilter(value);
    setFilter(nextFilter);
    window.history.replaceState({}, '', value ? `/businesses?search=${encodeURIComponent(value)}` : '/businesses');
  }

  function chooseFilter(value: string) {
    setFilter(value);
    setQuery('');
    window.history.replaceState({}, '', value === 'all' ? '/businesses' : `/businesses?search=${encodeURIComponent(demandFilters.find((item) => item.value === value)?.label ?? '')}`);
  }

  return (
    <main className="uo-directory">
      <header className="uo-header">
        <div className="uo-header-inner">
          <a href="/" className="uo-brand" aria-label="Uithoorn.online home"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>Uithoorn<span>.online</span></span></a>
          <nav className="uo-nav" aria-label="Hoofdnavigatie"><a className="active" href="/businesses">Bedrijven</a><a href="/events">Agenda</a><a href="/deals">Aanbiedingen</a></nav>
          <div className="uo-header-actions"><span className="uo-location"><MapPin /> Uithoorn & De Kwakel</span><a className="uo-header-cta" href="/signup/account?role=provider">Ik heb een bedrijf</a></div>
        </div>
      </header>

      <section className="uo-directory-hero" aria-labelledby="directory-title">
        <div className="uo-directory-hero-inner">
          <div className="uo-directory-search-copy">
            <span className="uo-kicker">Lokaal in Uithoorn & De Kwakel</span>
            <h1 id="directory-title">Waar ben je naar op zoek<span className="directory-title-dot">?</span></h1>
            <p>Zoek een lokaal bedrijf of vertel ons gewoon wat je nodig hebt.</p>
            <form className="uo-directory-search" onSubmit={submitSearch} role="search">
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setFilter('all'); }} placeholder="Bijv. loodgieter, tuinman, kapper of lekkage…" aria-label="Zoek lokale bedrijven en diensten" autoComplete="off" />
              {query && <button type="button" onClick={() => { setQuery(''); setFilter('all'); window.history.replaceState({}, '', '/businesses'); }} aria-label="Wis zoekopdracht"><X /></button>}
              <button className="directory-search-submit" type="submit">Zoeken</button>
            </form>
            <div className="directory-service-chips" aria-label="Populaire diensten">
              {demandFilters.slice(1).map((item) => <button key={item.value} type="button" className={filter === item.value ? 'active' : ''} onClick={() => chooseFilter(item.value)}>{item.label}</button>)}
            </div>
            <a className="directory-ai-help" href={requestHref}><Sparkles /> Weet je niet wie je nodig hebt? Laat ons helpen <ArrowRight /></a>
          </div>
        </div>
      </section>

      <section className="uo-directory-results">
        <div className="uo-results-main">
          <div className="directory-result-intro">
            <div><span className="uo-kicker">{filter === 'all' ? 'Lokaal aanbod' : activeFilter.label}</span><h2>{filter === 'all' ? 'Lokale bedrijven' : `${activeFilter.label} in Uithoorn`}</h2><p>{filtered.length} {filtered.length === 1 ? 'bedrijf' : 'bedrijven'}{query ? ` voor “${query}”` : ''}</p></div>
            {filter !== 'all' && <button className="uo-reset-button" type="button" onClick={() => chooseFilter('all')}>Alles bekijken</button>}
          </div>

          {items.length === 0 ? (
            <div className="uo-empty"><MapPin /><h3>Het lokale aanbod groeit</h3><p>Er zijn nog geen geverifieerde aanbieders in deze gids. Vraag hulp of meld een lokaal bedrijf aan.</p><div className="discovery-empty-actions"><a href="/request">Ik zoek hulp <ArrowRight /></a><a href="/signup/account?role=provider">Bedrijf aanmelden <ArrowRight /></a></div></div>
          ) : filtered.length === 0 ? (
            <div className="uo-empty uo-empty-inline"><Search /><h3>Geen passende bedrijven gevonden</h3><p>Geen probleem. Beschrijf wat je nodig hebt en Uithoorn.online helpt je verder.</p><a href={requestHref}>Vertel wat je nodig hebt <ArrowRight /></a></div>
          ) : (
            <div className="directory-provider-cards">
              {filtered.map((item) => (
                <article key={item.id ?? item.title} className="directory-provider-card">
                  <div className="directory-provider-avatar" aria-hidden="true">{item.title.slice(0, 1).toUpperCase()}</div>
                  <div className="directory-provider-copy">
                    <div className="directory-provider-topline"><span>{item.meta}</span>{item.verified && <span className="directory-provider-verified"><BadgeCheck /> Geverifieerd</span>}</div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="directory-provider-meta"><span><MapPin /> Uithoorn · {item.postcode}</span></div>
                    <div className="uo-provider-actions">
                      <a href={profileHref(item)}>Bekijk profiel <ArrowRight /></a>
                      {item.phone && <a href={`tel:${item.phone}`} aria-label={`Bel ${item.title}`}><Phone /></a>}
                      {item.website && <a href={item.website} target="_blank" rel="noreferrer" aria-label={`Website ${item.title}`}><Globe /></a>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {items.length > 0 && <div className="directory-lead-card"><div><span className="uo-kicker">Niet gevonden?</span><h3>Laat ons de juiste lokale aanbieder zoeken.</h3><p>Beschrijf je vraag. Je hoeft niet te weten welke dienst of vakman je nodig hebt.</p></div><a href={requestHref}><MessageCircle /> Hulp vragen <ArrowRight /></a></div>}
        </div>
      </section>

      <section className="directory-seo-copy"><div><span className="uo-kicker">Lokale hulp</span><h2>Vind een professional in Uithoorn en De Kwakel</h2><p>Van loodgieter en tuinman tot schoonmaker, handyman, cateraar en lokale winkel: zoek wat je nodig hebt of laat Uithoorn.online je helpen.</p><div className="directory-seo-links"><a href="/diensten/loodgieter-uithoorn">Loodgieter</a><a href="/diensten/elektricien-uithoorn">Elektricien</a><a href="/diensten/tuinman-uithoorn">Tuinman</a><a href="/diensten/schoonmaker-uithoorn">Schoonmaker</a><a href="/diensten/handyman-uithoorn">Handyman</a></div></div></section>

      <footer className="uo-footer"><a href="/" className="uo-brand"><span className="uo-brand-mark"><img src="/icon.svg" alt="" /></span><span>Uithoorn<span>.online</span></span></a><span>Uithoorn & De Kwakel</span><span>© 2026 Uithoorn.online</span></footer>
    </main>
  );
}
