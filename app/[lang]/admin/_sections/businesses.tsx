import type { SessionUser } from '../../../../lib/auth/session';
import * as B from '../../../../lib/admin/businesses';
import { Act, Back, Card, csvHref, DangerZone, Empty, eur, Field, fmtDate, Form, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';
import { PRICING_ENABLED } from '../../../../lib/pricing';

const PLAN_LABEL: Record<string, string> = { free: 'Gratis', pro: 'Pro', pro_plus: 'Pro+' };

function BusinessForm({ ctx, b, create }: { ctx: Ctx; b?: Partial<B.BusinessDetail>; create?: boolean }) {
  const t = tr(ctx.lang);
  return <Form ctx={ctx} action={create ? 'business.create' : 'business.update'} id={create ? undefined : b?.id}>
    <div className="adm-fields">
      <Field label={t('Naam', 'Name')}><input name="name" required minLength={2} maxLength={120} defaultValue={b?.name ?? ''} /></Field>
      <Field label={t('Categorie', 'Category')}><input name="category" required maxLength={120} defaultValue={b?.category ?? ''} /></Field>
      <Field label={t('Beschrijving', 'Description')} wide><textarea name="description" rows={4} maxLength={3000} defaultValue={b?.description ?? ''} /></Field>
      <Field label={t('Telefoon', 'Phone')}><input name="phone" maxLength={40} defaultValue={b?.phone ?? ''} /></Field>
      <Field label="Website"><input name="website" maxLength={300} defaultValue={b?.website ?? ''} placeholder="https://" /></Field>
      <Field label={t('Adres', 'Address')}><input name="address" maxLength={200} defaultValue={b?.address ?? ''} /></Field>
      <Field label="Postcode"><input name="postcode" maxLength={10} defaultValue={b?.postcode ?? ''} /></Field>
      <Field label={t('Eigenaar (e-mail)', 'Owner (email)')} hint={t('Moet een bestaand account zijn. Leeg = geen eigenaar.', 'Must be an existing account. Empty = no owner.')}><input name="owner_email" type="email" defaultValue={b?.owner_email ?? ''} /></Field>
      <Field label="Status"><Select name="moderation_status" value={b?.moderation_status ?? 'approved'} label="Status" options={[['approved', t('Goedgekeurd', 'Approved')], ['pending', t('Wacht', 'Pending')], ['rejected', t('Afgewezen', 'Rejected')]]} /></Field>
      <Field label={t('Notitie bij status', 'Status note')} wide><input name="moderation_note" maxLength={500} defaultValue={b?.moderation_note ?? ''} /></Field>
    </div>
    <div className="adm-checks">
      <label><input type="checkbox" name="active" defaultChecked={create ? true : b?.active} /> {t('Zichtbaar', 'Visible')}</label>
      <label><input type="checkbox" name="verified" defaultChecked={b?.verified} /> {t('Geverifieerd', 'Verified')}</label>
      <label><input type="checkbox" name="featured" defaultChecked={b?.featured} /> {t('Uitgelicht', 'Featured')}</label>
      {!create ? <label><input type="checkbox" name="notify_owner" defaultChecked /> {t('Mail eigenaar bij statuswijziging', 'Email owner when status changes')}</label> : null}
    </div>
    <button type="submit" className="adm-btn adm-primary">{create ? t('Bedrijf aanmaken', 'Create business') : t('Opslaan', 'Save')}</button>
  </Form>;
}

export default async function Businesses({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=businesses`;
  if (ctx.sp.id === 'new') return <><Back href={list} label={t('Bedrijven', 'Businesses')} /><Card title={t('Nieuw bedrijf', 'New business')}><BusinessForm ctx={ctx} create /></Card></>;
  if (ctx.sp.id) {
    const data = await B.getBusiness(user, ctx.sp.id);
    if (!data) return <><Back href={list} label={t('Bedrijven', 'Businesses')} /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    const { business: b, photos, leads, payments } = data;
    return <>
      <Back href={list} label={t('Bedrijven', 'Businesses')} />
      <div className="adm-title"><h2>{b.name}</h2><Pill tone={b.moderation_status}>{b.moderation_status}</Pill>{b.featured ? <Pill tone="blue">{t('uitgelicht', 'featured')}</Pill> : null}{!b.active ? <Pill tone="grey">{t('verborgen', 'hidden')}</Pill> : null}</div>
      <div className="adm-quick">
        {b.moderation_status !== 'approved' && <Act ctx={ctx} action="business.approve" id={b.id} label={t('Goedkeuren', 'Approve')} tone="primary" />}
        {b.moderation_status !== 'rejected' && <Act ctx={ctx} action="business.reject" id={b.id} label={t('Afwijzen', 'Reject')} tone="danger" />}
        <Act ctx={ctx} action="business.flags" id={b.id} label={b.featured ? t('Niet meer uitlichten', 'Unfeature') : t('Uitlichten', 'Feature')} extra={{ featured: String(!b.featured) }} />
        <Act ctx={ctx} action="business.flags" id={b.id} label={b.active ? t('Verbergen', 'Hide') : t('Zichtbaar maken', 'Unhide')} extra={{ active: String(!b.active) }} />
        {b.moderation_status === 'approved' && b.active ? <a className="adm-btn adm-ghost" href={`/${ctx.lang === 'en' ? 'en/' : ''}businesses/${b.id}`} target="_blank" rel="noopener noreferrer">{t('Bekijk pagina', 'View page')} ↗</a> : null}
      </div>
      <div className="adm-grid2">
        <Card title={PRICING_ENABLED ? t('Pakket & leads', 'Plan & leads') : t('Pakket & leads (nu niet in gebruik)', 'Plan & leads (currently unused)')}>
          {!PRICING_ENABLED && <p className="adm-hint">{t('Prijzen staan uit: alles is gratis en leads zijn onbeperkt. Deze gegevens worden bewaard voor als prijzen terugkomen.', 'Pricing is switched off: everything is free and leads are unlimited. This data is kept for when pricing returns.')}</p>}
          <dl className="adm-dl"><dt>{t('Pakket', 'Plan')}</dt><dd>{PLAN_LABEL[b.plan_key] ?? b.plan_key}{b.current_period_end ? ` · ${t('tot', 'until')} ${fmtDate(ctx.lang, b.current_period_end, false)}` : ''}</dd>
            <dt>{t('Leads deze maand', 'Leads this month')}</dt><dd>{b.leads_month}</dd><dt>{t('Extra lead-credits', 'Extra lead credits')}</dt><dd>{b.credits}</dd></dl>
          <Form ctx={ctx} action="business.plan" id={b.id} className="adm-form adm-row-form">
            <Field label={t('Pakket', 'Plan')}><Select name="plan" value={b.plan_key} label="plan" options={[['free', 'Gratis'], ['pro', 'Pro €29'], ['pro_plus', 'Pro+ €59']]} /></Field>
            <Field label={t('Maanden', 'Months')}><input name="months" type="number" min={1} max={24} defaultValue={1} /></Field>
            <Field label={t('Notitie', 'Note')}><input name="note" maxLength={200} placeholder={t('bv. betaald via Tikkie', 'e.g. paid via Tikkie')} /></Field>
            <button className="adm-btn" type="submit">{t('Pakket opslaan', 'Save plan')}</button>
          </Form>
          <Form ctx={ctx} action="business.credits" id={b.id} className="adm-form adm-row-form">
            <Field label={t('Lead-credits (totaal)', 'Lead credits (total)')}><input name="credits" type="number" min={0} max={10000} defaultValue={b.credits} /></Field>
            <button className="adm-btn" type="submit">{t('Credits opslaan', 'Save credits')}</button>
          </Form>
          <p className="adm-hint">{t('Tip: registreer betalingen bij Betalingen; dat werkt pakket en credits automatisch bij.', 'Tip: record payments under Payments; that updates plan and credits automatically.')} <a href={`${ctx.base}?tab=payments&id=new&business_id=${b.id}`}>{t('Betaling vastleggen', 'Record payment')} ›</a></p>
        </Card>
        <Card title={t('Foto’s', 'Photos')}>
          {photos.length ? <div className="adm-photos">{photos.map((p) => <figure key={p.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url} alt={p.alt} loading="lazy" /><figcaption>{p.alt || '–'}</figcaption><Act ctx={ctx} action="business.photo_delete" id={b.id} extra={{ photo_id: p.id }} label={t('Verwijder', 'Remove')} tone="danger" /></figure>)}</div> : <Empty>{t('Nog geen foto’s.', 'No photos yet.')}</Empty>}
          <Form ctx={ctx} action="business.photo_add" id={b.id} className="adm-form adm-row-form">
            <Field label={t('Foto-URL', 'Photo URL')} hint={t('https-link of /img/… uit de site', 'https link or /img/… from the site')}><input name="url" required maxLength={500} placeholder="https://…" /></Field>
            <Field label={t('Omschrijving', 'Alt text')}><input name="alt" maxLength={200} /></Field>
            <button className="adm-btn" type="submit">{t('Toevoegen', 'Add')}</button>
          </Form>
        </Card>
      </div>
      <Card title={t('Gegevens', 'Details')}><BusinessForm ctx={ctx} b={b} /></Card>
      <div className="adm-grid2">
        <Card title={t('Laatste leads', 'Latest leads')}>{leads.length ? <ul className="adm-list">{leads.map((l) => <li key={l.id}><a href={`${ctx.base}?tab=requests&id=${l.request_id}`}>{l.category}</a><span><Pill tone={l.status}>{l.status}</Pill> <time>{fmtDate(ctx.lang, l.created_at, false)}</time></span></li>)}</ul> : <Empty>–</Empty>}</Card>
        <Card title={t('Betalingen', 'Payments')}>{payments.length ? <ul className="adm-list">{payments.map((p) => <li key={p.id}><a href={`${ctx.base}?tab=payments&id=${p.id}`}>{eur(p.amount_cents)} · {p.kind}</a><span><Pill tone={p.status}>{p.status}</Pill> <time>{fmtDate(ctx.lang, p.paid_on ?? p.created_at, false)}</time></span></li>)}</ul> : <Empty>–</Empty>}</Card>
      </div>
      <p className="adm-meta">{t('Aangemaakt', 'Created')} {fmtDate(ctx.lang, b.created_at)} · {t('bijgewerkt', 'updated')} {fmtDate(ctx.lang, b.updated_at)} · id {b.id}</p>
      <DangerZone ctx={ctx} action="business.delete" id={b.id} label={t('Bedrijf definitief verwijderen', 'Delete business permanently')} confirmLabel={t('Typ DELETE om te bevestigen (leads en gesprekken van dit bedrijf worden ook verwijderd)', 'Type DELETE to confirm (this business’s leads and conversations are deleted too)')} confirmValue="DELETE" />
    </>;
  }

  const data = await B.listBusinesses(user, ctx.sp);
  return <>
    <Toolbar ctx={ctx} tab="businesses" csv={csvHref(ctx, 'businesses')} createHref={`${ctx.base}?tab=businesses&id=new`} createLabel={t('Bedrijf', 'Business')}>
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle statussen', 'All statuses')} options={[['pending', t('Wacht', 'Pending')], ['approved', t('Goedgekeurd', 'Approved')], ['rejected', t('Afgewezen', 'Rejected')]]} />
      <Select name="plan" value={ctx.sp.plan} label={t('Pakket', 'Plan')} allLabel={t('Alle pakketten', 'All plans')} options={[['free', 'Gratis'], ['pro', 'Pro'], ['pro_plus', 'Pro+']]} />
      <Select name="flag" value={ctx.sp.flag} label="Flag" allLabel={t('Alles', 'Everything')} options={[['featured', t('Uitgelicht', 'Featured')], ['hidden', t('Verborgen', 'Hidden')], ['verified', t('Geverifieerd', 'Verified')], ['unverified', t('Niet geverifieerd', 'Unverified')]]} />
    </Toolbar>
    {data.rows.length ? data.rows.map((b) => <article className={`admin-row adm-row ${b.active ? '' : 'is-hidden'}`} key={b.id}>
      <div className="admin-row-main">
        <div className="adm-row-top"><Pill tone={b.moderation_status}>{b.moderation_status}</Pill><Pill tone="plan">{PLAN_LABEL[b.plan_key] ?? b.plan_key}</Pill>{b.featured ? <Pill tone="blue">★</Pill> : null}{b.verified ? <Pill tone="approved">✓</Pill> : null}</div>
        <h3><a href={`${ctx.base}?tab=businesses&id=${b.id}`}>{b.name}</a></h3>
        <p>{b.category} · {b.postcode || '–'} · {b.owner_email || t('geen eigenaar', 'no owner')}</p>
        <p className="adm-muted">leads {b.leads_month} · credits {b.credits} · {fmtDate(ctx.lang, b.created_at, false)}</p>
      </div>
      <div className="admin-row-actions">
        {b.moderation_status !== 'approved' && <Act ctx={ctx} action="business.approve" id={b.id} label={t('Goedkeuren', 'Approve')} tone="primary" />}
        {b.moderation_status !== 'rejected' && <Act ctx={ctx} action="business.reject" id={b.id} label={t('Afwijzen', 'Reject')} tone="danger" />}
        <Act ctx={ctx} action="business.flags" id={b.id} label={`${t('Geverifieerd', 'Verified')}: ${b.verified ? '✓' : '✗'}`} extra={{ verified: String(!b.verified) }} />
        <a className="adm-btn" href={`${ctx.base}?tab=businesses&id=${b.id}`}>{t('Bewerken', 'Edit')}</a>
      </div>
    </article>) : <Empty>{t('Geen bedrijven gevonden.', 'No businesses found.')}</Empty>}
    <Pager ctx={ctx} tab="businesses" page={data.page} pages={data.pages} total={data.total} />
  </>;
}
