// Directory taxonomy: how the business categories (lib/categories.ts) are grouped into a few
// top-level sections, their public URL slugs (/businesses/categorie/<slug>) and the search words
// (Dutch + English, synonyms, common jobs) that should find them. Pure data, safe on client and server.
import { OTHER_CATEGORY } from '../categories';

export type SectionId =
  | 'wonen-klussen' | 'eten-drinken' | 'gezondheid-zorg' | 'beauty-wellness' | 'zakelijke-diensten'
  | 'auto-vervoer' | 'kinderen-onderwijs' | 'winkels' | 'sport-vrije-tijd' | 'overig';

export type IconName = 'hammer' | 'utensils' | 'heart' | 'scissors' | 'briefcase' | 'car' | 'graduation' | 'bag' | 'party' | 'grid';

export type DirectorySection = { id: SectionId; slug: string; nl: string; en: string; icon: IconName; blurbNl: string; blurbEn: string };

export const SECTIONS: DirectorySection[] = [
  { id: 'wonen-klussen', slug: 'wonen-klussen', nl: 'Wonen & klussen', en: 'Home & repairs', icon: 'hammer', blurbNl: 'Loodgieter, elektricien, schilder, tuin, schoonmaak', blurbEn: 'Plumber, electrician, painter, garden, cleaning' },
  { id: 'eten-drinken', slug: 'eten-drinken', nl: 'Eten & drinken', en: 'Food & drink', icon: 'utensils', blurbNl: 'Catering, afhaal, thuiskoks, bakkers', blurbEn: 'Catering, takeaway, home cooks, bakers' },
  { id: 'gezondheid-zorg', slug: 'gezondheid-zorg', nl: 'Gezondheid & zorg', en: 'Health & care', icon: 'heart', blurbNl: 'Fysio, therapie, thuiszorg', blurbEn: 'Physio, therapy, home care' },
  { id: 'beauty-wellness', slug: 'beauty-wellness', nl: 'Beauty & wellness', en: 'Beauty & wellness', icon: 'scissors', blurbNl: 'Kapper, nagels, massage', blurbEn: 'Hairdresser, nails, massage' },
  { id: 'zakelijke-diensten', slug: 'zakelijke-diensten', nl: 'Zakelijke diensten', en: 'Business services', icon: 'briefcase', blurbNl: 'Boekhouder, IT, marketing, juridisch', blurbEn: 'Accountant, IT, marketing, legal' },
  { id: 'auto-vervoer', slug: 'auto-vervoer', nl: 'Auto & vervoer', en: 'Car & transport', icon: 'car', blurbNl: 'Garage, fiets, verhuizen, koerier', blurbEn: 'Garage, bike, moving, courier' },
  { id: 'kinderen-onderwijs', slug: 'kinderen-onderwijs', nl: 'Kinderen & onderwijs', en: 'Kids & education', icon: 'graduation', blurbNl: 'Kinderopvang, bijles, workshops', blurbEn: 'Childcare, tutoring, workshops' },
  { id: 'winkels', slug: 'winkels', nl: 'Winkels', en: 'Shops', icon: 'bag', blurbNl: 'Lokale winkels en webshops', blurbEn: 'Local shops and web shops' },
  { id: 'sport-vrije-tijd', slug: 'sport-vrije-tijd', nl: 'Sport, vrije tijd & dieren', en: 'Sport, leisure & pets', icon: 'party', blurbNl: 'Sport, feesten, fotografie, huisdieren', blurbEn: 'Sport, parties, photography, pets' },
  { id: 'overig', slug: 'overig', nl: 'Overig', en: 'Other', icon: 'grid', blurbNl: 'Alles wat nergens anders past', blurbEn: 'Everything else' },
];

export type DirectoryCategory = {
  /** The value stored in businesses.category (lib/categories.ts), or OTHER_CATEGORY. */
  value: string;
  slug: string;
  section: SectionId;
  nl: string;
  en: string;
  /** Extra search words: synonyms, jobs, English and Dutch. Lowercase, no accents needed. */
  words: string;
};

export const CATEGORIES: DirectoryCategory[] = [
  // Wonen & klussen
  { value: 'Loodgieter', slug: 'loodgieter', section: 'wonen-klussen', nl: 'Loodgieter, cv & warmtepomp', en: 'Plumber, heating & heat pumps',
    words: 'loodgieter loodgieters plumber plumbing lekkage lek leak leaking kraan tap wc toilet riool ontstopping verstopping verstopt afvoer drain sanitair badkamer bathroom cv ketel boiler verwarming heating radiator warmtepomp heatpump heat pump installateur installatie installer gas water douche shower' },
  { value: 'Elektricien & installatie', slug: 'elektricien', section: 'wonen-klussen', nl: 'Elektricien & installatie', en: 'Electrician & installation',
    words: 'elektricien electrician elektra elektrisch electric electrical stroom power stopcontact socket groepenkast fusebox meterkast zekering laadpaal charger zonnepanelen solar panels verlichting lighting lamp storing installatie installer' },
  { value: 'Klus & onderhoud', slug: 'klusbedrijf', section: 'wonen-klussen', nl: 'Klus & onderhoud', en: 'Repairs & maintenance',
    words: 'klus klussen klusbedrijf klusjesman handyman reparatie repair repairs onderhoud maintenance timmerman carpenter vloer floor flooring keuken kitchen deur door montage assembly ikea' },
  { value: 'Bouw & aannemer', slug: 'aannemer', section: 'wonen-klussen', nl: 'Bouw & aannemer', en: 'Construction & contractors',
    words: 'bouw aannemer aannemers bouwbedrijf contractor builder building construction verbouwing renovatie renovation uitbouw extension dakdekker roofer dak roof metselaar bricklayer' },
  { value: 'Schilder & stukadoor', slug: 'schilder', section: 'wonen-klussen', nl: 'Schilder & stukadoor', en: 'Painter & plasterer',
    words: 'schilder schilders painter painting verf paint stukadoor stucwerk plasterer plaster behang wallpaper' },
  { value: 'Schoonmaak', slug: 'schoonmaak', section: 'wonen-klussen', nl: 'Schoonmaak', en: 'Cleaning',
    words: 'schoonmaak schoonmaker schoonmaakbedrijf cleaning cleaner cleaners glazenwasser ramen window washer huishoudelijke hulp housekeeping kantoorschoonmaak office' },
  { value: 'Tuin & buiten', slug: 'tuin-hovenier', section: 'wonen-klussen', nl: 'Tuin, hovenier & bestrating', en: 'Garden, landscaping & paving',
    words: 'tuin tuinman tuinier hovenier garden gardener gardening landscaping landscaper bestrating paving stratenmaker tegels tiles tiling schutting fence fencing gras grass gazon lawn snoeien pruning boom tree' },
  { value: 'Beveiliging & alarmsystemen', slug: 'beveiliging', section: 'wonen-klussen', nl: 'Beveiliging, alarm & camera', en: 'Security, alarms & cameras',
    words: 'beveiliging security alarm alarmsysteem camera cameras cctv slot lock slotenmaker locksmith inbraak burglary toegang access' },
  { value: 'Makelaar & vastgoed', slug: 'makelaar', section: 'wonen-klussen', nl: 'Makelaar & vastgoed', en: 'Estate agent & property',
    words: 'makelaar makelaars estate agent realtor vastgoed property huis house woning home kopen buy verkopen sell huren rent taxatie valuation' },
  // Eten & drinken
  { value: 'Eten & catering', slug: 'eten-catering', section: 'eten-drinken', nl: 'Eten, catering & horeca', en: 'Food, catering & hospitality',
    words: 'eten food catering caterer horeca restaurant cafe afhaal takeaway take away bezorgen delivery maaltijd meal lunch diner dinner thuiskeuken home kitchen kok chef bakker bakery taart cake' },
  { value: 'Indian food', slug: 'indiaas-eten', section: 'eten-drinken', nl: 'Indiaas eten', en: 'Indian food',
    words: 'indiaas indian curry biryani dosa idli vada thali tandoori masala food eten catering' },
  // Gezondheid & zorg
  { value: 'Gezondheid & therapie', slug: 'gezondheid-therapie', section: 'gezondheid-zorg', nl: 'Gezondheid, fysio & therapie', en: 'Health, physio & therapy',
    words: 'gezondheid health fysio fysiotherapeut fysiotherapie physio physiotherapy physiotherapist therapie therapy therapeut therapist psycholoog psychologist coach diëtist dietitian osteopaat chiropractor tandarts dentist huisarts doctor' },
  { value: 'Zorg & thuiszorg', slug: 'thuiszorg', section: 'gezondheid-zorg', nl: 'Zorg & thuiszorg', en: 'Care & home care',
    words: 'zorg thuiszorg care home care verpleging nursing nurse mantelzorg ouderen elderly begeleiding support' },
  // Beauty & wellness
  { value: 'Kapper & beauty', slug: 'kapper-beauty', section: 'beauty-wellness', nl: 'Kapper, beauty & wellness', en: 'Hair, beauty & wellness',
    words: 'kapper kappers kapsalon hairdresser hair haar barber barbershop salon beauty schoonheidssalon nagels nails manicure pedicure massage wellness spa makeup visagie' },
  // Zakelijke diensten
  { value: 'Administratie & financiën', slug: 'administratie-financien', section: 'zakelijke-diensten', nl: 'Administratie, boekhouding & financiën', en: 'Accounting, admin & finance',
    words: 'administratie administration boekhouder boekhouding bookkeeper bookkeeping accountant accounting belasting belastingaangifte tax financien finance financieel financial hypotheek mortgage verzekering insurance' },
  { value: 'IT & computerhulp', slug: 'it-computerhulp', section: 'zakelijke-diensten', nl: 'IT & computerhulp', en: 'IT & computer help',
    words: 'it computer computerhulp laptop pc wifi internet netwerk network printer telefoon phone reparatie repair software helpdesk' },
  { value: 'Marketing & webdesign', slug: 'marketing-webdesign', section: 'zakelijke-diensten', nl: 'Marketing, webdesign & drukwerk', en: 'Marketing, web design & print',
    words: 'marketing webdesign website websites web design designer ontwerp seo social media drukwerk print printing reclame advertising logo' },
  { value: 'Juridisch advies', slug: 'juridisch-advies', section: 'zakelijke-diensten', nl: 'Juridisch advies', en: 'Legal advice',
    words: 'juridisch legal advocaat lawyer notaris notary jurist advies advice contract' },
  { value: 'Professionele diensten', slug: 'zakelijke-diensten-advies', section: 'zakelijke-diensten', nl: 'Zakelijke diensten & advies', en: 'Business services & consulting',
    words: 'zakelijk zakelijke business professioneel professional advies advice consultant consulting adviseur vertaler translator' },
  // Auto & vervoer
  { value: 'Automotive', slug: 'auto-garage-fiets', section: 'auto-vervoer', nl: 'Auto, garage & fiets', en: 'Car, garage & bike',
    words: 'auto car cars garage monteur mechanic apk onderhoud service banden tyres tires fiets fietsen bike bicycle fietsenmaker scooter detailing poetsen wash' },
  { value: 'Transport & logistiek', slug: 'verhuizen-transport', section: 'auto-vervoer', nl: 'Verhuizen, transport & koerier', en: 'Moving, transport & courier',
    words: 'verhuizen verhuizer verhuisbedrijf moving movers removal transport logistiek logistics koerier courier bezorging delivery taxi busje van' },
  // Kinderen & onderwijs
  { value: 'Kinderopvang & gastouderopvang', slug: 'kinderopvang', section: 'kinderen-onderwijs', nl: 'Kinderopvang & gastouderopvang', en: 'Childcare & childminders',
    words: 'kinderopvang gastouder gastouderopvang oppas babysit babysitter childcare childminder nanny bso kinderdagverblijf daycare kinderen kids children' },
  { value: 'Onderwijs & bijles', slug: 'onderwijs-bijles', section: 'kinderen-onderwijs', nl: 'Onderwijs, bijles & lessen', en: 'Tutoring, lessons & training',
    words: 'onderwijs education bijles tutor tutoring huiswerkbegeleiding homework les lessen lessons cursus course training taal language muziekles music rijschool driving school' },
  { value: 'Workshop', slug: 'workshops', section: 'kinderen-onderwijs', nl: 'Workshops & lessen', en: 'Workshops & classes',
    words: 'workshop workshops les lessen class classes cursus course creatief creative' },
  // Winkels
  { value: 'Winkel & retail', slug: 'winkels', section: 'winkels', nl: 'Winkel & retail', en: 'Shop & retail',
    words: 'winkel winkels shop shops store retail webshop boutique kleding clothing cadeau gift bloemen flowers bloemist florist' },
  // Sport, vrije tijd & dieren
  { value: 'Sport & fitness', slug: 'sport-fitness', section: 'sport-vrije-tijd', nl: 'Sport, fitness & yoga', en: 'Sport, fitness & yoga',
    words: 'sport fitness gym yoga pilates personal trainer coach training zwemmen swimming dans dance' },
  { value: 'Evenementen & feesten', slug: 'evenementen-feesten', section: 'sport-vrije-tijd', nl: 'Evenementen & feesten', en: 'Events & parties',
    words: 'evenement evenementen event events feest feesten party parties bruiloft wedding verjaardag birthday dj verhuur rental' },
  { value: 'Fotografie & video', slug: 'fotografie-video', section: 'sport-vrije-tijd', nl: 'Fotografie & video', en: 'Photography & video',
    words: 'fotografie fotograaf photographer photography foto photo video videograaf videographer film drone' },
  { value: 'Dierenverzorging', slug: 'dierenverzorging', section: 'sport-vrije-tijd', nl: 'Dierenverzorging & trimsalon', en: 'Pet care & grooming',
    words: 'dieren dier huisdier huisdieren pet pets dog hond honden hondenuitlaat dog walker kat cat trimsalon grooming dierenarts vet oppas' },
  // Overig
  { value: OTHER_CATEGORY, slug: 'overig', section: 'overig', nl: 'Overig', en: 'Other', words: 'overig anders other overige diversen' },
];

/** Words in a free-text category ("Garden renovation, paving…") that say which known category it is. */
export const CATEGORY_BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));
export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));
export const SECTION_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));
export const SECTION_BY_SLUG = new Map(SECTIONS.map((s) => [s.slug, s]));

export function sectionLabel(id: SectionId, lang: 'nl' | 'en') {
  const s = SECTION_BY_ID.get(id);
  return s ? s[lang] : id;
}

/** Places we can tell from a Dutch postcode (first four digits). Anything else is "nearby". */
export type PlaceId = 'uithoorn' | 'de-kwakel' | 'omgeving';
const POSTCODE_TOWNS: { from: number; to: number; town: string; place: PlaceId }[] = [
  { from: 1420, to: 1423, town: 'Uithoorn', place: 'uithoorn' },
  { from: 1424, to: 1424, town: 'De Kwakel', place: 'de-kwakel' },
  { from: 1427, to: 1427, town: 'Amstelhoek', place: 'omgeving' },
  { from: 1430, to: 1433, town: 'Aalsmeer', place: 'omgeving' },
  { from: 1180, to: 1189, town: 'Amstelveen', place: 'omgeving' },
  { from: 1191, to: 1191, town: 'Ouderkerk a/d Amstel', place: 'omgeving' },
  { from: 2441, to: 2441, town: 'Nieuwveen', place: 'omgeving' },
  { from: 3641, to: 3646, town: 'Mijdrecht', place: 'omgeving' },
];

export function placeFromPostcode(postcode: string | null | undefined): { place: PlaceId; town: string | null } {
  const digits = Number((postcode || '').replace(/\D/g, '').slice(0, 4));
  if (!digits) return { place: 'uithoorn', town: null };
  const hit = POSTCODE_TOWNS.find((p) => digits >= p.from && digits <= p.to);
  return hit ? { place: hit.place, town: hit.town } : { place: 'omgeving', town: null };
}

export const PLACES: { id: PlaceId; nl: string; en: string }[] = [
  { id: 'uithoorn', nl: 'Uithoorn', en: 'Uithoorn' },
  { id: 'de-kwakel', nl: 'De Kwakel', en: 'De Kwakel' },
  { id: 'omgeving', nl: 'Omgeving', en: 'Nearby' },
];
