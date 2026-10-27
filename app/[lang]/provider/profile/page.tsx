import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth/session';
import { getOwnBusiness } from '../../../../lib/data/businesses';
import ProviderProfileForm from '../../../../components/provider-profile-form';
import { AppHeader } from '../../../../components/app-header';
import { isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { getDictionary } from '../../../../lib/i18n/dictionaries';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProviderProfilePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = getDictionary(lang);
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/provider/profile'))}`);
  const business = await getOwnBusiness(user);
  if (!business) redirect(lp(lang, '/signup/account?role=provider'));
  return <div className="ds-page"><AppHeader links={[[lp(lang, '/provider'), t.common.backToDashboard]]} /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard"><div className="platform-dashboard-head"><div><span className="uo-kicker">{t.provider.profileKicker}</span><h1>{t.provider.profileTitle}</h1><p>{t.provider.profileIntro}</p></div></div><ProviderProfileForm business={business} /></div></main></div>;
}
