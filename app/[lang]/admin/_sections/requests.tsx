import type { SessionUser } from '../../../../lib/auth/session';
import * as Q from '../../../../lib/admin/requests';
import { businessOptions } from '../../../../lib/admin/businesses';
import { Act, Back, Card, csvHref, DangerZone, Empty, Field, fmtDate, Form, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';

export default async function Requests({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=requests`;
  const statusOptions = Q.REQUEST_STATUSES.map((s) => [s, s] as [string, string]);
  if (ctx.sp.id) {
    const data = await Q.getRequest(user, ctx.sp.id);
    if (!data) return <><Back href={list} label={t('Aanvragen', 'Requests')} /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    const { request: r, leads } = data;
    const options = await businessOptions(user);
    const assigned = new Set(leads.map((l) => l.business_id));
    return <>
      <Back href={list} label={t('Aanvragen', 'Requests')} />
      <div className="adm-title"><h2>{r.category} · {r.postcode}</h2><Pill tone={r.status}>{r.status}</Pill>{r.hidden ? <Pill tone="grey">{t('verborgen', 'hidden')}</Pill> : null}</div>
      <div className="adm-grid2">
        <Card title={t('Aanvraag', 'Request')}>
          <Form ctx={ctx} action="request.update" id={r.id}>
            <div className="adm-fields">
              <Field label={t('Categorie', 'Category')}><input name="category" required maxLength={120} defaultValue={r.category} /></Field>
              <Field label="Postcode"><input name="postcode" required maxLength={10} defaultValue={r.postcode} /></Field>
              <Field label={t('Omschrijving', 'Description')} wide><textarea name="description" rows={4} minLength={10} maxLength={3000} defaultValue={r.description} /></Field>
              <Field label="Status"><Select name="status" value={r.status} label="status" options={statusOptions} /></Field>
              <Field label={t('Reden verbergen', 'Hide reason')}><input name="hidden_reason" maxLength={300} defaultValue={r.hidden_reason ?? ''} /></Field>
            </div>
            <div className="adm-checks"><label><input type="checkbox" name="hidden" defaultChecked={r.hidden} /> {t('Verborgen (bedrijven zien hem niet)', 'Hidden (businesses don’t see it)')}</label></div>
            <button type="submit" className="adm-btn adm-primary">{t('Opslaan', 'Save')}</button>
          </Form>
        </Card>
        <Card title={t('Bewoner', 'Resident')}>
          <dl className="adm-dl"><dt>{t('Naam', 'Name')}</dt><dd>{r.customer_name || '–'}</dd><dt>E-mail</dt><dd>{r.customer_email ? <a href={`${ctx.base}?tab=users&id=${r.customer_id}`}>{r.customer_email}</a> : '–'}</dd><dt>{t('Telefoon', 'Phone')}</dt><dd>{r.customer_phone || '–'}</dd>
            <dt>{t('Wanneer', 'When')}</dt><dd>{r.preferred_timing}</dd><dt>{t('Urgentie', 'Urgency')}</dt><dd>{r.urgency}</dd><dt>Budget</dt><dd>{r.budget_min || r.budget_max ? `€${r.budget_min ?? '?'} – €${r.budget_max ?? '?'}` : '–'}</dd><dt>{t('Geplaatst', 'Posted')}</dt><dd>{fmtDate(ctx.lang, r.created_at)}</dd></dl>
        </Card>
      </div>
      <Card title={`${t('Leads', 'Leads')} (${leads.length})`}>
        {leads.length ? leads.map((l) => <article className="adm-row adm-subrow" key={l.id}>
          <div><h3><a href={`${ctx.base}?tab=businesses&id=${l.business_id}`}>{l.business_name}</a></h3><p className="adm-muted">{fmtDate(ctx.lang, l.created_at)}{l.counts_toward_limit ? '' : ` · ${t('telt niet mee voor limiet', 'not counted toward limit')}`}{l.conversation_id ? ` · ${t('gesprek gestart', 'conversation started')}` : ''}</p></div>
          <div className="admin-row-actions">
            <Form ctx={ctx} action="lead.status" id={r.id} extra={{ lead_id: l.id }} className="admin-inline-form adm-inline"><Select name="status" value={l.status} label="status" options={Q.LEAD_STATUSES.map((s) => [s, s] as [string, string])} /><button className="adm-btn" type="submit">{t('Opslaan', 'Save')}</button></Form>
            <Act ctx={ctx} action="lead.delete" id={r.id} extra={{ lead_id: l.id }} label={t('Weghalen', 'Remove')} tone="danger" />
          </div>
        </article>) : <Empty>{t('Nog niet gedeeld met bedrijven.', 'Not shared with any business yet.')}</Empty>}
        <Form ctx={ctx} action="lead.assign" id={r.id} className="adm-form adm-row-form">
          <Field label={t('Doorsturen naar bedrijf', 'Send to business')}><select name="business_id" required defaultValue=""><option value="" disabled>{t('Kies…', 'Choose…')}</option>{options.filter((o) => !assigned.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          <label className="adm-check-inline"><input type="checkbox" name="notify" value="true" defaultChecked /> {t('Mail het bedrijf', 'Email the business')}</label>
          <button className="adm-btn adm-primary" type="submit">{t('Doorsturen', 'Send')}</button>
        </Form>
      </Card>
      <DangerZone ctx={ctx} action="request.delete" id={r.id} label={t('Aanvraag verwijderen', 'Delete request')} confirmLabel={t('Typ DELETE (leads en gesprekken van deze aanvraag worden ook verwijderd)', 'Type DELETE (this request’s leads and conversations are deleted too)')} confirmValue="DELETE" />
    </>;
  }
  const data = await Q.listRequests(user, ctx.sp);
  return <>
    <Toolbar ctx={ctx} tab="requests" csv={csvHref(ctx, 'requests')}>
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle statussen', 'All statuses')} options={statusOptions} />
      <Select name="hidden" value={ctx.sp.hidden} label={t('Zichtbaarheid', 'Visibility')} allLabel={t('Zichtbaar + verborgen', 'Visible + hidden')} options={[['visible', t('Zichtbaar', 'Visible')], ['hidden', t('Verborgen', 'Hidden')]]} />
    </Toolbar>
    {data.rows.length ? data.rows.map((r) => <article className={`admin-row adm-row ${r.hidden ? 'is-hidden' : ''}`} key={r.id}>
      <div className="admin-row-main"><div className="adm-row-top"><Pill tone={r.status}>{r.status}</Pill>{r.hidden ? <Pill tone="grey">{t('verborgen', 'hidden')}</Pill> : null}</div>
        <h3><a href={`${ctx.base}?tab=requests&id=${r.id}`}>{r.category} · {r.postcode}</a></h3><p>{r.description}</p><p className="adm-muted">{r.customer_email ?? '–'} · leads {r.leads} · {fmtDate(ctx.lang, r.created_at)}</p></div>
      <div className="admin-row-actions">{r.hidden ? <Act ctx={ctx} action="request.unhide" id={r.id} label={t('Tonen', 'Unhide')} /> : <Act ctx={ctx} action="request.hide" id={r.id} label={t('Verbergen', 'Hide')} tone="danger" />}<a className="adm-btn" href={`${ctx.base}?tab=requests&id=${r.id}`}>{t('Beheren', 'Manage')}</a></div>
    </article>) : <Empty>{t('Geen aanvragen gevonden.', 'No requests found.')}</Empty>}
    <Pager ctx={ctx} tab="requests" page={data.page} pages={data.pages} total={data.total} />
    <p className="adm-hint"><a href={csvHref(ctx, 'leads')}>{t('Alle leads als CSV', 'All leads as CSV')}</a></p>
  </>;
}
