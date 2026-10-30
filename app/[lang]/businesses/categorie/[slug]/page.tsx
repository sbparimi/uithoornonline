import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { DirectoryPage } from '../../../../../components/directory/directory-page';
import { alternatesFor, isLocale, lp, seo, SITE_URL, type Locale } from '../../../../../lib/i18n/config';
import { directoryText } from '../../../../../lib/directory/i18n';
import { CATEGORY_BY_SLUG, SECTION_BY_SLUG, type SectionId } from '../../../../../lib/directory/taxonomy';
import { getDirectoryIndex } from '../../../../../lib/directory/data';

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// English slugs people may type (/en/businesses/categorie/plumber) lead to the one canonical page.
const ALIASES: Record<string, string> = { plumber: 'loodgieter', electrician: 'elektricien', handyman: 'klusbedrijf', painter: 'schilder', cleaning: 'schoonmaak', gardener: 'tuin-hovenier', garden: 'tuin-hovenier', hairdresser: 'kapper-beauty', kapper: 'kapper-beauty', childcare: 'kinderopvang', catering: 'eten-catering', food: 'eten-drinken', eten: 'eten-drinken', security: 'beveiliging', movers: 'verhuizen-transport', verhuizer: 'verhuizen-transport', garage: 'auto-garage-fiets', tutoring: 'onderwijs-bijles', bijles: 'onderwijs-bijles', accountant: 'administratie-financien', boekhouder: 'administratie-financien', shops: 'winkels', other: 'overig' };

function resolve(slug: string): { section?: SectionId; category?: string; label: (lang: Locale) => string } | null {
  const cat = CATEGORY_BY_SLUG.get(slug);
  if (cat) return { category: cat.slug, label: (l) => cat[l] };
  const sec = SECTION_BY_SLUG.get(slug);
  if (sec) return { section: sec.id, label: (l) => sec[l] };
  return null;
}

async function countFor(scope: { section?: SectionId; category?: string }) {
  const { index } = await getDirectoryIndex();
  return index.entries.filter((e) => (scope.category ? e.category.slug === scope.category : e.section === scope.section)).length;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ lang: raw, slug }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  const scope = resolve(slug);
  if (!scope) return { robots: { index: false } };
  const t = directoryText[lang];
  const label = scope.label(lang);
  const n = await countFor(scope);
  const path = `/businesses/categorie/${slug}`;
  const title = t.categoryMetaTitle(label);
  const description = t.categoryMetaDescription(label, n);
  const filtered = Object.values(sp).some((v) => (Array.isArray(v) ? v[0] : v));
  // Empty categories stay out of search indexes until a business is listed in them.
  const robots = filtered || n === 0 ? { index: false, follow: true } : undefined;
  return { title, description, ...seo(lang, path, title, description), ...(filtered ? { alternates: { ...alternatesFor(lang, path), canonical: `${SITE_URL}${lp(lang, path)}` } } : {}), ...(robots ? { robots } : {}) };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ lang: raw, slug }, sp] = await Promise.all([params, searchParams]);
  const lang: Locale = isLocale(raw) ? raw : 'nl';
  if (ALIASES[slug]) permanentRedirect(lp(lang, `/businesses/categorie/${ALIASES[slug]}`));
  const scope = resolve(slug);
  if (!scope) notFound();
  return <DirectoryPage lang={lang} searchParams={sp} fixed={{ section: scope.section, category: scope.category }} />;
}
