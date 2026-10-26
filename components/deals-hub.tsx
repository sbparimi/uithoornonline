'use client';

import { ArrowRight, Search, Tag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { lp } from '../lib/i18n/config';
import { useDict, useLang } from './lang-context';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';

type Deal = { slug: string; title: string; label: string; description: string };

export default function DealsHub({ deals }: { deals: Deal[] }) {
  const lang = useLang();
  const t = useDict().deals;
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => deals.filter((deal) => `${deal.title} ${deal.label} ${deal.description}`.toLowerCase().includes(query.trim().toLowerCase())), [deals, query]);

  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="discovery-page ds-discovery">
      <section className="discovery-hero discovery-hero-orange"><div><span className="uo-kicker">{t.kicker}</span><h1>{t.h1a} <em>{t.h1b}</em></h1><p>{t.intro}</p>{deals.length > 0 && <div className="discovery-search"><Search aria-hidden="true" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.placeholder} aria-label={t.searchLabel} /></div>}</div><div className="discovery-hero-art orange" aria-hidden="true"><Tag /></div></section>
      <section className="discovery-content">{deals.length > 0 && <div className="discovery-toolbar"><strong>{t.count(filtered.length)}</strong><span>Uithoorn &amp; De Kwakel</span></div>}{filtered.length ? <div className="deal-grid">{filtered.map((deal) => <article className="deal-card" key={deal.slug}><span>{deal.label}</span><h2>{deal.title}</h2><p>{deal.description}</p><a href={lp(lang, `/deals/${deal.slug}`)}>{t.view} <ArrowRight aria-hidden="true" /></a></article>)}</div> : <div className="discovery-empty"><Tag aria-hidden="true" /><h2>{t.emptyTitle}</h2><p>{t.emptyText}</p><div className="discovery-empty-actions"><a className="discovery-primary" href={lp(lang, '/businesses')}>{t.discover} <ArrowRight aria-hidden="true" /></a><a className="discovery-secondary" href={lp(lang, '/signup/account?role=provider')}>{t.post} <ArrowRight aria-hidden="true" /></a></div></div>}</section>
      <section className="discovery-bottom-cta"><div><span className="uo-kicker">{t.bottomKicker}</span><h2>{t.bottomTitle}</h2><p>{t.bottomText}</p></div><a className="discovery-primary" href={lp(lang, '/signup/account?role=provider')}>{t.bottomCta} <ArrowRight aria-hidden="true" /></a></section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
