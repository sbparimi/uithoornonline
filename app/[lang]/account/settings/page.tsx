import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../../../components/app-header';
import { AccountSettings } from '../../../../components/account-settings';
import { getCurrentUser } from '../../../../lib/auth/session';
import { queryOne } from '../../../../lib/db';
import { isLocale, lp, type Locale } from '../../../../lib/i18n/config';
import { getBackendDict } from '../../../../lib/i18n/backend';

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const s = getBackendDict(lang).settings;
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/account/settings'))}`);
  const row = await queryOne<{ has_password: boolean; locale: 'nl' | 'en' }>('select password_hash is not null as has_password, locale from users where id = $1', [user.id]);
  const back = lp(lang, user.role === 'provider' ? '/provider' : user.role === 'admin' ? '/admin' : '/account');
  return <div className="ds-page"><AppHeader links={[[back, lang === 'en' ? 'Back to dashboard' : 'Terug naar dashboard']]} /><main id="main" className="platform-shell ds-platform"><div className="platform-dashboard">
    <div className="platform-dashboard-head"><div><span className="uo-kicker">{s.title}</span><h1>{s.title}</h1><p>{s.intro}</p></div></div>
    <AccountSettings email={user.email} fullName={user.fullName} phone={user.phone} locale={row?.locale ?? 'nl'} hasPassword={Boolean(row?.has_password)} viaLink={user.authMethod === 'email_link' && user.sessionAgeSeconds < 1800} isAdmin={user.role === 'admin'} />
  </div></main></div>;
}
