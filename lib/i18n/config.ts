export const locales = ['nl', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'nl';
export const LOCALE_COOKIE = 'uithoorn-locale';
export const SITE_URL = 'https://uithoorn.online';
/** International digits for wa.me: accepts "+31 6…", "0031 6…" or a Dutch national "06…". */
export function normalizeWhatsapp(raw: string) {
  return raw.replace(/\D/g, '').replace(/^00/, '').replace(/^0(?=6)/, '31');
}
// OWNER: confirm the platform's number (this fallback is also a listed business's phone). Set NEXT_PUBLIC_WHATSAPP_NUMBER on Vercel.
export const WHATSAPP_NUMBER = normalizeWhatsapp(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '31616270233');

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'nl' || value === 'en';
}

/** Prefix an internal path with the locale. Dutch lives at the root, English under /en. */
export function lp(lang: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'nl') return clean;
  if (clean === '/') return '/en';
  if (clean.startsWith('/?') || clean.startsWith('/#')) return `/en${clean.slice(1)}`;
  return `/en${clean}`;
}

/** Remove a leading /en or /nl from a pathname. */
export function stripLocale(pathname: string): string {
  const stripped = pathname.replace(/^\/(en|nl)(?=\/|$)/, '');
  return stripped || '/';
}

/** Canonical + hreflang alternates for a locale-neutral path such as "/businesses". */
export function alternatesFor(lang: Locale, path: string) {
  const nlUrl = `${SITE_URL}${path === '/' ? '' : path}` || SITE_URL;
  const enUrl = `${SITE_URL}${lp('en', path)}`;
  return {
    canonical: lang === 'nl' ? nlUrl : enUrl,
    languages: { 'nl-NL': nlUrl, en: enUrl, 'x-default': nlUrl },
  };
}

/** Canonical, hreflang, Open Graph and Twitter tags for a page. */
export function seo(lang: Locale, path: string, title: string, description: string) {
  const alternates = alternatesFor(lang, path);
  const image = lang === 'nl' ? '/og-image.png' : '/og-image-en.png';
  const fullTitle = title.includes('Uithoorn.online') ? title : `${title} — Uithoorn.online`;
  return {
    alternates,
    openGraph: { type: 'website' as const, siteName: 'Uithoorn.online', locale: ogLocale(lang), alternateLocale: [ogLocale(lang === 'nl' ? 'en' : 'nl')], title: fullTitle, description, url: alternates.canonical, images: [{ url: image, width: 1200, height: 630, alt: 'Uithoorn.online' }] },
    twitter: { card: 'summary_large_image' as const, title: fullTitle, description, images: [image] },
  };
}

export function ogLocale(lang: Locale) {
  return lang === 'nl' ? 'nl_NL' : 'en_GB';
}

export function dateLocale(lang: Locale) {
  return lang === 'nl' ? 'nl-NL' : 'en-GB';
}

export function whatsappHref(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** +31616270233 -> +31 6 1627 0233 */
export function formatDutchMobile(digits: string) {
  const d = digits.replace(/\D/g, '');
  if (d.startsWith('316') && d.length === 11) return `+31 6 ${d.slice(3, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
