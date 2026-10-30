// Business categories (what a business picks at signup and on its profile).
// The value is stored as-is in businesses.category and shown publicly, so it is plain Dutch.
// Labels are what the dropdown shows. Lead matching (lib/data/requests.ts MATCH_SQL) reads the
// category and description, so new values should carry words the matcher knows.
// The public directory groups these into sections: add new values to lib/directory/taxonomy.ts too.
export type BusinessCategory = { value: string; nl: string; en: string };

/** The free-text choice: the business types its own category. */
export const OTHER_CATEGORY = 'Overig';

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  { value: 'Administratie & financiën', nl: 'Administratie, boekhouding & financiën', en: 'Accounting, admin & finance' },
  { value: 'Automotive', nl: 'Auto, garage & fiets', en: 'Car, garage & bike' },
  { value: 'Beveiliging & alarmsystemen', nl: 'Beveiliging, alarm & camera', en: 'Security, alarms & cameras' },
  { value: 'Bouw & aannemer', nl: 'Bouw & aannemer', en: 'Construction & contractors' },
  { value: 'Dierenverzorging', nl: 'Dierenverzorging & trimsalon', en: 'Pet care & grooming' },
  { value: 'Elektricien & installatie', nl: 'Elektricien & installatie', en: 'Electrician & installation' },
  { value: 'Eten & catering', nl: 'Eten, catering & horeca', en: 'Food, catering & hospitality' },
  { value: 'Evenementen & feesten', nl: 'Evenementen & feesten', en: 'Events & parties' },
  { value: 'Fotografie & video', nl: 'Fotografie & video', en: 'Photography & video' },
  { value: 'Gezondheid & therapie', nl: 'Gezondheid, fysio & therapie', en: 'Health, physio & therapy' },
  { value: 'IT & computerhulp', nl: 'IT & computerhulp', en: 'IT & computer help' },
  { value: 'Juridisch advies', nl: 'Juridisch advies', en: 'Legal advice' },
  { value: 'Kapper & beauty', nl: 'Kapper, beauty & wellness', en: 'Hair, beauty & wellness' },
  { value: 'Kinderopvang & gastouderopvang', nl: 'Kinderopvang & gastouderopvang', en: 'Childcare & childminders' },
  { value: 'Klus & onderhoud', nl: 'Klus & onderhoud', en: 'Repairs & maintenance' },
  { value: 'Loodgieter', nl: 'Loodgieter, cv & warmtepomp', en: 'Plumber, heating & heat pumps' },
  { value: 'Makelaar & vastgoed', nl: 'Makelaar & vastgoed', en: 'Estate agent & property' },
  { value: 'Marketing & webdesign', nl: 'Marketing, webdesign & drukwerk', en: 'Marketing, web design & print' },
  { value: 'Onderwijs & bijles', nl: 'Onderwijs, bijles & lessen', en: 'Tutoring, lessons & training' },
  { value: 'Schilder & stukadoor', nl: 'Schilder & stukadoor', en: 'Painter & plasterer' },
  { value: 'Schoonmaak', nl: 'Schoonmaak', en: 'Cleaning' },
  { value: 'Sport & fitness', nl: 'Sport, fitness & yoga', en: 'Sport, fitness & yoga' },
  { value: 'Tuin & buiten', nl: 'Tuin, hovenier & bestrating', en: 'Garden, landscaping & paving' },
  { value: 'Transport & logistiek', nl: 'Verhuizen, transport & koerier', en: 'Moving, transport & courier' },
  { value: 'Winkel & retail', nl: 'Winkel & retail', en: 'Shop & retail' },
  { value: 'Professionele diensten', nl: 'Zakelijke diensten & advies', en: 'Business services & consulting' },
  { value: 'Zorg & thuiszorg', nl: 'Zorg & thuiszorg', en: 'Care & home care' },
];

/** Older values some accounts were created with; still offered so those profiles keep working. */
export const LEGACY_CATEGORIES: BusinessCategory[] = [
  { value: 'Workshop', nl: 'Workshops & lessen', en: 'Workshops & classes' },
  { value: 'Indian food', nl: 'Indiaas eten', en: 'Indian food' },
];

const ALL = [...BUSINESS_CATEGORIES, ...LEGACY_CATEGORIES];

export function categoryLabel(value: string, lang: 'nl' | 'en'): string {
  if (value === OTHER_CATEGORY) return lang === 'en' ? 'Other (type your own)' : 'Anders / overig (zelf invullen)';
  const hit = ALL.find((c) => c.value === value);
  return hit ? hit[lang] : value;
}

/** Dropdown options sorted by label in the reader's language, with "Other" last. */
export function categoryOptions(lang: 'nl' | 'en', { legacy = false }: { legacy?: boolean } = {}): string[] {
  const list = legacy ? ALL : BUSINESS_CATEGORIES;
  return [...list].sort((a, b) => a[lang].localeCompare(b[lang], lang)).map((c) => c.value).concat(OTHER_CATEGORY);
}

export function isKnownCategory(value: string): boolean {
  return ALL.some((c) => c.value === value);
}
