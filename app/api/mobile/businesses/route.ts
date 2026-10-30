import { handle, json, str } from '@/lib/http';
import { listPublicBusinesses } from '@/lib/data/businesses';
import { categoryLabel } from '@/lib/categories';

export const dynamic = 'force-dynamic';

// Public directory for the mobile app: approved, active businesses (same rows as /businesses).
// ?q= free text (name, category, description), ?category= exact category value.
export async function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const q = str(params.get('q'), 80).toLowerCase();
    const category = str(params.get('category'), 120);
    const { businesses, source } = await listPublicBusinesses();
    const filtered = businesses.filter((b) =>
      (!category || b.category === category) &&
      (!q || `${b.name} ${b.category} ${categoryLabel(b.category, 'nl')} ${categoryLabel(b.category, 'en')} ${b.description}`.toLowerCase().includes(q)));
    return json({ businesses: filtered, total: filtered.length, source }, 200, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });
  }, 'mobile/businesses');
}
