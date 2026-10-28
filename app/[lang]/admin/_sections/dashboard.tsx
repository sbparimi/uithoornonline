import type { SessionUser } from '../../../../lib/auth/session';
import { dashboard } from '../../../../lib/admin/misc';
import { Card, eur, fmtDate, MigrationNotice, tr, type Ctx } from '../_ui';

export default async function Dashboard({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const d = await dashboard(user);
  const c = d.counts as Record<string, number | undefined>;
  const tile = (label: string, value: string | number | undefined, href: string, hot = false) =>
    <a className={`adm-tile ${hot ? 'adm-tile-hot' : ''}`} href={`${ctx.base}?${href}`}><span>{label}</span><strong>{value ?? '–'}</strong></a>;
  return <>
    {d.migrationPending ? <MigrationNotice lang={ctx.lang} /> : null}
    <div className="adm-tiles">
      {tile(t('Bedrijven', 'Businesses'), c.businesses, 'tab=businesses')}
      {tile(t('Wacht op goedkeuring', 'Awaiting approval'), c.businesses_pending, 'tab=businesses&status=pending', (c.businesses_pending ?? 0) > 0)}
      {tile(t('Accounts', 'Accounts'), c.users, 'tab=users')}
      {tile(t('Nieuw (30 dagen)', 'New (30 days)'), c.users_30d, 'tab=users')}
      {tile(t('Open aanvragen', 'Open requests'), c.open_requests, 'tab=requests&status=open')}
      {tile(t('Leads deze maand', 'Leads this month'), c.leads_month, 'tab=requests')}
      {tile(t('Open issues', 'Open issues'), c.open_issues, 'tab=issues&status=open', (c.open_issues ?? 0) > 0)}
      {tile(t('Onbetaald', 'Unpaid'), c.unpaid_payments === undefined ? undefined : `${c.unpaid_payments} · ${eur(c.unpaid_cents)}`, 'tab=payments&status=unpaid', (c.unpaid_payments ?? 0) > 0)}
      {tile(t('Omzet deze maand', 'Revenue this month'), c.revenue_month_cents === undefined ? undefined : eur(c.revenue_month_cents), 'tab=payments')}
      {tile(t('Nieuwe berichten', 'New messages'), (c.new_contacts ?? 0) + (c.new_emails ?? 0), 'tab=contacts&status=new', ((c.new_contacts ?? 0) + (c.new_emails ?? 0)) > 0)}
    </div>
    <div className="adm-grid2">
      <Card title={t('Nieuw binnen', 'Just in')}>
        {d.recent.length ? <ul className="adm-list">{d.recent.map((r) => <li key={`${r.kind}${r.id}`}><a href={`${ctx.base}?tab=${r.kind === 'user' ? 'users' : r.kind === 'request' ? 'requests' : 'contacts'}&id=${r.id}${r.kind === 'contact' ? '&kind=form' : ''}`}><span className="adm-muted">{r.kind === 'user' ? t('Account', 'Account') : r.kind === 'request' ? t('Aanvraag', 'Request') : t('Contact', 'Contact')}</span> {r.label}</a><time>{fmtDate(ctx.lang, r.created_at)}</time></li>)}</ul> : <p className="adm-empty">–</p>}
      </Card>
      <Card title={t('Laatste admin-acties', 'Latest admin actions')} actions={<a className="adm-link" href={`${ctx.base}?tab=audit`}>{t('Alles', 'All')} ›</a>}>
        {d.activity.length ? <ul className="adm-list">{d.activity.map((a, i) => <li key={i}><span><code>{a.action}</code> <span className="adm-muted">{a.target_type}</span></span><time>{a.actor_email ?? 'system'} · {fmtDate(ctx.lang, a.created_at)}</time></li>)}</ul> : <p className="adm-empty">–</p>}
      </Card>
    </div>
  </>;
}
