import type { SessionUser } from '../../../../lib/auth/session';
import * as C from '../../../../lib/admin/contacts';
import { Act, Back, Card, csvHref, Empty, Field, fmtDate, Form, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';

export default async function Contacts({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=contacts`;
  if (ctx.sp.id) {
    const kind = ctx.sp.kind === 'email' ? 'email' : 'form';
    const data = await C.getContact(user, kind, ctx.sp.id);
    if (!data) return <><Back href={list} label={t('Contact', 'Contacts')} /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    const c = data.contact;
    const extra = { kind };
    return <>
      <Back href={list} label={t('Contact', 'Contacts')} />
      <div className="adm-title"><h2>{c.subject || t('(geen onderwerp)', '(no subject)')}</h2><Pill tone={c.status}>{c.status}</Pill><Pill tone="plan">{kind === 'email' ? t('e-mail', 'email') : t('formulier', 'form')}</Pill></div>
      <div className="adm-quick">
        {c.status !== 'handled' ? <Act ctx={ctx} action="contact.status" id={c.id} extra={{ ...extra, status: 'handled' }} label={t('Markeer afgehandeld', 'Mark handled')} tone="primary" /> : <Act ctx={ctx} action="contact.status" id={c.id} extra={{ ...extra, status: 'new' }} label={t('Terug naar nieuw', 'Back to new')} />}
        {c.status !== 'spam' ? <Act ctx={ctx} action="contact.status" id={c.id} extra={{ ...extra, status: 'spam' }} label="Spam" /> : null}
        <Act ctx={ctx} action="contact.to_issue" id={c.id} extra={extra} label={t('Maak issue', 'Create issue')} />
      </div>
      <Card title={`${c.name}${c.name !== c.email ? ` <${c.email}>` : ''}`} actions={<time className="adm-muted">{fmtDate(ctx.lang, c.created_at)}</time>}>
        <div className="adm-message">{c.body || '–'}</div>
      </Card>
      {data.replies.length ? <Card title={t('Verstuurde antwoorden', 'Replies sent')}>{data.replies.map((r) => <div className="adm-reply" key={r.id}><p className="adm-muted">{fmtDate(ctx.lang, r.created_at)} · {r.subject} · <Pill tone={r.email_status}>{r.email_status}</Pill></p><div className="adm-message">{r.body}</div></div>)}</Card> : null}
      <Card title={t('Antwoorden', 'Reply')}>
        <Form ctx={ctx} action="contact.reply" id={c.id} extra={extra}>
          <div className="adm-fields">
            <Field label={t('Onderwerp', 'Subject')} wide><input name="subject" maxLength={300} defaultValue={`Re: ${c.subject || 'Uithoorn.online'}`} /></Field>
            <Field label={t('Bericht', 'Message')} wide><textarea name="body" rows={6} required maxLength={10000} /></Field>
            <Field label={t('Taal van de e-mail', 'Email language')}><Select name="lang" value={ctx.lang} label="lang" options={[['nl', 'Nederlands'], ['en', 'English']]} /></Field>
          </div>
          <p className="adm-hint">{t(`Gaat naar ${c.email}, met een kopie naar de admin. Antwoorden op jouw mail gaan naar sam@uithoorn.online en worden doorgestuurd naar de admin-inbox.`, `Goes to ${c.email}, with a copy to the admin. Replies to your email go to sam@uithoorn.online and are forwarded to the admin inbox.`)}</p>
          <button type="submit" className="adm-btn adm-primary">{t('Verstuur antwoord', 'Send reply')}</button>
        </Form>
      </Card>
      <details className="adm-danger-zone"><summary>{t('Verwijderen…', 'Delete…')}</summary><Act ctx={ctx} action="contact.delete" id={c.id} extra={extra} label={t('Bericht verwijderen', 'Delete message')} tone="danger" /></details>
    </>;
  }
  const [data, submissions] = await Promise.all([C.listContacts(user, ctx.sp), C.listSubmissions(user)]);
  return <>
    <Toolbar ctx={ctx} tab="contacts" csv={csvHref(ctx, 'contacts')}>
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle', 'All')} options={[['new', t('Nieuw', 'New')], ['handled', t('Afgehandeld', 'Handled')], ['spam', 'Spam']]} />
      <Select name="source" value={ctx.sp.source} label={t('Bron', 'Source')} allLabel={t('Formulier + e-mail', 'Form + email')} options={[['form', t('Contactformulier', 'Contact form')], ['email', t('Inkomende e-mail', 'Inbound email')]]} />
    </Toolbar>
    {data.rows.length ? data.rows.map((c) => <article className={`admin-row adm-row ${c.status !== 'new' ? 'is-hidden' : ''}`} key={`${c.kind}${c.id}`}>
      <div className="admin-row-main"><div className="adm-row-top"><Pill tone={c.status}>{c.status}</Pill><Pill tone="plan">{c.kind === 'email' ? t('e-mail', 'email') : t('formulier', 'form')}</Pill>{c.replies ? <Pill tone="approved">{c.replies} ↩</Pill> : null}</div>
        <h3><a href={`${ctx.base}?tab=contacts&kind=${c.kind}&id=${c.id}`}>{c.subject || t('(geen onderwerp)', '(no subject)')}</a></h3><p>{c.body.slice(0, 220)}{c.body.length > 220 ? '…' : ''}</p><p className="adm-muted">{c.name}{c.name !== c.email ? ` · ${c.email}` : ''} · {fmtDate(ctx.lang, c.created_at)}</p></div>
      <div className="admin-row-actions">{c.status === 'new' ? <Act ctx={ctx} action="contact.status" id={c.id} extra={{ kind: c.kind, status: 'handled' }} label={t('Afgehandeld', 'Handled')} /> : null}<a className="adm-btn" href={`${ctx.base}?tab=contacts&kind=${c.kind}&id=${c.id}`}>{t('Lezen & antwoorden', 'Read & reply')}</a></div>
    </article>) : <Empty>{t('Geen berichten.', 'No messages.')}</Empty>}
    <Pager ctx={ctx} tab="contacts" page={data.page} pages={data.pages} total={data.total} />
    <Card title={t('Inzendingen (tips, evenementen, bedrijven)', 'Submissions (tips, events, businesses)')}>
      {submissions.length ? submissions.map((s) => <article className="adm-row adm-subrow" key={s.id}><div><div className="adm-row-top"><Pill tone="plan">{s.kind}</Pill><Pill tone={s.status}>{s.status}</Pill></div><h3>{s.title}</h3><p>{s.description}</p><p className="adm-muted">{s.name} · {s.email} · {fmtDate(ctx.lang, s.created_at)}</p></div>
        <div className="admin-row-actions"><Form ctx={ctx} action="submission.status" id={s.id} className="admin-inline-form adm-inline"><Select name="status" value={s.status} label="status" options={[['pending', 'pending'], ['reviewed', 'reviewed'], ['published', 'published'], ['rejected', 'rejected']]} /><button className="adm-btn" type="submit">{t('Opslaan', 'Save')}</button></Form><Act ctx={ctx} action="submission.delete" id={s.id} label={t('Verwijder', 'Delete')} tone="danger" /></div></article>) : <Empty>–</Empty>}
    </Card>
  </>;
}
