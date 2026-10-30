import { NextResponse, type NextRequest } from 'next/server';
import { parseDirectoryParams, runDirectoryQuery } from '../../../lib/directory/data';

// Public directory search (instant results, typeahead and "load more"). Read-only; returns only
// what the public listing pages already show.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const lang = sp.lang === 'en' ? 'en' : 'nl';
  const parsed = parseDirectoryParams(sp);
  const limit = Math.min(48, Math.max(1, Number.parseInt(sp.limit || '24', 10) || 24));
  const offset = Math.min(10_000, Math.max(0, Number.parseInt(sp.offset || '0', 10) || 0));
  try {
    const payload = await runDirectoryQuery({ ...parsed, offset, limit }, lang);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
  } catch (error) {
    console.error('[directory] search failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'search_failed' }, { status: 500 });
  }
}
