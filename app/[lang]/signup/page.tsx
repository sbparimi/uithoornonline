import type { Metadata } from 'next';
import ContributionHub from '../../../components/contribution-hub';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { isLocale, seo, lp, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Kind = 'business' | 'tip';
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ kind?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).contribution;
  return { title: t.metaTitle, description: t.metaDescription, ...seo(lang, '/signup', t.metaTitle, t.metaDescription) };
}

export default async function SignupPage({ params, searchParams }: Props) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).contribution;
  const initialKind: Kind = sp.kind === 'tip' ? 'tip' : 'business';
  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="contribution-page ds-discovery">
      <section className="contribution-hero"><span className="uo-kicker">{t.kicker}</span><h1>{t.h1a} <em>{t.h1b}</em></h1><p>{t.intro}</p></section>
      <section className="contribution-content"><ContributionHub initialKind={initialKind} /><div className="contribution-account-note">{t.accountNote} <a href={lp(lang, '/signup/account')}>{t.accountLink} <span aria-hidden="true">→</span></a></div></section>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
