'use client';

import { ArrowRight, BadgeCheck, ChevronDown, Globe, Loader2, MapPin, MessageCircle, Phone, Search, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { lp, type Locale } from '../../lib/i18n/config';
import { directoryText } from '../../lib/directory/i18n';
import { CATEGORIES, CATEGORY_BY_SLUG, PLACES, SECTIONS, SECTION_BY_ID, type PlaceId, type SectionId } from '../../lib/directory/taxonomy';
import type { DirectoryCard, DirectoryPayload } from '../../lib/directory/data';
import { SectionIcon } from './icons';

export type ExplorerState = { q: string; section: SectionId | null; category: string | null; place: PlaceId | null; has: ('website' | 'phone')[]; sort: 'relevance' | 'az' | 'newest' };

type Props = {
  lang: Locale;
  initial: DirectoryPayload;
  initialState: ExplorerState;
  page: number;
  sectionTotals: Record<string, number>;
  categoryTotals: Record<string, number>;
  seoLinks: { href: string; label: string }[];
};

const PAGE = 24;

function sectionOf(state: ExplorerState): SectionId | null {
  if (state.category) return CATEGORY_BY_SLUG.get(state.category)?.section ?? null;
  return state.section;
}

export function urlFor(lang: Locale, s: ExplorerState, page = 1) {
  const base = s.category ? `/businesses/categorie/${s.category}` : s.section ? `/businesses/categorie/${SECTION_BY_ID.get(s.section)?.slug ?? s.section}` : '/businesses';
  const p = new URLSearchParams();
  if (s.q.trim()) p.set('q', s.q.trim());
  if (s.place) p.set('plaats', s.place);
  if (s.has.length) p.set('met', s.has.join(','));
  if (s.sort !== 'relevance') p.set('sort', s.sort);
  if (page > 1) p.set('pagina', String(page));
  const qs = p.toString();
  return `${lp(lang, base)}${qs ? `?${qs}` : ''}`;
}

function apiFor(lang: Locale, s: ExplorerState, offset: number, limit = PAGE) {
  const p = new URLSearchParams({ lang, offset: String(offset), limit: String(limit) });
  if (s.q.trim()) p.set('q', s.q.trim());
  if (s.section) p.set('sectie', s.section);
  if (s.category) p.set('categorie', s.category);
  if (s.place) p.set('plaats', s.place);
  if (s.has.length) p.set('met', s.has.join(','));
  if (s.sort !== 'relevance') p.set('sort', s.sort);
  return `/api/directory?${p.toString()}`;
}

function stateFromLocation(): ExplorerState {
  const url = new URL(window.location.href);
  const m = url.pathname.match(/\/businesses\/categorie\/([a-z0-9-]+)/);
  const slug = m?.[1] ?? null;
  const category = slug && CATEGORY_BY_SLUG.has(slug) ? slug : null;
  const section = !category && slug && SECTION_BY_ID.has(slug as SectionId) ? (slug as SectionId) : null;
  const place = (['uithoorn', 'de-kwakel', 'omgeving'] as const).find((p) => p === url.searchParams.get('plaats')) ?? null;
  const has = (url.searchParams.get('met') || '').split(',').filter((h): h is 'website' | 'phone' => h === 'website' || h === 'phone');
  const sortRaw = url.searchParams.get('sort');
  return { q: url.searchParams.get('q') || url.searchParams.get('search') || '', section, category, place, has, sort: sortRaw === 'az' || sortRaw === 'newest' ? sortRaw : 'relevance' };
}

export function DirectoryExplorer({ lang, initial, initialState, page, sectionTotals, categoryTotals, seoLinks }: Props) {
  const t = directoryText[lang];
  const [state, setState] = useState<ExplorerState>(initialState);
  const [data, setData] = useState<DirectoryPayload>(initial);
  const [items, setItems] = useState<DirectoryCard[]>(initial.items);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pageShown, setPageShown] = useState(page);
  const first = useRef(true);
  const seq = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const currentSection = sectionOf(state);
  const scoped = !!(state.category || state.section);
  const browsing = !state.q.trim() && !scoped && !state.place && !state.has.length;

  // Fetch whenever the search or filters change (typing is debounced).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = ++seq.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(apiFor(lang, state, 0));
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as DirectoryPayload;
        if (id !== seq.current) return;
        setData(next); setItems(next.items); setPageShown(1); setActive(-1);
      } catch { /* keep the previous results on a network hiccup */ }
      finally { if (id === seq.current) setLoading(false); }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [lang, state]);

  // Back/forward restores the matching search.
  useEffect(() => {
    const onPop = () => setState(stateFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((patch: Partial<ExplorerState>, mode: 'push' | 'replace' = 'push') => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      const url = urlFor(lang, next);
      if (mode === 'push') window.history.pushState(null, '', url); else window.history.replaceState(null, '', url);
      return next;
    });
  }, [lang]);

  const chooseSection = (id: SectionId | null) => { update({ section: id, category: null }); setDrawer(false); };
  const chooseCategory = (slug: string | null) => { if (slug) update({ category: slug, section: null }); else update({ category: null }); setDrawer(false); };
  const scrollToResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  async function loadMore(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(apiFor(lang, state, items.length));
      if (res.ok) {
        const next = (await res.json()) as DirectoryPayload;
        setItems((prev) => [...prev, ...next.items.filter((n) => !prev.some((p) => p.id === n.id))]);
        const nextPage = pageShown + 1; setPageShown(nextPage);
        window.history.replaceState(null, '', urlFor(lang, state, nextPage));
      }
    } finally { setLoadingMore(false); }
  }

  // ---------- typeahead ----------
  const suggestionCats = state.q.trim() ? data.suggestions.categories.filter((c) => c.count > 0 || data.total === 0).slice(0, 4) : [];
  const suggestionBiz = state.q.trim() ? items.slice(0, 5) : [];
  const options = useMemo(() => [
    ...suggestionCats.map((c) => ({ kind: 'cat' as const, key: `c-${c.slug}`, slug: c.slug })),
    ...suggestionBiz.map((b) => ({ kind: 'biz' as const, key: `b-${b.id}`, id: b.id })),
  ], [suggestionCats, suggestionBiz]);
  const showSuggest = suggestOpen && state.q.trim().length > 0 && (options.length > 0);

  function pick(i: number) {
    const o = options[i];
    if (!o) return;
    if (o.kind === 'cat') { update({ category: o.slug, section: null, q: '' }); setSuggestOpen(false); inputRef.current?.blur(); scrollToResults(); }
    else window.location.href = lp(lang, `/businesses/${o.id}`);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggest) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { setSuggestOpen(false); setActive(-1); }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuggestOpen(false); inputRef.current?.blur();
    update({ q: state.q }, 'push');
    scrollToResults();
  }

  const catLabel = (slug: string) => CATEGORY_BY_SLUG.get(slug)?.[lang] ?? slug;
  const secLabel = (id: SectionId) => SECTION_BY_ID.get(id)?.[lang] ?? id;
  const sectionCats = currentSection ? CATEGORIES.filter((c) => c.section === currentSection) : [];

  const heading = state.category ? catLabel(state.category) : state.section ? secLabel(state.section) : null;
  const totalInScope = state.category ? (categoryTotals[state.category] ?? 0) : state.section ? (sectionTotals[state.section] ?? 0) : data.totalListed;
  const filterCount = (state.place ? 1 : 0) + state.has.length + (state.sort !== 'relevance' ? 1 : 0);
  const requestHref = lp(lang, `/request${state.q.trim() || state.category ? `?query=${encodeURIComponent(state.q.trim() || (state.category ? catLabel(state.category) : ''))}` : ''}`);

  const filtersPanel = (
    <>
      <div className="dir2-filter-group">
        <h3>{t.rubric}</h3>
        <ul className="dir2-filter-list">
          <li><button type="button" className={!currentSection ? 'is-active' : ''} aria-pressed={!currentSection} onClick={() => chooseSection(null)}><span>{t.allSections}</span><em>{data.facets.all}</em></button></li>
          {SECTIONS.map((s) => {
            const n = data.facets.sections[s.id] ?? 0;
            const on = currentSection === s.id;
            return (
              <li key={s.id}>
                <button type="button" className={on ? 'is-active' : ''} aria-pressed={on} onClick={() => chooseSection(s.id)} disabled={!n && !on}>
                  <SectionIcon name={s.icon} className="dir2-filter-icon" /><span>{s[lang]}</span><em>{n}</em>
                </button>
                {on && (
                  <ul className="dir2-filter-sub">
                    <li><button type="button" className={!state.category ? 'is-active' : ''} aria-pressed={!state.category} onClick={() => chooseSection(s.id)}><span>{t.allInSection(s[lang])}</span></button></li>
                    {sectionCats.map((c) => { const cn = data.facets.categories[c.slug] ?? 0; const con = state.category === c.slug; return (
                      <li key={c.slug}><button type="button" className={con ? 'is-active' : ''} aria-pressed={con} onClick={() => chooseCategory(c.slug)} disabled={!cn && !con}><span>{c[lang]}</span><em>{cn}</em></button></li>
                    ); })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="dir2-filter-group">
        <h3>{t.place}</h3>
        <div className="dir2-segment" role="radiogroup" aria-label={t.place}>
          <button type="button" role="radio" aria-checked={!state.place} className={!state.place ? 'is-active' : ''} onClick={() => update({ place: null })}>{t.placeAll}</button>
          {PLACES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={state.place === p.id} className={state.place === p.id ? 'is-active' : ''} onClick={() => update({ place: state.place === p.id ? null : p.id })}>
              {p[lang]} <em>{data.facets.places[p.id] ?? 0}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="dir2-filter-group">
        <h3>{t.contact}</h3>
        {(['phone', 'website'] as const).map((h) => (
          <label key={h} className="dir2-check">
            <input type="checkbox" checked={state.has.includes(h)} onChange={(e) => update({ has: e.target.checked ? [...state.has, h] : state.has.filter((x) => x !== h) })} />
            <span>{h === 'website' ? t.hasWebsite : t.hasPhone}</span>
          </label>
        ))}
      </div>
      <div className="dir2-filter-group dir2-only-mobile">
        <h3>{t.sort}</h3>
        <div className="dir2-segment" role="radiogroup" aria-label={t.sort}>
          {(['relevance', 'az', 'newest'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={state.sort === s} className={state.sort === s ? 'is-active' : ''} onClick={() => update({ sort: s })}>{s === 'relevance' ? t.sortRelevance : s === 'az' ? t.sortAz : t.sortNewest}</button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <main id="main" className="dir2">
      <section className="dir2-hero" aria-labelledby="dir2-title">
        <div className="dir2-wrap">
          <nav className="dir2-crumbs" aria-label="Breadcrumb">
            <a href={lp(lang, '/')}>{t.breadcrumbHome}</a><span aria-hidden="true">/</span>
            {heading ? <><a href={lp(lang, '/businesses')} onClick={(e) => { e.preventDefault(); update({ section: null, category: null }); }}>{t.breadcrumbAll}</a>
              {state.category && currentSection && <><span aria-hidden="true">/</span><a href={urlFor(lang, { ...state, category: null, section: currentSection })} onClick={(e) => { e.preventDefault(); chooseSection(currentSection); }}>{secLabel(currentSection)}</a></>}
              <span aria-hidden="true">/</span><span aria-current="page">{heading}</span>
            </> : <span aria-current="page">{t.breadcrumbAll}</span>}
          </nav>
          <h1 id="dir2-title">{heading ? <>{heading} <span>{t.titleAccent}</span></> : <>{t.title} <span>{t.titleAccent}</span></>}</h1>
          <p className="dir2-sub">{heading ? t.categorySub(totalInScope) : t.sub(data.totalListed)}</p>

          <form className="dir2-search" role="search" onSubmit={submit}>
            <div className={`dir2-searchbox${showSuggest ? ' is-open' : ''}`}>
              <Search aria-hidden="true" className="dir2-search-icon" />
              <input
                ref={inputRef}
                type="search" name="q" value={state.q} placeholder={t.placeholder} aria-label={t.searchLabel}
                autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
                role="combobox" aria-expanded={showSuggest} aria-controls={listId} aria-autocomplete="list"
                aria-activedescendant={showSuggest && active >= 0 ? `${listId}-${active}` : undefined}
                onChange={(e) => { update({ q: e.target.value }, 'replace'); setSuggestOpen(true); setActive(-1); }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
                onKeyDown={onKey}
              />
              {loading ? <Loader2 aria-hidden="true" className="dir2-spin" /> : state.q && <button type="button" className="dir2-clear" aria-label={t.clear} onClick={() => { update({ q: '' }, 'replace'); inputRef.current?.focus(); }}><X aria-hidden="true" /></button>}
              <button type="submit" className="dir2-search-btn">{t.searchButton}</button>
            </div>
            {showSuggest && (
              <ul className="dir2-suggest" id={listId} role="listbox" aria-label={t.searchLabel}>
                {suggestionCats.length > 0 && <li className="dir2-suggest-head" role="presentation">{t.suggestCategories}</li>}
                {suggestionCats.map((c, i) => {
                  const cat = CATEGORY_BY_SLUG.get(c.slug);
                  return (
                    <li key={c.slug} id={`${listId}-${i}`} role="option" aria-selected={active === i} className={active === i ? 'is-active' : ''} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
                      {cat && <SectionIcon name={SECTION_BY_ID.get(cat.section)!.icon} className="dir2-suggest-icon" />}
                      <span className="dir2-suggest-main">{catLabel(c.slug)}</span><em>{t.sectionCount(c.count)}</em>
                    </li>
                  );
                })}
                {suggestionBiz.length > 0 && <li className="dir2-suggest-head" role="presentation">{t.suggestBusinesses}</li>}
                {suggestionBiz.map((b, j) => {
                  const i = suggestionCats.length + j;
                  return (
                    <li key={b.id} id={`${listId}-${i}`} role="option" aria-selected={active === i} className={active === i ? 'is-active' : ''} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
                      <span className="dir2-suggest-avatar" aria-hidden="true">{b.name.slice(0, 1).toUpperCase()}</span>
                      <span className="dir2-suggest-main">{b.name}<small>{b.category}</small></span>
                    </li>
                  );
                })}
              </ul>
            )}
          </form>

          {browsing && (
            <div className="dir2-popular">
              <span>{t.popular}</span>
              {t.popularTerms.map((term) => <button key={term} type="button" onClick={() => { update({ q: term }); scrollToResults(); }}>{term}</button>)}
            </div>
          )}
        </div>
      </section>

      {browsing && (
        <section className="dir2-sections" aria-labelledby="dir2-sections-title">
          <div className="dir2-wrap">
            <h2 id="dir2-sections-title">{t.sectionsTitle}</h2>
            <ul className="dir2-tiles">
              {SECTIONS.map((s) => {
                const n = sectionTotals[s.id] ?? 0;
                return (
                  <li key={s.id}>
                    <a href={urlFor(lang, { ...state, section: s.id, category: null })} className={`dir2-tile${n ? '' : ' is-empty'}`} data-section={s.id}
                      onClick={(e) => { e.preventDefault(); chooseSection(s.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <span className="dir2-tile-icon"><SectionIcon name={s.icon} /></span>
                      <span className="dir2-tile-text"><strong>{s[lang]}</strong><small>{lang === 'nl' ? s.blurbNl : s.blurbEn}</small></span>
                      <span className="dir2-tile-count">{n || '–'}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="dir2-browse" ref={resultsRef} aria-label={t.results(data.total)}>
        <div className="dir2-wrap dir2-browse-grid">
          <aside className="dir2-sidebar" aria-label={t.filtersTitle}>{filtersPanel}</aside>

          <div className="dir2-results">
            {currentSection && (
              <div className="dir2-catchips" role="list">
                <button type="button" role="listitem" className={!state.category ? 'is-active' : ''} onClick={() => chooseSection(currentSection)}>{t.allInSection(secLabel(currentSection))}</button>
                {sectionCats.filter((c) => (categoryTotals[c.slug] ?? 0) > 0 || state.category === c.slug).map((c) => (
                  <button key={c.slug} type="button" role="listitem" className={state.category === c.slug ? 'is-active' : ''} onClick={() => chooseCategory(c.slug)}>{c[lang]} <em>{data.facets.categories[c.slug] ?? 0}</em></button>
                ))}
              </div>
            )}
            {!currentSection && !browsing && (
              <div className="dir2-catchips dir2-only-mobile" role="list">
                {SECTIONS.filter((s) => (data.facets.sections[s.id] ?? 0) > 0).map((s) => (
                  <button key={s.id} type="button" role="listitem" onClick={() => chooseSection(s.id)}><SectionIcon name={s.icon} className="dir2-chip-icon" />{s[lang]} <em>{data.facets.sections[s.id]}</em></button>
                ))}
              </div>
            )}

            <div className="dir2-toolbar">
              <p className="dir2-count" aria-live="polite">
                <strong>{t.results(data.total)}</strong>{state.q.trim() ? t.forQuery(state.q.trim()) : ''}
                {loading && <span className="dir2-sr"> {t.loading}</span>}
              </p>
              <div className="dir2-toolbar-actions">
                <button type="button" className="dir2-filter-btn" onClick={() => setDrawer(true)} aria-haspopup="dialog">
                  <SlidersHorizontal aria-hidden="true" /> {t.filters}{filterCount + (currentSection ? 1 : 0) > 0 && <span className="dir2-badge">{filterCount + (currentSection ? 1 : 0)}</span>}
                </button>
                <label className="dir2-sort">
                  <span className="dir2-sr">{t.sort}</span>
                  <select value={state.sort} onChange={(e) => update({ sort: e.target.value as ExplorerState['sort'] })}>
                    <option value="relevance">{t.sortRelevance}</option>
                    <option value="az">{t.sortAz}</option>
                    <option value="newest">{t.sortNewest}</option>
                  </select>
                  <ChevronDown aria-hidden="true" />
                </label>
              </div>
            </div>

            {(state.place || state.has.length > 0 || scoped || state.q.trim()) && (
              <div className="dir2-active">
                {state.q.trim() && <button type="button" onClick={() => update({ q: '' })}>“{state.q.trim()}” <X aria-hidden="true" /></button>}
                {state.category && <button type="button" onClick={() => chooseCategory(null)}>{catLabel(state.category)} <X aria-hidden="true" /></button>}
                {state.section && !state.category && <button type="button" onClick={() => chooseSection(null)}>{secLabel(state.section)} <X aria-hidden="true" /></button>}
                {state.place && <button type="button" onClick={() => update({ place: null })}>{PLACES.find((p) => p.id === state.place)?.[lang]} <X aria-hidden="true" /></button>}
                {state.has.map((h) => <button key={h} type="button" onClick={() => update({ has: state.has.filter((x) => x !== h) })}>{h === 'website' ? t.hasWebsite : t.hasPhone} <X aria-hidden="true" /></button>)}
                <button type="button" className="dir2-active-reset" onClick={() => update({ q: '', section: null, category: null, place: null, has: [], sort: 'relevance' })}>{t.resetFilters}</button>
              </div>
            )}

            {data.partial && items.length > 0 && <p className="dir2-partial">{t.partial}</p>}

            {items.length === 0 ? (
              <div className="dir2-empty">
                <Search aria-hidden="true" />
                <h2>{t.emptyTitle(state.q.trim())}</h2>
                <p>{t.emptyText}</p>
                {data.suggestions.categories.length > 0 && (
                  <div className="dir2-didyoumean"><span>{t.didYouMean}</span>
                    {data.suggestions.categories.map((c) => <button key={c.slug} type="button" onClick={() => update({ category: c.slug, section: null, q: '' })}>{catLabel(c.slug)}{c.count ? ` (${c.count})` : ''}</button>)}
                  </div>
                )}
                <div className="dir2-empty-sections">
                  {SECTIONS.filter((s) => (sectionTotals[s.id] ?? 0) > 0).map((s) => <button key={s.id} type="button" onClick={() => update({ q: '', section: s.id, category: null, place: null, has: [] })}><SectionIcon name={s.icon} className="dir2-chip-icon" />{s[lang]}</button>)}
                </div>
                <div className="dir2-empty-actions">
                  <a className="dir2-btn dir2-btn-primary" href={requestHref}><MessageCircle aria-hidden="true" /> {t.emptyRequest}</a>
                  <button type="button" className="dir2-btn" onClick={() => update({ q: '', section: null, category: null, place: null, has: [] })}>{t.emptyClear}</button>
                </div>
              </div>
            ) : (
              <ul className={`dir2-cards${loading ? ' is-loading' : ''}`}>
                {items.map((b) => <li key={b.id}><Card b={b} lang={lang} /></li>)}
              </ul>
            )}

            {items.length > 0 && (
              <div className="dir2-more">
                <p>{t.shownOf(items.length, data.total)}</p>
                {items.length < data.total && (
                  <a className="dir2-btn dir2-btn-wide" href={urlFor(lang, state, pageShown + 1)} onClick={loadMore} aria-busy={loadingMore}>
                    {loadingMore ? <Loader2 aria-hidden="true" className="dir2-spin" /> : null}{t.loadMore}
                  </a>
                )}
              </div>
            )}

            <div className="dir2-lead">
              <div><span className="dir2-kicker">{t.leadKicker}</span><h2>{t.leadTitle}</h2><p>{t.leadText}</p></div>
              <a className="dir2-btn dir2-btn-primary" href={requestHref}><MessageCircle aria-hidden="true" /> {t.leadCta} <ArrowRight aria-hidden="true" /></a>
            </div>
            <p className="dir2-grow">{t.growText} <a href={lp(lang, '/signup/account?role=provider')}>{t.growCta} <ArrowRight aria-hidden="true" /></a></p>
          </div>
        </div>
      </section>

      {seoLinks.length > 0 && (
        <section className="dir2-seo">
          <div className="dir2-wrap">
            <h2>{t.seoTitle}</h2>
            <div className="dir2-seo-links">{seoLinks.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}</div>
          </div>
        </section>
      )}

      {drawer && (
        <div className="dir2-drawer" role="dialog" aria-modal="true" aria-label={t.filtersTitle} onKeyDown={(e) => { if (e.key === 'Escape') setDrawer(false); }}>
          <button type="button" className="dir2-drawer-scrim" aria-label={t.close} onClick={() => setDrawer(false)} />
          <div className="dir2-drawer-sheet">
            <div className="dir2-drawer-head">
              <h2>{t.filtersTitle}</h2>
              <button type="button" className="dir2-drawer-close" onClick={() => setDrawer(false)} aria-label={t.close} autoFocus><X aria-hidden="true" /></button>
            </div>
            <div className="dir2-drawer-body">{filtersPanel}</div>
            <div className="dir2-drawer-foot">
              <button type="button" className="dir2-btn" onClick={() => update({ section: null, category: null, place: null, has: [], sort: 'relevance' })}>{t.resetFilters}</button>
              <button type="button" className="dir2-btn dir2-btn-primary" onClick={() => { setDrawer(false); scrollToResults(); }}>{t.showResults(data.total)}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Card({ b, lang }: { b: DirectoryCard; lang: Locale }) {
  const t = directoryText[lang];
  const section = SECTION_BY_ID.get(b.section);
  const href = lp(lang, `/businesses/${b.id}`);
  const where = [b.town || t.nearby, b.postcode].filter(Boolean).join(' · ');
  return (
    <article className="dir2-card" data-section={b.section}>
      <a className="dir2-card-main" href={href} aria-label={t.viewAria(b.name)}>
        <span className="dir2-card-icon" aria-hidden="true">{section ? <SectionIcon name={section.icon} /> : b.name.slice(0, 1)}</span>
        <span className="dir2-card-body">
          <span className="dir2-card-cat">{b.category}</span>
          <span className="dir2-card-name">{b.name}{b.verified && <BadgeCheck className="dir2-verified" aria-label={t.verified} />}</span>
          {b.line && <span className="dir2-card-line">{b.line}</span>}
          <span className="dir2-card-where"><MapPin aria-hidden="true" /> {where}</span>
        </span>
      </a>
      <div className="dir2-card-actions">
        {b.phone && <a className="dir2-btn dir2-btn-sm" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} aria-label={t.callAria(b.name)}><Phone aria-hidden="true" /> {t.call}</a>}
        {b.website && <a className="dir2-btn dir2-btn-sm" href={b.website} target="_blank" rel="noopener noreferrer" aria-label={t.websiteAria(b.name)}><Globe aria-hidden="true" /> {t.website}</a>}
        <a className="dir2-btn dir2-btn-sm dir2-btn-ghost" href={href}>{t.view} <ArrowRight aria-hidden="true" /></a>
      </div>
    </article>
  );
}
