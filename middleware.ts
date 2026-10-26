import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_SUPABASE_URL = 'https://gzthuldvqufrvxeybvyo.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ueUr_kwat_KK1jQoixQ4ug_QC8ZXqzh';
const LOCALE_COOKIE = 'uithoorn-locale';

// Paths that are not localized pages.
const PASSTHROUGH = /^\/(api|auth|_next|_vercel)(\/|$)|^\/(robots\.txt|sitemap\.xml|favicon\.ico|icon\.svg|og-image(-en)?\.png)$/;

function hasSupabaseSession(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-'));
}

async function refreshSession(request: NextRequest, makeResponse: () => NextResponse) {
  let response = makeResponse();
  // Only talk to Supabase when an auth cookie exists; anonymous visitors (and crawlers) skip the round trip.
  if (!hasSupabaseSession(request)) return response;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  } catch {
    // A session refresh failure must never take the page down.
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PASSTHROUGH.test(pathname)) {
    return refreshSession(request, () => NextResponse.next({ request }));
  }

  // /nl/... is never a public URL: Dutch lives at the root.
  if (pathname === '/nl' || pathname.startsWith('/nl/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }

  // English pages are served as-is.
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    return refreshSession(request, () => NextResponse.next({ request }));
  }

  // A visitor who explicitly chose English keeps English. Crawlers carry no cookie and always get Dutch.
  if (request.cookies.get(LOCALE_COOKIE)?.value === 'en') {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? '/en' : `/en${pathname}`;
    url.search = search;
    return NextResponse.redirect(url, 307);
  }

  // Everything else is Dutch, served from the internal /nl tree.
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === '/' ? '/nl' : `/nl${pathname}`;
  return refreshSession(request, () => NextResponse.rewrite(rewriteUrl, { request }));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)'],
};
