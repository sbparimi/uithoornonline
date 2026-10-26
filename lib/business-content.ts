import type { Locale } from './i18n/config';

export type PublicBusiness = { id: string; name: string; category: string; description: string; postcode: string | null; address?: string | null; website: string | null; phone: string | null; verified: boolean };

const SPICEINDIA_ID = '15953249-c000-4521-839d-41bf341b6aa8';
export const spiceIndiaId = SPICEINDIA_ID;

/** Shown when the database returns no businesses. Same two listings the live site already shows. */
export const fallbackBusinesses: PublicBusiness[] = [
  { id: SPICEINDIA_ID, name: 'SpiceIndia', category: 'Indian food & catering', description: 'South Indian home kitchen in Uithoorn offering freshly prepared takeaway and catering. Specialities include Andhra-style biryani, dosa, idli and vada. Pickup only; no delivery. Catering available in Uithoorn and Amstelveen.', postcode: '1421', website: 'https://www.spiceindia.nl/', phone: '+31 6 45480446', verified: true },
  { id: '68efa8f0-6e5f-4ea9-ba5b-94fbff1fba35', name: 'Ruslen', category: 'Garden renovation, paving, tiling & fencing', description: 'Local contractor for garden renovation and outdoor works, including paving, tiles and fencing. Contact Ruslen for project details, scope and quotation.', postcode: '1421', website: null, phone: '+31616270233', verified: true },
];

/**
 * Dutch versions of business texts that are stored in English. Keyed by the exact English text,
 * so an edited listing simply shows its own text instead of a stale translation.
 */
const dutch: Record<string, string> = {
  'Indian food & catering': 'Indiaas eten & catering',
  'South Indian home kitchen in Uithoorn offering freshly prepared takeaway and catering. Specialities include Andhra-style biryani, dosa, idli and vada. Pickup only; no delivery. Catering available in Uithoorn and Amstelveen.':
    'Zuid-Indiase thuiskeuken in Uithoorn met vers bereide afhaalmaaltijden en catering. Specialiteiten zijn onder meer biryani in Andhra-stijl, dosa, idli en vada. Alleen afhalen, geen bezorging. Catering mogelijk in Uithoorn en Amstelveen.',
  'Garden renovation, paving, tiling & fencing': 'Tuinrenovatie, bestrating, tegelwerk & schuttingen',
  'Local contractor for garden renovation and outdoor works, including paving, tiles and fencing. Contact Ruslen for project details, scope and quotation.':
    'Lokale aannemer voor tuinrenovatie en buitenwerk, waaronder bestrating, tegelwerk en schuttingen. Neem contact op met Ruslen voor de mogelijkheden, de omvang van het werk en een offerte.',
};

export function localizeText(text: string | null | undefined, lang: Locale): string {
  if (!text) return '';
  if (lang === 'nl') return dutch[text.trim()] ?? text;
  return text;
}

export function localizeBusiness<T extends { category: string; description: string | null }>(business: T, lang: Locale): T {
  return { ...business, category: localizeText(business.category, lang), description: localizeText(business.description, lang) };
}
