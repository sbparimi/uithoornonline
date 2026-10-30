import { errorJson, handle, json } from '@/lib/http';
import { getPublicBusiness, getPublicBusinessPhotos } from '@/lib/data/businesses';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const found = await getPublicBusiness(id);
    if (!found) return errorJson('not_found', 404);
    const photos = await getPublicBusinessPhotos(id);
    return json({ ...found, photos }, 200, { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' });
  }, 'mobile/business');
}
