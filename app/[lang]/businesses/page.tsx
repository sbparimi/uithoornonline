import type { Metadata } from 'next';
import { DirectoryPage } from '../../../components/directory/directory-page';
import { alternatesFor, isLocale, lp, seo, SITE_URL, type Locale } from '../../../lib/i18n/config';
import { directoryText } from '../../../lib/directory/i18n';

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const t = directoryText[lang];
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
  const query = one(sp.q) || one(sp.search);
  // Searches and filtered views are not separate pages for search engines; the plain directory and
  // the category pages (/businesses/categorie/…) are.
  if (query || one(sp.plaats) || one(sp.met) || one(sp.sort) || one(sp.pagina)) {
    const alternates = alternatesFor(lang, '/businesses');
    return { title: query ? t.queryMetaTitle(query) : t.metaTitle, description: t.metaDescription, alternates: { ...alternates, canonical: `${SITE_URL}${lp(lang, '/businesses')}` }, robots: { index: false, follow: true } };
  }
  return { title: t.metaTitle, description: t.metaDescription, ...seo(lang, '/businesses', t.metaTitle, t.metaDescription) };
}

export default async function BusinessesPage({ params, searchParams }: Props) {
  const [{ lang: raw }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  return <DirectoryPage lang={lang} searchParams={sp} />;
}
