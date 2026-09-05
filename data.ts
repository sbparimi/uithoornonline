export const categories = [
  ['Diensten','Praktische hulp van lokale professionals'],
  ['Winkels','Lokale winkels en makers'],
  ['Eten & drinken','Restaurants, cafés en afhaalzaken'],
  ['Klussen','Hulp voor huis, tuin en onderhoud'],
  ['Werk','Banen en kansen dichtbij huis'],
  ['Evenementen','Wat er binnenkort gebeurt'],
  ['Aanbiedingen','Lokale deals en promoties'],
  ['Buurt','Verzoeken, tips en community']
] as const;

export const businesses = [
  { name: 'Local Services', type: 'Diensten', desc: 'Een voorbeeldprofiel voor lokale professionals en dienstverlening.', tag: 'Uitgelicht' },
  { name: 'Eet & Drink Uithoorn', type: 'Eten & drinken', desc: 'Een voorbeeldprofiel voor lokale horeca en afhaalzaken.', tag: 'Lokaal' },
  { name: 'Home & Klus', type: 'Klussen', desc: 'Een voorbeeldprofiel voor onderhoud, reparatie en klussen.', tag: 'Nieuw' },
  { name: 'Uithoorn Jobs', type: 'Werk', desc: 'Een voorbeeldprofiel voor lokale werkgevers en vacatures.', tag: 'Werk' }
] as const;

export const events = [
  ['Weekendmarkt','5 september · Centrum Uithoorn'],
  ['Live aan de Amstel','6 september · Amstelplein'],
  ['Buurtborrel De Kwakel','7 september · De Kwakel']
] as const;

export const jobs = [
  { title: 'Lokale parttime medewerker', meta: 'Uithoorn · Parttime', description: 'Voorbeeldvacature voor een lokaal team. Werk dichtbij huis.' },
  { title: 'Administratieve ondersteuning', meta: 'De Kwakel · Flexibel', description: 'Voorbeeldvacature voor ondersteuning bij een lokale organisatie.' },
  { title: 'Weekendmedewerker', meta: 'Uithoorn · Weekend', description: 'Voorbeeldvacature voor werk met flexibele weekenduren.' }
] as const;

export const deals = [
  { title: 'Lokale introductie-aanbieding', meta: 'Deze week', description: 'Voorbeeldpromotie. Lokale ondernemers kunnen hier aanbiedingen publiceren.' },
  { title: 'Nieuwe zaak in de buurt', meta: 'Nieuw', description: 'Voorbeeldpromotie voor een nieuwe lokale onderneming.' },
  { title: 'Buurtdeal', meta: 'Beperkte actie', description: 'Voorbeelddeal die lokale vraag en lokaal aanbod samenbrengt.' }
] as const;
