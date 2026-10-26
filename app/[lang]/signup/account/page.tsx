import type { Metadata } from 'next';
import AccountSignup from '../../../../components/account-signup';
import { SiteHeader } from '../../../../components/site-header';
import { SiteFooter } from '../../../../components/site-footer';
import { isLocale, seo, type Locale } from '../../../../lib/i18n/config';
import { getDictionary } from '../../../../lib/i18n/dictionaries';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ role?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang).signup;
  return { title: t.metaTitle, description: t.metaDescription, ...seo(lang, '/signup/account', t.metaTitle, t.metaDescription) };
}

export default async function AccountSignupPage({ params, searchParams }: Props) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return <div className="ds-page"><SiteHeader /><main id="main" className="platform-shell ds-platform"><AccountSignup initialRole={sp.role === 'provider' ? 'provider' : 'customer'} /></main><SiteFooter lang={lang} /></div>;
}
