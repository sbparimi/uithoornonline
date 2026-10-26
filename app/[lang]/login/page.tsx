import type { Metadata } from 'next';
import LoginForm from '../../../components/login-form';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { alternatesFor, isLocale, type Locale } from '../../../lib/i18n/config';
import { getDictionary } from '../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return { title: getDictionary(lang).login.metaTitle, alternates: alternatesFor(lang, '/login'), robots: { index: false, follow: true } };
}

export default async function LoginPage({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return <div className="ds-page"><SiteHeader /><main id="main" className="platform-shell ds-platform"><LoginForm /></main><SiteFooter lang={lang} /></div>;
}
