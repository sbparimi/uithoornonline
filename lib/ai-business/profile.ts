import 'server-only';
import { query, queryOne } from '../db';
import type { SessionUser } from '../auth/session';
import { cleanHours, type OpeningHours } from '../hours';
import type { Faq, Service } from './profile-draft';

// Profile extras added by migration 0006 (AI profile builder): English text, opening hours, services,
// FAQs, chat on/off, report email on/off. Every reader tolerates the migration not being applied yet
// (Postgres 42703 undefined column / 42P01 undefined table) and then behaves as "no extras".

export type PublicExtras = { description_en: string | null; opening_hours: OpeningHours | null; services: Service[]; faqs: Faq[]; chat_enabled: boolean };
export type OwnExtras = PublicExtras & { kvk_number: string | null; report_email: boolean; ai_profile: Record<string, unknown> | null; photos: { id: string; url: string; alt: string }[] };

export const notMigrated = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '');

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
export function cleanServices(raw: unknown): Service[] {
  return (Array.isArray(raw) ? raw : []).map((x) => ({ nl: str((x as Service)?.nl, 80), en: str((x as Service)?.en, 80) })).filter((x) => x.nl || x.en).slice(0, 12);
}
export function cleanFaqs(raw: unknown): Faq[] {
  return (Array.isArray(raw) ? raw : []).map((x) => { const f = x as Faq; return { q_nl: str(f?.q_nl, 200), a_nl: str(f?.a_nl, 800), q_en: str(f?.q_en, 200), a_en: str(f?.a_en, 800) }; })
    .filter((f) => (f.q_nl && f.a_nl) || (f.q_en && f.a_en)).slice(0, 8);
}

type Row = { description_en: string | null; opening_hours: unknown; services: unknown; faqs: unknown; chat_enabled: boolean };
const toPublic = (r: Row): PublicExtras => ({ description_en: r.description_en, opening_hours: cleanHours(r.opening_hours), services: cleanServices(r.services), faqs: cleanFaqs(r.faqs), chat_enabled: r.chat_enabled !== false });

export async function getPublicExtras(businessId: string): Promise<PublicExtras | null> {
  try {
    const r = await queryOne<Row>('select description_en, opening_hours, services, faqs, chat_enabled from businesses where id = $1', [businessId]);
    return r ? toPublic(r) : null;
  } catch (e) { if (notMigrated(e)) return null; throw e; }
}

export async function getOwnExtras(user: SessionUser): Promise<OwnExtras | null> {
  try {
    const r = await queryOne<Row & { id: string; kvk_number: string | null; report_email: boolean; ai_profile: Record<string, unknown> | null }>(
      'select id, description_en, opening_hours, services, faqs, chat_enabled, kvk_number, report_email, ai_profile from businesses where owner_id = $1 order by created_at limit 1', [user.id]);
    if (!r) return null;
    const photos = await query<{ id: string; url: string; alt: string }>('select id, url, alt from business_photos where business_id = $1 order by sort, created_at limit 12', [r.id]).catch(() => []);
    return { ...toPublic(r), kvk_number: r.kvk_number, report_email: r.report_email !== false, ai_profile: r.ai_profile, photos };
  } catch (e) { if (notMigrated(e)) return null; throw e; }
}

export type ExtrasInput = {
  description_en?: string | null; opening_hours?: unknown; services?: unknown; faqs?: unknown; kvk_number?: string | null;
  chat_enabled?: boolean; report_email?: boolean; ai_profile?: Record<string, unknown> | null;
};

export function cleanExtras(raw: Record<string, unknown>): { value: ExtrasInput; error: string | null } {
  const v: ExtrasInput = {};
  if (raw.description_en !== undefined) v.description_en = String(raw.description_en ?? '').trim().slice(0, 3000) || null;
  if (raw.opening_hours !== undefined) v.opening_hours = cleanHours(raw.opening_hours);
  if (raw.services !== undefined) v.services = cleanServices(raw.services);
  if (raw.faqs !== undefined) v.faqs = cleanFaqs(raw.faqs);
  if (raw.kvk_number !== undefined) {
    const k = String(raw.kvk_number ?? '').replace(/\s/g, '');
    if (k && !/^\d{8}$/.test(k)) return { value: v, error: 'invalid_kvk' };
    v.kvk_number = k || null;
  }
  if (typeof raw.chat_enabled === 'boolean') v.chat_enabled = raw.chat_enabled;
  if (typeof raw.report_email === 'boolean') v.report_email = raw.report_email;
  if (raw.ai_profile && typeof raw.ai_profile === 'object' && !Array.isArray(raw.ai_profile)) {
    const a = raw.ai_profile as Record<string, unknown>;
    // Internal provenance only; the owner saved it, so it is marked reviewed.
    v.ai_profile = { provider: str(a.provider, 80) || null, fields: Array.isArray(a.fields) ? a.fields.map((f) => str(f, 30)).slice(0, 20) : [], source: str(a.source, 300) || null, generated_at: str(a.generated_at, 40) || null, reviewed_by_owner: true, saved_at: new Date().toISOString() };
  }
  return { value: v, error: null };
}

const JSON_COLS = new Set(['opening_hours', 'services', 'faqs', 'ai_profile']);
export async function saveOwnExtras(user: SessionUser, input: ExtrasInput): Promise<boolean> {
  const sets: string[] = []; const params: unknown[] = [];
  for (const [k, val] of Object.entries(input)) {
    if (val === undefined) continue;
    params.push(JSON_COLS.has(k) ? (val === null ? null : JSON.stringify(val)) : val);
    sets.push(`${k} = $${params.length}${JSON_COLS.has(k) ? '::jsonb' : ''}`);
  }
  if (!sets.length) return true;
  params.push(user.id);
  const r = await queryOne<{ id: string }>(`update businesses set ${sets.join(', ')}, updated_at = now() where id = (select id from businesses where owner_id = $${params.length} order by created_at limit 1) returning id`, params);
  return !!r;
}

/** Adds photos from the business's own website (owner ticked the consent box). Max 8 photos total. */
export async function addOwnPhotos(user: SessionUser, photos: { url: string; alt: string }[]): Promise<number> {
  const biz = await queryOne<{ id: string; website: string | null }>('select id, website from businesses where owner_id = $1 order by created_at limit 1', [user.id]);
  if (!biz?.website) return 0;
  const host = (() => { try { return new URL(biz.website!).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  const existing = await query<{ url: string }>('select url from business_photos where business_id = $1', [biz.id]);
  let room = Math.max(0, 8 - existing.length); let added = 0;
  for (const p of photos) {
    if (room <= 0) break;
    let u: URL; try { u = new URL(p.url); } catch { continue; }
    if (u.protocol !== 'https:' || u.hostname.replace(/^www\./, '') !== host || existing.some((e) => e.url === u.toString())) continue;
    await query('insert into business_photos(business_id, url, alt, sort) values ($1, $2, $3, $4)', [biz.id, u.toString().slice(0, 500), str(p.alt, 200), 100 + added]);
    added++; room--;
  }
  return added;
}

export async function removeOwnPhoto(user: SessionUser, photoId: string) {
  await query('delete from business_photos where id = $1 and business_id = (select id from businesses where owner_id = $2 order by created_at limit 1)', [photoId, user.id]);
}
