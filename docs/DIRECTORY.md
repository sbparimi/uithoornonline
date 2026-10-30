# Business directory (/businesses)

What residents see when they look for a local business. NL at `/businesses`, EN at `/en/businesses`.

## Pages
- `/businesses` – search bar with instant results + typeahead, the 10 sections as tiles, filters, results.
- `/businesses/categorie/<slug>` – one page per section (e.g. `wonen-klussen`) and per category (e.g. `loodgieter`).
  Indexable when it has at least one listing; listed in `sitemap.xml`. English aliases (`plumber`, `hairdresser`…) redirect.
- Searches and filters live in the URL (`?q=`, `plaats=uithoorn|de-kwakel|omgeving`, `met=website,phone`,
  `sort=az|newest`, `pagina=`), so every view can be shared. `?search=` (old links, homepage) still works.
- `GET /api/directory` – the same search as JSON (used for typing, filters and "Meer laden").

## How it is organised
- `lib/directory/taxonomy.ts` – sections, category → section, public slugs, and the search words per category
  (Dutch + English synonyms: "plumber" finds Loodgieter, "kapper"/"hairdresser", "cv ketel", …).
  **When you add a category in `lib/categories.ts`, add it here too** (free-text categories are mapped to the
  closest category by their words; unknown ones go to Overig).
- `lib/directory/search.ts` – pure search: inverted index, prefix matching while typing, typo tolerance
  (1 typo from 5 letters, 2 from 8), Dutch/English synonyms, postcode/street/town matching, facets.
  Place comes from the postcode (1420–1423 Uithoorn, 1424 De Kwakel, others "Omgeving" with the town shown).
- `lib/directory/data.ts` – loads approved + active listings, indexes them once per server instance and
  refreshes every 30 s (a newly approved business appears within ~30 s).
- `components/directory/*` – server page shell (first results rendered on the server, works without JS)
  and the client explorer. Styles: `app/directory-v2.css`. Copy: `lib/directory/i18n.ts`.

## House rule
SpiceIndia is pinned first for every food-related search/section/category it appears in (AGENTS.md).

## Scale
Comfortable up to a few thousand listings (index builds in milliseconds; queries walk the vocabulary,
not every listing). Past ~20k listings, move the text match into Postgres (`pg_trgm` + GIN index).

## Typography
Plus Jakarta Sans (variable, self-hosted, SIL OFL: `app/fonts/PlusJakartaSans-OFL.txt`, subset to latin + latin-ext
for Dutch diacritics) is the only typeface site-wide,
loaded in `app/[lang]/layout.tsx`; `app/typography.css` maps the theme's font tokens to it and sets
16px body / 1.6 line-height and AA-contrast text colours.

## Empty sections and categories
A section or category with no listings yet is shown as an invitation, not greyed out: the tile reads
"Nog vrij — wordt jouw bedrijf hier de eerste?" (EN "Still open — could your business be the first here?")
with a "Meld je bedrijf aan" / "List your business" link to `/signup/account?role=provider`. Empty category
chips and sidebar entries say "nog vrij" / "open"; an empty category page shows the invitation plus a
"Hulp aanvragen" link for customers. Empty category pages stay `noindex` until something is listed.
