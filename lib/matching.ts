import { BUSINESS_CATEGORIES, LEGACY_CATEGORIES } from './categories';

// Lead matching: which businesses fit a resident's request category (lib/request-options.ts).
// Category-id based first (a business picks one of lib/categories.ts at signup), so "Automotive" never
// matches "Zorg & thuiszorg" or "childcare" just because those words contain "car" (the old substring
// regex did). Keyword patterns (Postgres ARE, \m = start of a word, \M = end of a word) are only used
// for businesses with a custom category ("Overig" + their own words), which have no category id.
// Shared by lib/data/requests.ts (createRequest) and lib/urgent/alerts.ts (spoed pool).

type Rule = { primary: string[]; secondary?: string[]; kw: string };

export const MATCH_RULES: Record<string, Rule> = {
  'Home improvement & renovation': { primary: ['Bouw & aannemer', 'Schilder & stukadoor'], secondary: ['Klus & onderhoud'], kw: String.raw`\m(verbouw\w*|renovat\w*|renovie\w*|bouw\w*|aannem\w*|schilder\w*|stuca\w*|stukado\w*|timmer\w*|tegel\w*|vloer\w*|dakdek\w*|badkamer\w*|keuken\w*)\M` },
  'Garden & outdoor': { primary: ['Tuin & buiten'], kw: String.raw`\m(tuin\w*|hovenier\w*|bestrating\w*|stratenmaker\w*|schutting\w*|garden\w*|landscap\w*)\M` },
  Plumber: { primary: ['Loodgieter'], kw: String.raw`\m(loodgiet\w*|plumb\w*|lekkage\w*|riool\w*|ontstop\w*|cv|cv-\w+|verwarming\w*|warmtepomp\w*|sanitair\w*)\M` },
  'Electrician & installation': { primary: ['Elektricien & installatie'], kw: String.raw`\m(elektric\w*|elektro\w*|elektra|electric\w*|installatietechn\w*|laadpa\w*|zonnepan\w*)\M` },
  Handyman: { primary: ['Klus & onderhoud'], secondary: ['Bouw & aannemer'], kw: String.raw`\m(klus\w*|handyman|montage\w*|onderhoud\w*|reparatie\w*)\M` },
  'Cleaning & household': { primary: ['Schoonmaak'], kw: String.raw`\m(schoonma\w*|glazenwas\w*|cleaning|cleaner\w*|huishoud\w*)\M` },
  'Transport & logistics': { primary: ['Transport & logistiek'], kw: String.raw`\m(verhuis\w*|transport\w*|koerier\w*|courier\w*|moving|movers?)\M` },
  'Security & alarm systems': { primary: ['Beveiliging & alarmsystemen'], kw: String.raw`\m(beveilig\w*|alarm\w*|security|camera\w*|slotenmaker\w*|sloten)\M` },
  Childcare: { primary: ['Kinderopvang & gastouderopvang'], kw: String.raw`\m(kinderopvang\w*|gastouder\w*|oppas\w*|childcare|childminder\w*|peuter\w*|bso|babysit\w*)\M` },
  'Care & health': { primary: ['Zorg & thuiszorg', 'Gezondheid & therapie'], kw: String.raw`\m(thuiszorg\w*|zorg|zorgverlen\w*|verpleeg\w*|fysio\w*|therap\w*|gezondheid\w*|health\w*|nursing|home care)\M` },
  'Hair & beauty': { primary: ['Kapper & beauty'], kw: String.raw`\m(kapper\w*|kapsalon\w*|barber\w*|beauty|schoonheid\w*|nagel\w*|hair\w*|wellness)\M` },
  'Lessons & tutoring': { primary: ['Onderwijs & bijles'], kw: String.raw`\m(bijles\w*|huiswerk\w*|tutor\w*|rijles\w*|muziekles\w*|cursus\w*|lessen|taalles\w*)\M` },
  'Computer & IT help': { primary: ['IT & computerhulp'], kw: String.raw`\m(computer\w*|ict|laptop\w*|netwerk\w*|wifi|it-hulp|it-support|printer\w*)\M` },
  Pets: { primary: ['Dierenverzorging'], kw: String.raw`\m(dier\w*|hond\w*|kat|katten\w*|huisdier\w*|trimsalon\w*|pets?|dogs?|cats?)\M` },
  'Photography & video': { primary: ['Fotografie & video'], kw: String.raw`\m(foto\w*|photo\w*|video\w*|film\w*)\M` },
  'Sport & fitness': { primary: ['Sport & fitness'], kw: String.raw`\m(sport\w*|fitness|personal trainer|yoga|pilates|gym)\M` },
  'Property services': { primary: ['Makelaar & vastgoed'], kw: String.raw`\m(makelaar\w*|vastgoed\w*|vve|property|verhuur\w*)\M` },
  Automotive: { primary: ['Automotive'], kw: String.raw`\m(auto(?!mati)\w*|garage\w*|apk|carrosserie\w*|banden\w*|fiets\w*|cars?|bikes?)\M` },
  'Family & personal': { primary: ['Zorg & thuiszorg'], secondary: ['Kinderopvang & gastouderopvang'], kw: String.raw`\m(oppas\w*|gastouder\w*|persoonlijk\w*|mantelzorg\w*)\M` },
  'Events & occasions': { primary: ['Evenementen & feesten'], secondary: ['Eten & catering', 'Fotografie & video'], kw: String.raw`\m(evenement\w*|feest\w*|party|parties|events?|catering)\M` },
  'Food & catering': { primary: ['Eten & catering'], kw: String.raw`\m(catering|cater\w*|restaurant\w*|eten|food|bakker\w*|traiteur|horeca)\M` },
  'Financial & administration': { primary: ['Administratie & financiën'], kw: String.raw`\m(administrat\w*|boekhoud\w*|belasting\w*|accountan\w*|financ\w*)\M` },
  'Legal advice': { primary: ['Juridisch advies'], kw: String.raw`\m(jurid\w*|advoca\w*|notaris\w*|legal|mediat\w*)\M` },
  'Professional services': { primary: ['Professionele diensten'], secondary: ['Administratie & financiën', 'Marketing & webdesign', 'Juridisch advies'], kw: String.raw`\m(zakelijk\w*|advies\w*|consult\w*|marketing)\M` },
};

/** Every category value a business can pick (known ids). Businesses outside this list typed their own. */
export const KNOWN_BUSINESS_CATEGORIES = [...BUSINESS_CATEGORIES, ...LEGACY_CATEGORIES].map((c) => c.value);

/**
 * Candidate businesses for a request, best first. Parameters (see matchParams):
 * $1 primary category ids, $2 secondary ids, $3 keyword pattern for custom categories, $4 known ids,
 * $5 first 4 postcode digits, $6 the customer's user id (a business never gets its owner's own request).
 * Ranking: category fit (primary, secondary, custom-keyword), then rating from verified reviews
 * (Bayesian: an unreviewed business sits at 3.5, so good ratings rise and poor ones sink), then same
 * postcode area, then featured, then newest. Columns: id, name, owner_id, owner_email, owner_locale, tier, rating, reviews.
 */
export const MATCH_SQL = `
  select b.id, b.name, b.owner_id, u.email as owner_email, u.locale as owner_locale, f.tier,
         round(((coalesce(rv.total, 0) + 7.0) / (coalesce(rv.n, 0) + 2))::numeric, 2)::float as rating, coalesce(rv.n, 0)::int as reviews
    from businesses b join users u on u.id = b.owner_id
    cross join lateral (select case when b.category = any($1::text[]) then 1
                                    when b.category = any($2::text[]) then 2
                                    when not (b.category = any($4::text[])) and $3::text <> '' and lower(b.category || ' ' || b.description) ~ $3::text then 3
                                    else null end as tier) f
    left join lateral (select count(*)::int as n, sum(r.rating)::int as total from reviews r where r.business_id = b.id and r.hidden = false) rv on true
   where b.moderation_status = 'approved' and b.active = true and u.disabled_at is null
     and b.owner_id <> $6
     and lower(b.category) not like '%indian food%'
     and lower(b.category) not like '%workshop%'
     and f.tier is not null
   -- No hard postcode filter (the site only serves Uithoorn & De Kwakel); same postcode ranks higher.
   order by f.tier, rating desc, case when left(regexp_replace(coalesce(b.postcode, ''), '[^0-9]', '', 'g'), 4) = $5 then 0 else 1 end, b.featured desc, b.created_at desc
   limit 25`;

/** Positional parameters for MATCH_SQL. An unknown request category falls back to keyword-only matching. */
export function matchParams(requestCategory: string, postcode4: string, customerId: string): unknown[] {
  const rule = MATCH_RULES[requestCategory];
  return [rule?.primary ?? [], rule?.secondary ?? [], rule?.kw ?? '', KNOWN_BUSINESS_CATEGORIES, postcode4, customerId];
}
