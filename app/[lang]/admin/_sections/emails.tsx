import type { SessionUser } from '../../../../lib/auth/session';
import { listEmails } from '../../../../lib/admin/misc';
import { emailConfigured, fromAddress, adminEmail } from '../../../../lib/email/send';
import { csvHref, Empty, fmtDate, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';

export default async function Emails({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const data = await listEmails(user, ctx.sp);
  return <>
    <p className="adm-hint">{emailConfigured() ? t(`E-mail staat aan. Afzender: ${fromAddress()}. Elke e-mail gaat ook (BCC) naar ${adminEmail()}.`, `Email is on. Sender: ${fromAddress()}. Every email also goes (BCC) to ${adminEmail()}.`) : t('E-mail staat uit (RESEND_API_KEY ontbreekt): pogingen worden hier als “skipped” gelogd.', 'Email is off (RESEND_API_KEY missing): attempts are logged here as “skipped”.')}</p>
    <Toolbar ctx={ctx} tab="emails" csv={csvHref(ctx, 'emails')}>
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle', 'All')} options={[['sent', 'sent'], ['failed', 'failed'], ['skipped', 'skipped']]} />
      <Select name="kind" value={ctx.sp.kind} label={t('Soort', 'Type')} allLabel={t('Alle soorten', 'All types')} options={[['welcome', 'welcome'], ['password_', 'password'], ['new_lead', 'new_lead'], ['request_', 'request'], ['new_message', 'new_message'], ['business_', 'business'], ['payment_receipt', 'payment_receipt'], ['contact_auto_reply', 'contact_auto_reply'], ['admin_reply', 'admin_reply'], ['notify:', t('admin-meldingen', 'admin alerts')], ['inbound_forward', 'inbound_forward']]} />
    </Toolbar>
    {data.rows.length ? <div className="adm-table-wrap"><table className="admin-table adm-table"><thead><tr><th>{t('Datum', 'Date')}</th><th>{t('Aan', 'To')}</th><th>{t('Soort', 'Type')}</th><th>{t('Onderwerp', 'Subject')}</th><th>Status</th><th>Resend id</th></tr></thead>
      <tbody>{data.rows.map((e) => <tr key={e.id}><td>{fmtDate(ctx.lang, e.created_at)}</td><td>{e.to_address}{e.bcc_address ? <small className="adm-muted"><br />bcc {e.bcc_address}</small> : null}</td><td>{e.kind}</td><td className="adm-wrap">{e.subject}</td><td title={e.error ?? ''}><Pill tone={e.status}>{e.status}</Pill>{e.error ? <small className="adm-muted"><br />{e.error.slice(0, 80)}</small> : null}</td><td><code>{e.provider_id ? e.provider_id.slice(0, 8) : '–'}</code></td></tr>)}</tbody></table></div> : <Empty>{t('Nog geen e-mails.', 'No emails yet.')}</Empty>}
    <Pager ctx={ctx} tab="emails" page={data.page} pages={data.pages} total={data.total} />
  </>;
}
