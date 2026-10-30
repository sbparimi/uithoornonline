import type { Metadata } from 'next';
import { ArrowRight, MapPin } from 'lucide-react';
import '../../seo-landing.css';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { SectionIcon } from '../../../components/directory/icons';
import { isLocale, lp, seo, type Locale } from '../../../lib/i18n/config';
import { CATEGORY_BY_SLUG, SECTION_BY_ID, SECTIONS } from '../../../lib/directory/taxonomy';
import { SEO_SERVICES, SEO_TOWNS } from '../../../lib/seo/services';
import { serviceCounts } from '../../../lib/seo/listings';
import { seoText } from '../../../lib/seo/text';
import { intakeEnabled } from '../../../lib/urgent/flags';

export const revalidate = 300;

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = seoText[lang];
  return { title: t.indexTitle, description: t.indexMeta, ...seo(lang, '/diensten', t.indexTitle, t.indexMeta) };
}

export default async function ServicesIndex({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = seoText[lang];
  const counts = await serviceCounts();
  const requestHref = intakeEnabled() ? lp(lang, '/hulp?bron=diensten') : lp(lang, '/request');
  const groups = SECTIONS.map((sec) => ({ sec, items: SEO_SERVICES.filter((s) => CATEGORY_BY_SLUG.get(s.category)?.section === sec.id) })).filter((g) => g.items.length);
  return (
    <div className="ds-page dir2-page">
      <SiteHeader active="businesses" />
      <main id="main" className="dir2 seo-svc">
        <section className="dir2-hero seo-svc-hero">
          <div className="dir2-wrap">
            <nav className="dir2-crumbs" aria-label="Breadcrumb"><a href={lp(lang, '/')}>{t.home}</a><span aria-hidden="true">/</span><span aria-current="page">{t.services}</span></nav>
            <h1>{t.indexTitle}</h1>
            <p className="dir2-sub">{t.indexSub}</p>
            <div className="seo-svc-cta"><a className="dir2-btn dir2-btn-primary dir2-btn-wide" href={requestHref}>{t.cta} <ArrowRight aria-hidden="true" /></a><span className="seo-svc-cta-note">{t.ctaNote}</span></div>
          </div>
        </section>
        <div className="dir2-wrap seo-svc-body">
          {groups.map(({ sec, items }) => (
            <section key={sec.id} className="seo-idx-group">
              <h2><span className="seo-svc-icon sm" aria-hidden="true"><SectionIcon name={SECTION_BY_ID.get(sec.id)!.icon} /></span>{sec[lang]}</h2>
              <ul className="seo-idx-list">
                {items.map((s) => (
                  <li key={s.slug} className="seo-idx-item">
                    <a className="seo-idx-name" href={lp(lang, `/diensten/${s.slug}`)}>{s[lang].title}<em className={counts[s.slug] ? '' : 'is-open'}>{counts[s.slug] ? t.count(counts[s.slug]) : t.open}</em></a>
                    <span className="seo-idx-towns">{SEO_TOWNS.map((x) => <a key={x.slug} href={lp(lang, `/diensten/${s.slug}/${x.slug}`)}><MapPin aria-hidden="true" /> {x.name}</a>)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
