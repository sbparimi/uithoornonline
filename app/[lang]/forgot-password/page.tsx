import type { Metadata } from 'next';
import { ForgotPasswordForm } from '../../../components/password-reset-forms';
import { SiteHeader } from '../../../components/site-header';
import { SiteFooter } from '../../../components/site-footer';
import { isLocale, type Locale } from '../../../lib/i18n/config';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return { title: lang === 'en' ? 'Forgot password' : 'Wachtwoord vergeten', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function Page({ params }: Props) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return <div className="ds-page"><SiteHeader /><main id="main" className="platform-shell ds-platform"><ForgotPasswordForm /></main><SiteFooter lang={lang} /></div>;
}
