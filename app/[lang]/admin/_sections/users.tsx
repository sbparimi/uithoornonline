import type { SessionUser } from '../../../../lib/auth/session';
import * as U from '../../../../lib/admin/users';
import { Act, Back, Card, csvHref, DangerZone, Empty, Field, fmtDate, Form, Pager, Pill, Select, Toolbar, tr, type Ctx } from '../_ui';

export default async function Users({ ctx, user }: { ctx: Ctx; user: SessionUser }) {
  const t = tr(ctx.lang);
  const list = `${ctx.base}?tab=users`;
  const roleLabel = (r: string) => (r === 'customer' ? t('bewoner', 'resident') : r === 'provider' ? t('bedrijf', 'business') : 'admin');
  const roleOptions: [string, string][] = [['customer', t('Bewoner', 'Resident')], ['provider', t('Bedrijf', 'Business')], ['admin', 'Admin']];

  if (ctx.sp.id === 'new') return <><Back href={list} label={t('Accounts', 'Accounts')} /><Card title={t('Nieuw account', 'New account')}>
    <Form ctx={ctx} action="user.create">
      <div className="adm-fields">
        <Field label="E-mail"><input name="email" type="email" required /></Field>
        <Field label={t('Naam', 'Name')}><input name="full_name" maxLength={120} /></Field>
        <Field label={t('Telefoon', 'Phone')}><input name="phone" maxLength={40} /></Field>
        <Field label={t('Rol', 'Role')}><Select name="role" value="customer" label="role" options={roleOptions} /></Field>
        <Field label={t('Taal', 'Language')}><Select name="locale" value="nl" label="locale" options={[['nl', 'Nederlands'], ['en', 'English']]} /></Field>
      </div>
      <div className="adm-checks"><label><input type="checkbox" name="send_reset" defaultChecked /> {t('Stuur een e-mail om een wachtwoord in te stellen', 'Email a link to set a password')}</label></div>
      <p className="adm-hint">{t('Het account krijgt geen wachtwoord; de persoon kiest er zelf een via de link.', 'The account gets no password; the person chooses one via the link.')}</p>
      <button type="submit" className="adm-btn adm-primary">{t('Account aanmaken', 'Create account')}</button>
    </Form></Card></>;

  if (ctx.sp.id) {
    const data = await U.getUser(user, ctx.sp.id);
    if (!data) return <><Back href={list} label={t('Accounts', 'Accounts')} /><Empty>{t('Niet gevonden.', 'Not found.')}</Empty></>;
    const u = data.user; const self = u.id === user.id;
    return <>
      <Back href={list} label={t('Accounts', 'Accounts')} />
      <div className="adm-title"><h2>{u.full_name || u.email}</h2><Pill tone={u.role}>{roleLabel(u.role)}</Pill>{u.disabled_at ? <Pill tone="rejected">{t('geblokkeerd', 'suspended')}</Pill> : null}{!u.has_password ? <Pill tone="grey">{t('geen wachtwoord', 'no password')}</Pill> : null}</div>
      <div className="adm-quick">
        <Act ctx={ctx} action="user.reset" id={u.id} label={t('Stuur wachtwoord-resetlink', 'Send password reset link')} />
        {!self && (u.disabled_at ? <Act ctx={ctx} action="user.unsuspend" id={u.id} label={t('Deblokkeren', 'Unsuspend')} tone="primary" /> : <Act ctx={ctx} action="user.suspend" id={u.id} label={t('Blokkeren', 'Suspend')} tone="danger" />)}
      </div>
      <div className="adm-grid2">
        <Card title={t('Gegevens', 'Details')}>
          <Form ctx={ctx} action="user.update" id={u.id}>
            <div className="adm-fields">
              <Field label="E-mail"><input name="email" type="email" required defaultValue={u.email} /></Field>
              <Field label={t('Naam', 'Name')}><input name="full_name" maxLength={120} defaultValue={u.full_name} /></Field>
              <Field label={t('Telefoon', 'Phone')}><input name="phone" maxLength={40} defaultValue={u.phone ?? ''} /></Field>
              <Field label={t('Rol', 'Role')}><Select name="role" value={u.role} label="role" options={roleOptions} /></Field>
              <Field label={t('Taal', 'Language')}><Select name="locale" value={u.locale} label="locale" options={[['nl', 'Nederlands'], ['en', 'English']]} /></Field>
            </div>
            <button type="submit" className="adm-btn adm-primary">{t('Opslaan', 'Save')}</button>
          </Form>
        </Card>
        <Card title={t('Activiteit', 'Activity')}>
          <dl className="adm-dl">
            <dt>{t('Aangemaakt', 'Created')}</dt><dd>{fmtDate(ctx.lang, u.created_at)}</dd>
            <dt>{t('Laatst ingelogd', 'Last sign-in')}</dt><dd>{fmtDate(ctx.lang, u.last_login_at)}</dd>
            <dt>{t('E-mail bevestigd', 'Email verified')}</dt><dd>{fmtDate(ctx.lang, u.email_verified_at)}</dd>
            <dt>{t('Voorwaarden geaccepteerd', 'Terms accepted')}</dt><dd>{fmtDate(ctx.lang, u.terms_accepted_at)}</dd>
            <dt>{t('Actieve sessies', 'Active sessions')}</dt><dd>{data.activeSessions}</dd>
          </dl>
          <h3 className="adm-sub">{t('Bedrijven', 'Businesses')}</h3>
          {data.businesses.length ? <ul className="adm-list">{data.businesses.map((b) => <li key={b.id}><a href={`${ctx.base}?tab=businesses&id=${b.id}`}>{b.name}</a><Pill tone={b.moderation_status}>{b.moderation_status}</Pill></li>)}</ul> : <Empty>–</Empty>}
          <h3 className="adm-sub">{t('Aanvragen', 'Requests')}</h3>
          {data.requests.length ? <ul className="adm-list">{data.requests.map((r) => <li key={r.id}><a href={`${ctx.base}?tab=requests&id=${r.id}`}>{r.category}</a><span><Pill tone={r.status}>{r.status}</Pill> <time>{fmtDate(ctx.lang, r.created_at, false)}</time></span></li>)}</ul> : <Empty>–</Empty>}
        </Card>
      </div>
      {!self ? <DangerZone ctx={ctx} action="user.delete" id={u.id} label={t('Account definitief verwijderen', 'Delete account permanently')} confirmLabel={t(`Typ het e-mailadres (${u.email}) om te bevestigen. Bedrijven, aanvragen en gesprekken van dit account worden ook verwijderd.`, `Type the email (${u.email}) to confirm. This account’s businesses, requests and conversations are deleted too.`)} confirmValue={u.email} /> : null}
    </>;
  }

  const data = await U.listUsers(user, ctx.sp);
  return <>
    <Toolbar ctx={ctx} tab="users" csv={csvHref(ctx, 'users')} createHref={`${ctx.base}?tab=users&id=new`} createLabel={t('Account', 'Account')}>
      <Select name="role" value={ctx.sp.role} label={t('Rol', 'Role')} allLabel={t('Alle rollen', 'All roles')} options={roleOptions} />
      <Select name="status" value={ctx.sp.status} label="Status" allLabel={t('Alle', 'All')} options={[['active', t('Actief', 'Active')], ['suspended', t('Geblokkeerd', 'Suspended')], ['nopassword', t('Geen wachtwoord', 'No password')]]} />
    </Toolbar>
    {data.rows.length ? data.rows.map((u) => <article className={`admin-row adm-row ${u.disabled_at ? 'is-hidden' : ''}`} key={u.id}>
      <div className="admin-row-main">
        <div className="adm-row-top"><Pill tone={u.role}>{roleLabel(u.role)}</Pill>{u.disabled_at ? <Pill tone="rejected">{t('geblokkeerd', 'suspended')}</Pill> : null}{!u.has_password ? <Pill tone="grey">{t('geen wachtwoord', 'no password')}</Pill> : null}</div>
        <h3><a href={`${ctx.base}?tab=users&id=${u.id}`}>{u.full_name || u.email}</a></h3>
        <p>{u.email} · {u.phone || '–'}</p>
        <p className="adm-muted">{t('sinds', 'since')} {fmtDate(ctx.lang, u.created_at, false)} · login {fmtDate(ctx.lang, u.last_login_at)} · {u.businesses} {t('bedr.', 'biz')} · {u.requests} {t('aanvr.', 'req')}</p>
      </div>
      <div className="admin-row-actions">
        <Form ctx={ctx} action="user.role" id={u.id} className="admin-inline-form adm-inline"><Select name="role" value={u.role} label={t('Rol', 'Role')} options={roleOptions} /><button className="admin-btn adm-btn" type="submit">{t('Opslaan', 'Save')}</button></Form>
        {u.id !== user.id && (u.disabled_at ? <Act ctx={ctx} action="user.unsuspend" id={u.id} label={t('Deblokkeren', 'Unsuspend')} /> : <Act ctx={ctx} action="user.suspend" id={u.id} label={t('Blokkeren', 'Suspend')} tone="danger" />)}
        <a className="adm-btn" href={`${ctx.base}?tab=users&id=${u.id}`}>{t('Bekijken', 'View')}</a>
      </div>
    </article>) : <Empty>{t('Geen accounts gevonden.', 'No accounts found.')}</Empty>}
    <Pager ctx={ctx} tab="users" page={data.page} pages={data.pages} total={data.total} />
  </>;
}
