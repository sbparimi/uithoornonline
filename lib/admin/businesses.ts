import 'server-only';
import { query, queryOne, transaction } from '../db';
import type { SessionUser } from '../auth/session';
import { addCredits, unlockLockedLeads } from '../data/credits';
import { normalizePhone } from '../phone';
import { assertAdmin, audit, isId, like, needsSchema, optional, paged, paging } from './core';

const MONTH_START = "(date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam')";
export const PLANS = ['free', 'pro', 'pro_plus'] as const;
export type PlanKey = (typeof PLANS)[number];

export type BusinessRow = {
  id: string; name: string; category: string; postcode: string | null; phone: string | null; moderation_status: string;
  verified: boolean; featured: boolean; active: boolean; created_at: string; owner_email: string | null; plan_key: PlanKey;
  leads_month: number; credits: number;
};

const LIST_SQL = (withCredits: boolean) => `
  select b.id, b.name, b.category, b.postcode, b.phone, b.moderation_status, b.verified, b.featured, b.active, b.created_at,
         u.email as owner_email, coalesce(s.plan_key, 'free') as plan_key,
         (select count(*)::int from leads l where l.business_id = b.id and l.created_at >= ${MONTH_START}) as leads_month,
         ${withCredits ? 'coalesce((select credits from business_lead_credits c where c.business_id = b.id), 0)' : '0'} as credits,
         count(*) over() as _total
    from businesses b
    left join users u on u.id = b.owner_id
    left join business_subscriptions s on s.business_id = b.id
   where ($1 = '' or b.name ilike $2 or b.category ilike $2 or coalesce(u.email::text, '') ilike $2 or coalesce(b.postcode, '') ilike $2 or coalesce(b.phone, '') ilike $2)
     and ($3 = '' or b.moderation_status::text = $3)
     and ($4 = '' or coalesce(s.plan_key, 'free') = $4)
     and ($5 = '' or ($5 = 'featured' and b.featured) or ($5 = 'hidden' and not b.active) or ($5 = 'verified' and b.verified) or ($5 = 'unverified' and not b.verified))
   order by case b.moderation_status when 'pending' then 0 else 1 end, b.created_at desc`;

export type BusinessFilter = { q?: string; status?: string; plan?: string; flag?: string; page?: string };

export async function listBusinesses(user: SessionUser, f: BusinessFilter, all = false) {
  assertAdmin(user);
  const p = paging(f.page, all ? 100000 : 25);
  const q = (f.q ?? '').trim().slice(0, 100);
  const params = [q, like(q), f.status ?? '', f.plan ?? '', f.flag ?? ''];
  const sql = (c: boolean) => `${LIST_SQL(c)} limit ${p.size} offset ${p.offset}`;
  const rows = await optional(() => query<BusinessRow & { _total: number }>(sql(true), params), null) ?? await query<BusinessRow & { _total: number }>(sql(false), params);
  return paged<BusinessRow>(rows, p);
}

export type BusinessDetail = BusinessRow & {
  description: string; address: string | null; website: string | null; moderation_note: string | null; owner_id: string | null;
  owner_name: string | null; plan_note: string | null; current_period_end: string | null; updated_at: string;
};

export async function getBusiness(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return null;
  const business = await queryOne<BusinessDetail>(
    `select b.*, u.email as owner_email, u.full_name as owner_name, coalesce(s.plan_key, 'free') as plan_key, s.note as plan_note, s.current_period_end,
            (select count(*)::int from leads l where l.business_id = b.id and l.created_at >= ${MONTH_START}) as leads_month, 0 as credits
       from businesses b left join users u on u.id = b.owner_id left join business_subscriptions s on s.business_id = b.id where b.id = $1`, [id]);
  if (!business) return null;
  business.credits = await optional(async () => (await queryOne<{ credits: number }>('select credits from business_lead_credits where business_id = $1', [id]))?.credits ?? 0, 0);
  const photos = await optional(() => query<{ id: string; url: string; alt: string; sort: number }>('select id, url, alt, sort from business_photos where business_id = $1 order by sort, created_at', [id]), []);
  const leads = await query<{ id: string; status: string; created_at: string; category: string; request_id: string; counts_toward_limit: boolean }>(
    `select l.id, l.status, l.created_at, r.category, r.id as request_id, l.counts_toward_limit from leads l join service_requests r on r.id = l.request_id where l.business_id = $1 order by l.created_at desc limit 20`, [id]);
  const payments = await optional(() => query<{ id: string; amount_cents: number; kind: string; status: string; paid_on: string | null; created_at: string }>(
    'select id, amount_cents, kind, status, paid_on, created_at from payments where business_id = $1 order by created_at desc limit 20', [id]), []);
  return { business, photos, leads, payments };
}

export type BusinessInput = {
  name: string; category: string; description: string; postcode: string | null; address: string | null; website: string | null; phone: string | null;
  moderation_status: 'pending' | 'approved' | 'rejected'; moderation_note: string | null; verified: boolean; featured: boolean; active: boolean; owner_email: string | null;
};

export function cleanBusiness(body: Record<string, unknown>): { value: BusinessInput; error: string | null } {
  const s = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);
  const b = (k: string) => body[k] === true || body[k] === 'true' || body[k] === 'on' || body[k] === '1';
  const website = s('website', 300);
  const status = s('moderation_status', 20);
  const value: BusinessInput = {
    name: s('name', 120), category: s('category', 120), description: s('description', 3000), postcode: s('postcode', 10).toUpperCase() || null,
    address: s('address', 200) || null, website: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null, phone: normalizePhone(s('phone', 40)).slice(0, 40) || null,
    moderation_status: (['pending', 'approved', 'rejected'].includes(status) ? status : 'approved') as BusinessInput['moderation_status'],
    moderation_note: s('moderation_note', 500) || null, verified: b('verified'), featured: b('featured'), active: b('active'), owner_email: s('owner_email', 254).toLowerCase() || null,
  };
  if (value.name.length < 2) return { value, error: 'invalid_name' };
  if (!value.category) return { value, error: 'invalid_category' };
  if (value.website && !/^https?:\/\/[^\s"'<>]+$/i.test(value.website)) return { value, error: 'invalid_website' };
  return { value, error: null };
}

async function ownerIdFor(email: string | null) {
  if (!email) return { id: null as string | null };
  const u = await queryOne<{ id: string }>('select id from users where email = $1', [email]);
  return u ? { id: u.id } : null;
}

export async function createBusiness(user: SessionUser, v: BusinessInput) {
  assertAdmin(user);
  const owner = await ownerIdFor(v.owner_email);
  if (!owner) return { error: 'owner_not_found' as const };
  const row = await queryOne<{ id: string }>(
    `insert into businesses(owner_id, name, category, description, postcode, address, website, phone, moderation_status, moderation_note, verified, featured, active)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [owner.id, v.name, v.category, v.description, v.postcode, v.address, v.website, v.phone, v.moderation_status, v.moderation_note, v.verified, v.featured, v.active]);
  if (owner.id) await query("update users set role = 'provider' where id = $1 and role = 'customer'", [owner.id]);
  await query(`insert into business_subscriptions(business_id, plan_key, status, payment_provider) values ($1, 'free', 'active', 'manual') on conflict do nothing`, [row!.id]);
  await audit(user, 'business_create', 'business', row!.id, null, v);
  return { id: row!.id };
}

const EDITABLE = ['name', 'category', 'description', 'postcode', 'address', 'website', 'phone', 'moderation_status', 'moderation_note', 'verified', 'featured', 'active'] as const;

export async function updateBusiness(user: SessionUser, id: string, v: BusinessInput) {
  assertAdmin(user);
  if (!isId(id)) return { error: 'not_found' as const };
  const before = await queryOne<Record<string, unknown>>('select b.*, u.email as owner_email from businesses b left join users u on u.id = b.owner_id where b.id = $1', [id]);
  if (!before) return { error: 'not_found' as const };
  const owner = await ownerIdFor(v.owner_email);
  if (!owner) return { error: 'owner_not_found' as const };
  const params: unknown[] = [id, owner.id, ...EDITABLE.map((k) => v[k])];
  const after = await queryOne<Record<string, unknown>>(
    `update businesses set owner_id = $2, ${EDITABLE.map((k, i) => `${k} = $${i + 3}`).join(', ')}, updated_at = now() where id = $1 returning *`, params);
  if (owner.id && owner.id !== before.owner_id) await query("update users set role = 'provider' where id = $1 and role = 'customer'", [owner.id]);
  await audit(user, 'business_update', 'business', id, before, { ...after, owner_email: v.owner_email });
  return { ok: true, before, after, statusChanged: before.moderation_status !== v.moderation_status };
}

export async function setFlags(user: SessionUser, id: string, flags: Partial<Record<'verified' | 'featured' | 'active', boolean>>) {
  assertAdmin(user);
  if (!isId(id)) return false;
  const before = await queryOne<Record<string, unknown>>('select verified, featured, active from businesses where id = $1', [id]);
  if (!before) return false;
  const keys = (['verified', 'featured', 'active'] as const).filter((k) => typeof flags[k] === 'boolean');
  if (!keys.length) return false;
  const after = await queryOne(`update businesses set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() where id = $1 returning verified, featured, active`, [id, ...keys.map((k) => flags[k])]);
  await audit(user, 'business_flags', 'business', id, before, after);
  return true;
}

export async function moderate(user: SessionUser, id: string, decision: 'approved' | 'rejected' | 'pending', note: string | null) {
  assertAdmin(user);
  if (!isId(id) || !['approved', 'rejected', 'pending'].includes(decision)) return null;
  const before = await queryOne<{ moderation_status: string; moderation_note: string | null }>('select moderation_status, moderation_note from businesses where id = $1', [id]);
  if (!before) return null;
  const row = await queryOne<{ id: string; name: string; owner_email: string | null; owner_locale: 'nl' | 'en' | null }>(
    `update businesses b set moderation_status = $2, moderation_note = coalesce($3, b.moderation_note), updated_at = now() where b.id = $1
     returning b.id, b.name, (select email from users where id = b.owner_id) as owner_email, (select locale from users where id = b.owner_id) as owner_locale`, [id, decision, note]);
  await audit(user, `business_${decision}`, 'business', id, before, { moderation_status: decision, moderation_note: note ?? before.moderation_note });
  return row;
}

/** Sets the plan (and optionally how many months), then unlocks this month's locked leads that now fit. */
export async function setPlan(user: SessionUser, id: string, plan: PlanKey, note: string | null, months = 1) {
  assertAdmin(user);
  if (!isId(id) || !PLANS.includes(plan)) return null;
  return transaction(async (client) => {
    const { rows: [before] } = await client.query('select plan_key, status, current_period_end, note from business_subscriptions where business_id = $1', [id]);
    const { rowCount } = await client.query('select 1 from businesses where id = $1', [id]);
    if (!rowCount) return null;
    await client.query(
      `insert into business_subscriptions(business_id, plan_key, status, payment_provider, note, current_period_end)
       values ($1, $2, 'active', 'manual', $3, case when $2 = 'free' then null else now() + make_interval(months => $4) end)
       on conflict (business_id) do update set plan_key = excluded.plan_key, status = 'active', payment_provider = 'manual', note = coalesce(excluded.note, business_subscriptions.note),
         current_period_end = excluded.current_period_end, updated_at = now()`, [id, plan, note, months]);
    const unlocked = await unlockLockedLeads(client, id);
    await audit(user, 'business_plan', 'business', id, before ?? { plan_key: 'free' }, { plan_key: plan, note, months, unlocked }, {}, client);
    return { unlocked };
  });
}

/** Sets the extra lead credit balance to an absolute number and unlocks locked leads it now covers. */
export async function setCredits(user: SessionUser, id: string, credits: number) {
  assertAdmin(user);
  if (!isId(id) || !Number.isInteger(credits) || credits < 0 || credits > 10000) return null;
  return needsSchema(() => transaction(async (client) => {
    const { rowCount } = await client.query('select 1 from businesses where id = $1', [id]);
    if (!rowCount) return null;
    const { rows: [b] } = await client.query<{ credits: number }>('select credits from business_lead_credits where business_id = $1', [id]);
    const before = b?.credits ?? 0;
    await addCredits(client, id, credits - before);
    const unlocked = await unlockLockedLeads(client, id);
    const { rows: [a] } = await client.query<{ credits: number }>('select credits from business_lead_credits where business_id = $1', [id]);
    await audit(user, 'business_credits', 'business', id, { credits: before }, { credits: a?.credits ?? 0, unlocked }, {}, client);
    return { unlocked, credits: a?.credits ?? 0 };
  }));
}

export async function deleteBusiness(user: SessionUser, id: string) {
  assertAdmin(user);
  if (!isId(id)) return false;
  const before = await queryOne<Record<string, unknown>>('select * from businesses where id = $1', [id]);
  if (!before) return false;
  await query('delete from businesses where id = $1', [id]);
  await audit(user, 'business_delete', 'business', id, before, null);
  return true;
}

export async function addPhoto(user: SessionUser, id: string, url: string, alt: string) {
  assertAdmin(user);
  const clean = url.trim().slice(0, 500);
  if (!isId(id) || !(/^https:\/\/[^\s"'<>]+$/i.test(clean) || /^\/[A-Za-z0-9/_\-.]+$/.test(clean))) return { error: 'invalid_photo_url' as const };
  const row = await needsSchema(() => queryOne<{ id: string }>(
    `insert into business_photos(business_id, url, alt, sort) values ($1, $2, $3, coalesce((select max(sort) + 1 from business_photos where business_id = $1), 0)) returning id`, [id, clean, alt.trim().slice(0, 200)]));
  await audit(user, 'business_photo_add', 'business', id, null, { url: clean, alt });
  return { id: row!.id };
}

export async function deletePhoto(user: SessionUser, photoId: string) {
  assertAdmin(user);
  if (!isId(photoId)) return false;
  const row = await needsSchema(() => queryOne<{ business_id: string; url: string }>('delete from business_photos where id = $1 returning business_id, url', [photoId]));
  if (row) await audit(user, 'business_photo_delete', 'business', row.business_id, row, null);
  return Boolean(row);
}

export async function businessOptions(user: SessionUser) {
  assertAdmin(user);
  return query<{ id: string; name: string }>('select id, name from businesses order by name limit 1000');
}
