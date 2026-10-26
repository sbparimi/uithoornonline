import type { Metadata } from 'next';
import { ArrowRight, MapPin, MessageCircle } from 'lucide-react';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { alternatesFor, isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };

async function langOf(params: Props['params']): Promise<Locale> {
  const { lang } = await params;
  return isLocale(lang) ? lang : 'nl';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await langOf(params);
  const t = getDictionary(lang).food;
  return { title: { absolute: t.metaTitle }, description: t.metaDescription, alternates: alternatesFor(lang, '/food') };
}

export default async function FoodPage({ params }: Props) {
  const lang = await langOf(params);
  const t = getDictionary(lang).food;
  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="uo-directory ds-directory">
      <section className="uo-directory-hero"><div className="uo-directory-hero-inner"><div className="uo-directory-search-copy"><span className="uo-kicker">{t.kicker}</span><h1>{t.h1a} <em>{t.h1b}</em></h1><p>{t.intro}</p></div></div></section>
      <section className="uo-directory-results">
        <article className="food-feature">
          <div>
            <p className="ds-kicker">{t.cardKicker}</p>
            <h2>{t.cardA} <em>{t.cardB}</em></h2>
            <p className="food-dishes">Chicken Dum Biryani · Paneer Dum Biryani · Masala Dosa · Idli · Vada · Chicken 65 · Paneer Butter Masala</p>
            <p className="food-meta"><MapPin aria-hidden="true" /> {t.hours}</p>
            <p><strong>{t.areasLabel}</strong> {t.areas}</p>
            <p><strong>{t.cateringLabel}</strong> {t.catering}</p>
          </div>
          <div className="food-actions">
            <a className="btn btn-primary" href="https://www.spiceindia.nl/" target="_blank" rel="noopener noreferrer">{t.menu} <ArrowRight aria-hidden="true" /></a>
            <a className="btn btn-secondary" href="https://wa.me/31645480446" target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> {t.order}</a>
            <small>{t.note}</small>
          </div>
        </article>
        <div className="directory-lead-card"><div><span className="uo-kicker">{t.inviteKicker}</span><h3>{t.inviteTitle}</h3><p>{t.inviteText}</p></div><a href={lp(lang, '/signup/account?role=provider')}>{t.inviteCta} <ArrowRight aria-hidden="true" /></a></div>
      </section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
