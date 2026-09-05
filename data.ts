export const categories = [
  ['Diensten', 'Praktische hulp van lokale professionals'],
  ['Workshops', 'Creatief, leerzaam en lokaal'],
  ['Indian food', 'SpiceIndia · South Indian food in Uithoorn'],
  ['Wonen & klus', 'Huis, tuin, onderhoud en reparatie'],
  ['Beauty & wellness', 'Lokale salons en persoonlijke verzorging'],
  ['Creatief', 'Kunst, keramiek, fotografie en maken']
] as const;

export const businesses = [
  { name: 'Bluepaint', type: 'Schilder · klus · onderhoud', desc: 'Schilderwerk, timmerwerk en property maintenance in Uithoorn.', tag: 'Diensten' },
  { name: 'Klusbedrijf BouwLeer', type: 'Handyman', desc: 'Lokale hulp voor klussen en onderhoud in Uithoorn.', tag: 'Diensten' },
  { name: 'Scheers V.O.F.', type: 'Schoonmaak · glazenwasser', desc: 'Schoonmaak en glazenwasserij vanuit Uithoorn.', tag: 'Diensten' },
  { name: 'J&W installatietechniek', type: 'Elektricien · installatie', desc: 'Elektrische installaties en technische hulp in Uithoorn.', tag: 'Diensten' },
  { name: 'SpiceIndia', type: 'South Indian · takeaway', desc: 'Andhra-style biryani, dosa, idli, vada en vers bereid Indiaas eten in Uithoorn.', tag: 'SpiceIndia' }
] as const;

export const workshops = [
  { title: 'Keramiek & handdraaien', provider: 'CREA Uithoorn', meta: 'Fort aan de Drecht · vanaf 14 sep', description: 'Werk met klei, leer handdraaien en maak je eigen keramiek.' },
  { title: 'Tekenen & schilderen', provider: 'CREA Uithoorn', meta: 'Uithoorn · vanaf 7 sep', description: 'Creatieve cursussen voor beginners en gevorderden.' },
  { title: 'Edelsmeden', provider: 'CREA Uithoorn', meta: 'Uithoorn · vanaf 7 sep', description: 'Leer sieraden maken onder begeleiding van professionele docenten.' },
  { title: 'Keramiek schilderen pop-up', provider: 'SamDaé Creative Studio', meta: 'Uithoorn · op aanvraag', description: 'Schilder keramiek met materialen, begeleiding en bakken inbegrepen.' }
] as const;

export const foodSpots = [
  { name: 'SpiceIndia', type: 'South Indian · takeaway', highlight: 'Andhra-style biryani · dosa · idli · vada', meta: 'Uithoorn · vers bereid', tag: 'SpiceIndia' },
  { name: 'List your business here', type: 'Indian food · Uithoorn', highlight: 'Bereik lokale klanten via Uithoorn.online', meta: 'Plaats jouw bedrijf', tag: 'List your business here' },
  { name: 'Jouw restaurant hier', type: 'Indian food · Uithoorn', highlight: 'Zet jouw restaurant in de lokale spotlight', meta: 'Plaats jouw bedrijf', tag: 'List your business here' },
  { name: 'Jouw food business hier', type: 'Indian food · Uithoorn', highlight: 'Word zichtbaar voor mensen die lokaal Indiaas eten zoeken', meta: 'Plaats jouw bedrijf', tag: 'List your business here' }
] as const;

export const services = [
  { title: 'Klus & onderhoud', icon: '✦', description: 'Vind lokale hulp voor schilderen, timmeren en kleine klussen.' },
  { title: 'Elektricien', icon: '⌁', description: 'Elektrische installatie, storingen en technische hulp.' },
  { title: 'Schoonmaak', icon: '◌', description: 'Huishoudelijke schoonmaak, ramen en specialistische reiniging.' },
  { title: 'Tuin & buiten', icon: '❋', description: 'Tuinonderhoud en praktische hulp rondom het huis.' },
  { title: 'Beauty & wellness', icon: '◐', description: 'Lokale salons, haar, beauty en persoonlijke verzorging.' },
  { title: 'Creatieve lessen', icon: '◇', description: 'Keramiek, schilderen, fotografie en andere creatieve cursussen.' }
] as const;

export const events = [
  ['Kermis De Kwakel', '4–8 september · De Kwakel'],
  ['Open Monumentendag', '12 september · Uithoorn'],
  ['Kunst in De Kwakel', '24–25 oktober · De Kwakel']
] as const;

export const jobs = [
  { title: 'Lokale parttime medewerker', meta: 'Uithoorn · Parttime', description: 'Voorbeeldvacature voor een lokaal team.' },
  { title: 'Administratieve ondersteuning', meta: 'De Kwakel · Flexibel', description: 'Voorbeeldvacature voor lokale ondersteuning.' },
  { title: 'Weekendmedewerker', meta: 'Uithoorn · Weekend', description: 'Voorbeeldvacature met flexibele weekenduren.' }
] as const;

export const deals = [
  { title: 'Lokale introductie-aanbieding', meta: 'Deze week', description: 'Voorbeeldpromotie voor lokale ondernemers.' },
  { title: 'Nieuwe zaak in de buurt', meta: 'Nieuw', description: 'Voorbeeldpromotie voor een lokale onderneming.' },
  { title: 'Buurtdeal', meta: 'Beperkte actie', description: 'Voorbeelddeal die lokale vraag en lokaal aanbod samenbrengt.' }
] as const;
