import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppHeader } from '../../../components/app-header';
import { getCurrentUser } from '../../../lib/auth/session';
import { isLocale, lp, type Locale } from '../../../lib/i18n/config';
import { tr, type Ctx } from './_ui';
import Dashboard from './_sections/dashboard';
import Businesses from './_sections/businesses';
import Users from './_sections/users';
import Requests from './_sections/requests';
import Payments from './_sections/payments';
import Contacts from './_sections/contacts';
import Issues from './_sections/issues';
import Emails from './_sections/emails';
import Audit from './_sections/audit';
import Settings from './_sections/settings';
import Reviews from './_sections/reviews';
import Urgent from './_sections/urgent';

export const metadata: Metadata = { title: 'Admin · Uithoorn.online', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const TABS = ['dashboard', 'businesses', 'users', 'requests', 'urgent', 'payments', 'contacts', 'issues', 'reviews', 'emails', 'audit', 'settings'] as const;
type Tab = (typeof TABS)[number];
// Old tab names keep working.
const ALIASES: Record<string, Tab> = { stats: 'dashboard', inbox: 'contacts', leads: 'requests' };

const FLASH: Record<string, [string, string]> = {
  saved: ['Opgeslagen.', 'Saved.'], created: ['Aangemaakt.', 'Created.'], deleted: ['Verwijderd.', 'Deleted.'], approved: ['Goedgekeurd. De eigenaar krijgt een e-mail.', 'Approved. The owner gets an email.'],
  rejected: ['Afgewezen. De eigenaar krijgt een e-mail.', 'Rejected. The owner gets an email.'], assigned: ['Lead doorgestuurd.', 'Lead sent.'], payment_applied: ['Betaling verwerkt: pakket/credits bijgewerkt.', 'Payment applied: plan/credits updated.'],
  receipt_sent: ['Betaalbewijs verstuurd.', 'Receipt sent.'], reply_sent: ['Antwoord verstuurd.', 'Reply sent.'], reset_sent: ['Resetlink verstuurd.', 'Reset link sent.'], email_skipped: ['Opgeslagen, maar e-mail is niet ingesteld (RESEND_API_KEY ontbreekt).', 'Saved, but email is not configured (RESEND_API_KEY missing).'],
};
const ERRORS: Record<string, [string, string]> = {
  migration_pending: ['Dit onderdeel heeft database-migratie 0002 nodig.', 'This needs database migration 0002.'], confirm_required: ['Typ ter bevestiging precies wat er staat.', 'Type the confirmation exactly as shown.'],
  confirm_mismatch: ['De bevestiging klopt niet.', 'The confirmation does not match.'], cannot_demote_self: ['Je kunt je eigen adminrol niet weghalen.', "You can't remove your own admin role."],
  cannot_suspend_self: ['Je kunt jezelf niet blokkeren.', "You can't suspend yourself."], cannot_delete_self: ['Je kunt je eigen account hier niet verwijderen.', "You can't delete your own account here."],
  owner_not_found: ['Geen account met dat e-mailadres.', 'No account with that email.'], email_exists: ['Dat e-mailadres is al in gebruik.', 'That email is already in use.'],
  email_failed: ['De e-mail kon niet worden verstuurd (zie E-mails).', 'The email could not be sent (see Emails).'], already_assigned: ['Dit bedrijf heeft deze aanvraag al.', 'This business already has this request.'],
  invalid_amount: ['Ongeldig bedrag.', 'Invalid amount.'], business_required: ['Kies een bedrijf.', 'Choose a business.'], plan_required: ['Kies een pakket.', 'Choose a plan.'], no_recipient: ['Geen eigenaar-e-mail of niet betaald.', 'No owner email, or not paid.'],
  not_found: ['Niet gevonden.', 'Not found.'], invalid_photo_url: ['Gebruik een https-link of een pad dat met / begint.', 'Use an https link or a path starting with /.'],
};

export default async function AdminPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { lang: raw } = await params;
  const sp = await searchParams;
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = tr(lang);
  const user = await getCurrentUser();
  if (!user) redirect(`${lp(lang, '/login')}?next=${encodeURIComponent(lp(lang, '/admin'))}`);
  if (user.role !== 'admin') redirect(lp(lang, '/'));
  const requested = sp.tab ?? 'dashboard';
  const tab: Tab = (TABS as readonly string[]).includes(requested) ? requested as Tab : ALIASES[requested] ?? 'dashboard';
  const base = lp(lang, '/admin');
  const keep = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (v && k !== 'ok' && k !== 'err') keep.set(k, v); keep.set('tab', tab);
  const ctx: Ctx = { lang, base, sp: { ...sp, tab }, ret: `${base}?${keep}` };
  const labels: Record<Tab, string> = {
    dashboard: t('Overzicht', 'Overview'), businesses: t('Bedrijven', 'Businesses'), users: t('Accounts', 'Accounts'), requests: t('Aanvragen', 'Requests'), urgent: t('Spoed', 'Urgent'), payments: t('Betalingen', 'Payments'),
    contacts: t('Contact', 'Contacts'), issues: t('Issues', 'Issues'), reviews: t('Reviews', 'Reviews'), emails: t('E-mails', 'Emails'), audit: t('Logboek', 'Audit log'), settings: t('Instellingen', 'Settings'),
  };
  const flash = sp.ok ? FLASH[sp.ok]?.[lang === 'en' ? 1 : 0] ?? t('Gelukt.', 'Done.') : null;
  const error = sp.err ? ERRORS[sp.err]?.[lang === 'en' ? 1 : 0] ?? `${t('Fout', 'Error')}: ${sp.err}` : null;
  const Section = { dashboard: Dashboard, businesses: Businesses, users: Users, requests: Requests, urgent: Urgent, payments: Payments, contacts: Contacts, issues: Issues, reviews: Reviews, emails: Emails, audit: Audit, settings: Settings }[tab];

  return <div className="ds-page adm-page"><AppHeader /><main id="main" className="platform-shell ds-platform adm-main"><div className="platform-dashboard admin-dashboard adm-shell">
    <header className="adm-head">
      <div><span className="uo-kicker">Uithoorn.online</span><h1>{t('Beheer', 'Admin')}</h1></div>
      <a className="adm-me" href={lp(lang, '/account/settings')} title={t('Account & wachtwoord', 'Account & password')}>{user.email}</a>
    </header>
    <nav className="admin-tabs adm-tabs" aria-label={t('Beheer', 'Admin')}>{TABS.map((k) => <a key={k} href={`${base}?tab=${k}`} aria-current={k === tab ? 'page' : undefined} className={k === tab ? 'active' : ''}>{labels[k]}</a>)}</nav>
    {flash ? <p className="adm-flash adm-flash-ok" role="status">{flash}</p> : null}
    {error ? <p className="adm-flash adm-flash-err" role="alert">{error}</p> : null}
    <section className="dashboard-section admin-section adm-section"><Section ctx={ctx} user={user} /></section>
  </div></main></div>;
}
