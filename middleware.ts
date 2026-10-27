import { NextResponse, type NextRequest } from 'next/server';

const LOCALE_COOKIE = 'uithoorn-locale';

// Paths that are not localized pages.
const PASSTHROUGH = /^\/(api|auth|_next|_vercel)(\/|$)|^\/(robots\.txt|sitemap\.xml|favicon\.ico|icon\.svg|og-image(-en)?\.png)$/;

// Sessions are httpOnly cookies validated server-side (lib/auth/session.ts); nothing to refresh here.
function refreshSession(_request: NextRequest, makeResponse: () => NextResponse) {
  return makeResponse();
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
