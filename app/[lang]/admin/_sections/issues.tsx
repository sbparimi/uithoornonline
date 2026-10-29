import type { SessionUser } from '../../../../lib/auth/session';
import * as I from '../../../../lib/admin/issues';
import { businessOptions } from '../../../../lib/admin/businesses';
import { Act, Back, Card, csvHref, Empty, Field, fmtDate, Form, MigrationNotice, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';

export default async function Issues({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=issues`;
  const statusOpts: [string, string][] = [['open', t('Open', 'Open')], ['in_progress', t('Bezig', 'In progress')], ['closed', t('Gesloten', 'Closed')]];
  const prioOpts: [string, string][] = [['low', t('Laag', 'Low')], ['normal', t('Normaal', 'Normal')], ['high', t('Hoog', 'High')], ['urgent', t('Urgent', 'Urgent')]];
  const form = async (issue?: I.Issue) => {
    const businesses = await businessOptions(user);
    return <Form ctx={ctx} action={issue ? 'issue.update' : 'issue.create'} id={issue?.id}>
      <div className="adm-fields">
        <Field label={t('Titel', 'Title')} wide><input name="title" required minLength={2} maxLength={200} defaultValue={issue?.title ?? ''} /></Field>
        <Field label={t('Omschrijving', 'Description')} wide><textarea name="body" rows={4} maxLength={10000} defaultValue={issue?.body ?? ''} /></Field>
        <Field label="Status"><Select name="status" value={issue?.status ?? 'open'} label="status" options={statusOpts} /></Field>
        <Field label={t('Prioriteit', 'Priority')}><Select name="priority" value={issue?.priority ?? 'normal'} label="priority" options={prioOpts} /></Field>
        <Field label={t('Bedrijf (optioneel)', 'Business (optional)')}><select name="business_id" defaultValue={issue?.business_id ?? ''}><option value="">–</option>{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        {!issue ? <Field label={t('Bron', 'Source')}><Select name="source" value="admin" label="source" options={[['admin', 'Admin'], ['report', t('Melding', 'Report')]]} /></Field> : null}
        <Field label={t('Notities', 'Notes')} wide><textarea name="notes" rows={5} maxLength={20000} defaultValue={issue?.notes ?? ''} /></Field>
      </div>
      <button type="submit" className="adm-btn adm-primary">{issue ? t('Opslaan', 'Save') : t('Issue aanmaken', 'Create issue')}</button>
    </Form>;
  };
  if (ctx.sp.id === 'new') return <><Back href={list} label="Issues" /><Card title={t('Nieuw issue', 'New issue')}>{await form()}</Card></>;
  if (ctx.sp.id) {
    const issue = await I.getIssue(user, ctx.sp.id);
    if (!issue) return <><Back href={list} label="Issues" /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    return <>
      <Back href={list} label="Issues" />
      <div className="adm-title"><h2>{issue.title}</h2><Pill tone={issue.status}>{issue.status}</Pill><Pill tone={issue.priority}>{issue.priority}</Pill><Pill tone="plan">{issue.source}</Pill></div>
      <div className="adm-quick">{statusOpts.filter(([s]) => s !== issue.status).map(([s, l]) => <Act key={s} ctx={ctx} action="issue.status" id={issue.id} extra={{ status: s }} label={`→ ${l}`} />)}
        {issue.contact_message_id ? <a className="adm-btn adm-ghost" href={`${ctx.base}?tab=contacts&kind=form&id=${issue.contact_message_id}`}>{t('Origineel bericht', 'Original message')}</a> : null}
        {issue.inbound_email_id ? <a className="adm-btn adm-ghost" href={`${ctx.base}?tab=contacts&kind=email&id=${issue.inbound_email_id}`}>{t('Originele e-mail', 'Original email')}</a> : null}</div>
      <Card>{await form(issue)}</Card>
      <p className="adm-meta">{t('Aangemaakt', 'Created')} {fmtDate(ctx.lang, issue.created_at)} · {t('bijgewerkt', 'updated')} {fmtDate(ctx.lang, issue.updated_at)}{issue.closed_at ? ` · ${t('gesloten', 'closed')} ${fmtDate(ctx.lang, issue.closed_at)}` : ''}</p>
      <details className="adm-danger-zone"><summary>{t('Verwijderen…', 'Delete…')}</summary><Act ctx={ctx} action="issue.delete" id={issue.id} label={t('Issue verwijderen', 'Delete issue')} tone="danger" /></details>
    </>;
  }
  const data = await I.listIssues(user, ctx.sp);
  if (!data) return <MigrationNotice lang={ctx.lang} />;
  return <>
    <Toolbar ctx={ctx} tab="issues" csv={csvHref(ctx, 'issues')} createHref={`${ctx.base}?tab=issues&id=new`} createLabel="Issue">
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle statussen', 'All statuses')} options={statusOpts} />
      <Select name="priority" value={ctx.sp.priority} label={t('Prioriteit', 'Priority')} allLabel={t('Alle prioriteiten', 'All priorities')} options={prioOpts} />
    </Toolbar>
    {data.rows.length ? data.rows.map((i) => <article className={`admin-row adm-row ${i.status === 'closed' ? 'is-hidden' : ''}`} key={i.id}>
      <div className="admin-row-main"><div className="adm-row-top"><Pill tone={i.status}>{i.status}</Pill><Pill tone={i.priority}>{i.priority}</Pill><Pill tone="plan">{i.source}</Pill></div>
        <h3><a href={`${ctx.base}?tab=issues&id=${i.id}`}>{i.title}</a></h3>{i.body ? <p>{i.body.slice(0, 200)}</p> : null}<p className="adm-muted">{i.business_name ? `${i.business_name} · ` : ''}{fmtDate(ctx.lang, i.created_at)}</p></div>
      <div className="admin-row-actions">{i.status !== 'closed' ? <Act ctx={ctx} action="issue.status" id={i.id} extra={{ status: 'closed' }} label={t('Sluiten', 'Close')} /> : null}<a className="adm-btn" href={`${ctx.base}?tab=issues&id=${i.id}`}>{t('Bewerken', 'Edit')}</a></div>
    </article>) : <Empty>{t('Geen issues.', 'No issues.')}</Empty>}
    <Pager ctx={ctx} tab="issues" page={data.page} pages={data.pages} total={data.total} />
  </>;
}
