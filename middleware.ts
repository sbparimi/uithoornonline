import { NextResponse, type NextRequest } from 'next/server';

const LOCALE_COOKIE = 'uithoorn-locale';

// Paths that are not localized pages.
const PASSTHROUGH = /^\/(api|auth|_next|_vercel)(\/|$)|^\/(robots\.txt|sitemap\.xml|favicon\.ico|icon\.svg|apple-icon\.png|manifest\.webmanifest|og-image(-en)?\.png)$/;

// Sessions are httpOnly cookies validated server-side (lib/auth/session.ts); nothing to refresh here.
function refreshSession(_request: NextRequest, makeResponse: () => NextResponse) {
  return makeResponse();
}

const CANONICAL_HOST = 'uithoorn.online';

/** Search engines must only index the real domain: previews and *.vercel.app copies get noindex. */
function withHostRobots(request: NextRequest, response: NextResponse) {
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (host && host !== CANONICAL_HOST && host !== 'localhost' && host !== '127.0.0.1') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export async function middleware(request: NextRequest) {
  return withHostRobots(request, await route(request));
}

async function route(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  // One host: www.uithoorn.online -> uithoorn.online (same path and query).
  const host = (request.headers.get('host') || '').toLowerCase();
  if (host === `www.${CANONICAL_HOST}`) {
    const url = request.nextUrl.clone();
    url.host = CANONICAL_HOST; url.port = ''; url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

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
