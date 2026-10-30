import { query } from '@/lib/db';
import { verifyToken } from '@/lib/urgent/tokens';

export const dynamic = 'force-dynamic';

// Intake photos, shown on the accept page and in admin. Access by a signed per-request photo token.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = verifyToken('photo', url.searchParams.get('t'));
  const n = Math.max(0, Math.min(2, Number(url.searchParams.get('n') || 0) || 0));
  if (!ids) return new Response('not found', { status: 404 });
  const rows = await query<{ mime: string; data: Buffer }>('select mime, data from request_photos where request_id = $1 order by created_at, id offset $2 limit 1', [ids[0], n]);
  if (!rows[0]) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(rows[0].data), { headers: { 'content-type': rows[0].mime, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' } });
}
