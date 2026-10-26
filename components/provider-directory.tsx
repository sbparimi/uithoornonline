'use client';

import { ArrowRight, BadgeCheck, Globe, MapPin, MessageCircle, Phone, Search, Sparkles, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

type ProviderItem = { id: string | null; title: string; meta: string; description: string; postcode: string; website: string | null; phone: string | null; verified: boolean; searchText?: string };
type DemandFilter = { value: string; pattern: RegExp };

const demandFilters: DemandFilter[] = [
  { value: 'all', pattern: /.*/ },
  { value: 'garden', pattern: /garden|tuin|landscap|hoven|bestrating|tiling|fenc|schutting/ },
  { value: 'cleaning', pattern: /clean|schoon|window|raam|huishoud|office|kantoor/ },
  { value: 'transport', pattern: /transport|moving|removal|verhuiz|koerier|courier|bezorg|delivery/ },
  { value: 'barber', pattern: /barber|kapper|hairdresser|salon|beauty|kapsel/ },
  { value: 'home', pattern: /renov|paving|tiling|fenc|klus|onderhoud|bouw|schilder|timmer|vloer|floor|handyman|repair/ },
  { value: 'plumber', pattern: /plumb|loodgiet|elektr|electric|install|water|lekkage|leak|verwarming|cv/ },
  { value: 'food', pattern: /food|eten|restaurant|cater|takeaway|thuiskeuken|bakker|bakery|taart|indian|indiaas|spiceindia/ },
  { value: 'auto', pattern: /auto|garage|car\b|fiets|bike|bicycle|detail|mobiliteit/ },
];

function inferFilter(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 'all';
  return demandFilters.slice(1).find((item) => item.pattern.test(normalized))?.value ?? 'all';
}

export function ProviderDirectory({ items, initialQuery = '' }: { items: ProviderItem[]; initialQuery?: string }) {
  const lang = useLang();
  const t = useDict();
  const d = t.directory;
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(() => inferFilter(initialQuery));
  const activeFilter = demandFilters.find((item) => item.value === filter) ?? demandFilters[0];
  const label = (value: string) => d.filters[value] ?? value;
  const base = lp(lang, '/businesses');

  const filtered = useMemo(() => items.filter((item) => {
    const haystack = `${item.title} ${item.meta} ${item.description} ${item.searchText ?? ''} ${item.postcode}`.toLowerCase();
    const q = query.trim().toLowerCase();
    const queryFilter = inferFilter(query);
    const matchesQuery = !q || (queryFilter !== 'all' ? queryFilter === filter : haystack.includes(q));
    return filter === 'all' ? matchesQuery : matchesQuery && activeFilter.pattern.test(haystack);
  }), [items, query, filter, activeFilter]);

  const requestHref = filter === 'all' && !query.trim()
    ? lp(lang, '/request')
    : lp(lang, `/request?category=${encodeURIComponent(filter)}${query.trim() ? `&query=${encodeURIComponent(query.trim())}` : ''}`);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    setFilter(inferFilter(value));
    window.history.replaceState({}, '', value ? `${base}?search=${encodeURIComponent(value)}` : base);
  }

  function chooseFilter(value: string) {
    setFilter(value);
    setQuery('');
    window.history.replaceState({}, '', value === 'all' ? base : `${base}?search=${encodeURIComponent(label(value))}`);
  }

  return (
    <div className="ds-page">
      <SiteHeader active="businesses" />
      <main id="main" className="uo-directory ds-directory">
        <section className="uo-directory-hero" aria-labelledby="directory-title">
          <div className="uo-directory-hero-inner">
            <div className="uo-directory-search-copy">
              <span className="uo-kicker">{d.kicker}</span>
              <h1 id="directory-title">{d.title}</h1>
              <p>{d.intro}</p>
              <form className="uo-directory-search" onSubmit={submitSearch} role="search">
                <Search aria-hidden="true" />
                <input type="search" name="search" value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) setFilter('all'); }} placeholder={d.placeholder} aria-label={d.searchLabel} autoComplete="off" enterKeyHint="search" />
                {query && <button type="button" onClick={() => { setQuery(''); setFilter('all'); window.history.replaceState({}, '', base); }} aria-label={d.clear}><X aria-hidden="true" /></button>}
                <button className="directory-search-submit" type="submit">{d.search}</button>
              </form>
              <div className="directory-service-chips" aria-label={d.chipsLabel}>
                {demandFilters.slice(1).map((item) => <button key={item.value} type="button" className={filter === item.value ? 'active' : ''} aria-pressed={filter === item.value} onClick={() => chooseFilter(item.value)}>{label(item.value)}</button>)}
              </div>
              <a className="directory-ai-help" href={requestHref}><Sparkles aria-hidden="true" /> {d.helpLink} <ArrowRight aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section className="uo-directory-results">
          <div className="uo-results-main">
            <div className="directory-result-intro">
              <div><span className="uo-kicker">{filter === 'all' ? d.allKicker : label(filter)}</span><h2>{filter === 'all' ? d.allTitle : d.filteredTitle(label(filter))}</h2><p>{d.count(filtered.length)}{query ? d.forQuery(query) : ''}</p></div>
              {filter !== 'all' && <button className="uo-reset-button" type="button" onClick={() => chooseFilter('all')}>{d.showAll}</button>}
            </div>

            {items.length === 0 ? (
              <div className="uo-empty"><MapPin aria-hidden="true" /><h3>{d.emptyTitle}</h3><p>{d.emptyText}</p><div className="discovery-empty-actions"><a href={lp(lang, '/request')}>{d.emptyHelp} <ArrowRight aria-hidden="true" /></a><a href={lp(lang, '/signup/account?role=provider')}>{d.emptyList} <ArrowRight aria-hidden="true" /></a></div></div>
            ) : filtered.length === 0 ? (
              <div className="uo-empty uo-empty-inline"><Search aria-hidden="true" /><h3>{d.noMatchTitle}</h3><p>{d.noMatchText}</p><a href={requestHref}>{d.noMatchCta} <ArrowRight aria-hidden="true" /></a></div>
            ) : (
              <div className="directory-provider-cards">
                {filtered.map((item) => (
                  <article key={item.id ?? item.title} className="directory-provider-card">
                    <div className="directory-provider-avatar" aria-hidden="true">{item.title.slice(0, 1).toUpperCase()}</div>
                    <div className="directory-provider-copy">
                      <div className="directory-provider-topline"><span>{item.meta}</span>{item.verified && <span className="directory-provider-verified"><BadgeCheck aria-hidden="true" /> {t.common.verified}</span>}</div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="directory-provider-meta"><span><MapPin aria-hidden="true" /> {t.common.town} · {item.postcode}</span></div>
                      <div className="uo-provider-actions">
                        {item.id && <a href={lp(lang, `/businesses/${item.id}`)}>{t.common.viewProfile} <ArrowRight aria-hidden="true" /></a>}
                        {item.phone && <a href={`tel:${item.phone.replace(/\s/g, '')}`} aria-label={t.common.call(item.title)}><Phone aria-hidden="true" /></a>}
                        {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" aria-label={t.common.websiteOf(item.title)}><Globe aria-hidden="true" /></a>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {items.length > 0 && <div className="directory-lead-card"><div><span className="uo-kicker">{d.leadKicker}</span><h3>{d.leadTitle}</h3><p>{d.leadText}</p></div><a href={requestHref}><MessageCircle aria-hidden="true" /> {d.leadCta} <ArrowRight aria-hidden="true" /></a></div>}
            <p className="directory-grow"><strong>{d.growKicker}</strong> {d.growText} <a href={lp(lang, '/signup/account?role=provider')}>{d.growCta} <ArrowRight aria-hidden="true" /></a></p>
          </div>
        </section>

        <section className="directory-seo-copy"><div><span className="uo-kicker">{d.seoKicker}</span><h2>{d.seoTitle}</h2><p>{d.seoText}</p><div className="directory-seo-links">{Object.entries(t.service.services).map(([slug, [, , short]]) => <a key={slug} href={lp(lang, `/diensten/${slug}`)}>{short}</a>)}</div></div></section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
