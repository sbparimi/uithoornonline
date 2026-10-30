import { SiteHeader } from '../site-header';
import { SiteFooter } from '../site-footer';
import { DirectoryExplorer, type ExplorerState } from './explorer';
import { getDirectoryIndex, parseDirectoryParams, runDirectoryQuery } from '../../lib/directory/data';
import { CATEGORY_BY_SLUG, SECTION_BY_ID, type SectionId } from '../../lib/directory/taxonomy';
import { lp, SITE_URL, type Locale } from '../../lib/i18n/config';
import { getDictionary } from '../../lib/i18n/dictionaries';
import { directoryText } from '../../lib/directory/i18n';
import { jsonLd } from '../../lib/json-ld';

type SP = Record<string, string | string[] | undefined>;

/** Server part of the directory: the first page of results is rendered on the server (fast first
 *  paint, works without JavaScript, indexable); the explorer takes over for instant search. */
export async function DirectoryPage({ lang, searchParams, fixed }: { lang: Locale; searchParams: SP; fixed?: { section?: SectionId; category?: string } }) {
  const parsed = parseDirectoryParams(searchParams, fixed);
  const pageSize = 24;
  const initial = await runDirectoryQuery({ ...parsed, offset: 0, limit: Math.min(240, parsed.page * pageSize) }, lang);
  const { index } = await getDirectoryIndex();
  const sectionTotals: Record<string, number> = {}, categoryTotals: Record<string, number> = {};
  for (const e of index.entries) {
    sectionTotals[e.section] = (sectionTotals[e.section] ?? 0) + 1;
    categoryTotals[e.category.slug] = (categoryTotals[e.category.slug] ?? 0) + 1;
  }
  const state: ExplorerState = { q: parsed.q ?? '', section: parsed.category ? null : parsed.section ?? null, category: parsed.category ?? null, place: parsed.place ?? null, has: parsed.has ?? [], sort: parsed.sort ?? 'relevance' };
  const t = getDictionary(lang);
  const seoLinks = Object.entries(t.service.services).map(([slug, v]) => ({ href: lp(lang, `/diensten/${slug}`), label: (v as readonly string[])[2] ?? slug }));

  const d = directoryText[lang];
  const scopeLabel = parsed.category ? CATEGORY_BY_SLUG.get(parsed.category)?.[lang] : parsed.section ? SECTION_BY_ID.get(parsed.section)?.[lang] : null;
  const pagePath = parsed.category ? `/businesses/categorie/${parsed.category}` : parsed.section ? `/businesses/categorie/${parsed.section}` : '/businesses';
  const structuredData = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: scopeLabel ? d.categoryMetaTitle(scopeLabel) : d.metaTitle,
      inLanguage: lang === 'nl' ? 'nl-NL' : 'en', url: `${SITE_URL}${lp(lang, pagePath)}`,
      isPartOf: { '@type': 'WebSite', name: 'Uithoorn.online', url: SITE_URL },
      about: { '@type': 'Place', name: 'Uithoorn, Nederland' },
      mainEntity: { '@type': 'ItemList', numberOfItems: initial.total, itemListElement: initial.items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, url: `${SITE_URL}${lp(lang, `/businesses/${item.id}`)}` })) },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: d.breadcrumbHome, item: `${SITE_URL}${lp(lang, '/')}` },
        { '@type': 'ListItem', position: 2, name: d.breadcrumbAll, item: `${SITE_URL}${lp(lang, '/businesses')}` },
        ...(scopeLabel ? [{ '@type': 'ListItem', position: 3, name: scopeLabel, item: `${SITE_URL}${lp(lang, pagePath)}` }] : []),
      ],
    },
  ];

  return (
    <div className="ds-page dir2-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <SiteHeader active="businesses" />
      <DirectoryExplorer lang={lang} initial={initial} initialState={state} page={parsed.page} sectionTotals={sectionTotals} categoryTotals={categoryTotals} seoLinks={seoLinks} />
      <SiteFooter lang={lang} />
    </div>
  );
}
