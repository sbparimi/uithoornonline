import 'server-only';
import { query, queryOne, transaction, DbUnavailableError } from '../db';
import type { SessionUser } from '../auth/session';
import { normalizePhone, normalizeWebsite } from '../phone';

export type PublicBusiness = { id: string; name: string; category: string; description: string; postcode: string | null; website: string | null; phone: string | null; verified: boolean; featured: boolean };

// The two real businesses that were already listed on the site. Shown only when the database is
// unreachable, so the directory never renders empty during an outage. (Also seeded into the DB.)
export const FALLBACK_BUSINESSES: PublicBusiness[] = [
  { id: '15953249-c000-4521-839d-41bf341b6aa8', name: 'SpiceIndia', category: 'Indian food & catering', description: 'South Indian home kitchen in Uithoorn offering freshly prepared takeaway and catering. Specialities include Andhra-style biryani, dosa, idli and vada. Pickup only; no delivery. Catering available in Uithoorn and Amstelveen.', postcode: '1421', website: 'https://www.spiceindia.nl/', phone: '+31 6 45480446', verified: true, featured: false },
  { id: '68efa8f0-6e5f-4ea9-ba5b-94fbff1fba35', name: 'Ruslen', category: 'Garden renovation, paving, tiling & fencing', description: 'Local contractor for garden renovation and outdoor works, including paving, tiles and fencing. Contact Ruslen for project details, scope and quotation.', postcode: '1421', website: null, phone: '+31616270233', verified: true, featured: false },
];

const PUBLIC_COLUMNS = 'id, name, category, description, postcode, website, phone, verified, featured';
const PUBLIC_WHERE = "moderation_status = 'approved' and active = true";

/** Approved, active businesses. Falls back to the built-in list only when the DB is unreachable. */
export async function listPublicBusinesses(): Promise<{ businesses: PublicBusiness[]; source: 'database' | 'fallback' }> {
  try {
    const rows = await query<PublicBusiness>(`select ${PUBLIC_COLUMNS} from businesses where ${PUBLIC_WHERE} order by featured desc, name`);
    return { businesses: rows, source: 'database' };
  } catch (error) {
    if (error instanceof DbUnavailableError) return { businesses: FALLBACK_BUSINESSES, source: 'fallback' };
    throw error;
  }
}

export async function listPublicBusinessesMatching(terms: string[]) {
  const { businesses, source } = await listPublicBusinesses();
  const filtered = businesses.filter((b) => terms.some((t) => `${b.category} ${b.description}`.toLowerCase().includes(t)));
  return { businesses: filtered, source };
}

export type PublicReview = { id: string; rating: number; body: string; created_at: string; author: string };

export async function getPublicBusiness(id: string): Promise<{ business: PublicBusiness; reviews: PublicReview[]; rating: { average: number | null; count: number } } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  try {
    const business = await queryOne<PublicBusiness>(`select ${PUBLIC_COLUMNS} from businesses where id = $1 and ${PUBLIC_WHERE}`, [id]);
    if (!business) return null;
    // Only the first name of the reviewer is public; never their email or phone.
    const reviews = await query<PublicReview>(
      `select r.id, r.rating, r.body, r.created_at, coalesce(nullif(split_part(u.full_name, ' ', 1), ''), 'Inwoner') as author
         from reviews r join users u on u.id = r.customer_id
        where r.business_id = $1 and r.hidden = false order by r.created_at desc limit 50`, [id]);
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : null;
    return { business, reviews, rating: { average, count } };
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      const business = FALLBACK_BUSINESSES.find((b) => b.id === id);
      return business ? { business, reviews: [], rating: { average: null, count: 0 } } : null;
    }
    throw error;
  }
}

export type OwnBusiness = PublicBusiness & { address: string | null; moderation_status: 'pending' | 'approved' | 'rejected'; active: boolean; created_at: string };

export async function getOwnBusiness(user: SessionUser): Promise<OwnBusiness | null> {
  return queryOne<OwnBusiness>(`select ${PUBLIC_COLUMNS}, address, moderation_status, active, created_at from businesses where owner_id = $1 order by created_at limit 1`, [user.id]);
}

export type BusinessInput = { name?: string; category?: string; description?: string; postcode?: string | null; address?: string | null; website?: string | null; phone?: string | null };

export function cleanBusinessInput(raw: Record<string, unknown>): { value: BusinessInput; error: string | null } {
  const s = (k: string, max: number) => (raw[k] === undefined ? undefined : String(raw[k] ?? '').trim().slice(0, max));
  const value: BusinessInput = {
    name: s('name', 120), category: s('category', 120), description: s('description', 3000),
    postcode: s('postcode', 10)?.toUpperCase().replace(/^(\d{4})\s*([A-Z]{2})$/, '$1 $2') || (raw.postcode === undefined ? undefined : null),
    address: s('address', 200) || (raw.address === undefined ? undefined : null),
    website: normalizeWebsite(s('website', 300)) || (raw.website === undefined ? undefined : null),
    phone: normalizePhone(s('phone', 40)).slice(0, 40) || (raw.phone === undefined ? undefined : null),
  };
  if (value.name !== undefined && value.name.length < 2) return { value, error: 'invalid_name' };
  if (value.website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(value.website)) return { value, error: 'invalid_website' };
  if (value.postcode && !/^\d{4}\s?[A-Z]{2}$|^\d{4}$/.test(value.postcode)) return { value, error: 'invalid_postcode' };
  return { value, error: null };
}

// Owner-editable columns only. verified / featured / moderation_status / active / owner_id are
// deliberately absent: only lib/data/admin.ts writes those (this closes the old Supabase hole
// where an owner could set their own business to verified or promote it).
const OWNER_EDITABLE = ['name', 'category', 'description', 'postcode', 'address', 'website', 'phone'] as const;

export async function updateOwnBusiness(user: SessionUser, input: BusinessInput) {
  const sets: string[] = []; const params: unknown[] = [];
  for (const key of OWNER_EDITABLE) {
    if (input[key] !== undefined) { params.push(input[key]); sets.push(`${key} = $${params.length}`); }
  }
  if (!sets.length) return getOwnBusiness(user);
  params.push(user.id);
  const row = await queryOne<{ id: string }>(`update businesses set ${sets.join(', ')} where id = (select id from businesses where owner_id = $${params.length} order by created_at limit 1) returning id`, params);
  if (!row) return null;
  return getOwnBusiness(user);
}

export async function createBusinessForOwner(ownerId: string, input: Required<Pick<BusinessInput, 'name' | 'category'>> & BusinessInput) {
  return transaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `insert into businesses(owner_id, name, category, description, postcode, address, website, phone, moderation_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'pending') returning id`,
      [ownerId, input.name, input.category, input.description ?? '', input.postcode ?? null, input.address ?? null, input.website ?? null, input.phone ?? null]);
    return rows[0].id;
  });
}

/** Photos an admin added to a business (table business_photos, migration 0002). Empty when none or not migrated. */
export async function getPublicBusinessPhotos(id: string): Promise<{ url: string; alt: string }[]> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return [];
  try {
    return await query<{ url: string; alt: string }>('select url, alt from business_photos where business_id = $1 order by sort, created_at limit 12', [id]);
  } catch {
    return [];
  }
}
