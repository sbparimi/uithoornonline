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

export const businessProspects = [
  {
    business_name: 'De Boekhoud Company', category: 'Accounting & bookkeeping', contact_person: null,
    phone: '+31622169954', email: null, website: null, address: null,
    source_url: 'Business listing De Boekhoud Company', source_type: 'public_business_listing',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'lead_intake_and_appointment_booking', priority: 'P1'
  },
  {
    business_name: 'KiSO Beauty', category: 'Beauty', contact_person: 'Sofi',
    phone: '+31614577585', email: 'srbeautyuithoorn@gmail.com', website: 'https://sofi.salonized.com',
    address: 'Wiegerbruinlaan 77, 1422 CB Uithoorn', source_url: 'https://sofi.salonized.com/services', source_type: 'public_business_profile',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'appointment_booking', priority: 'P1'
  },
  {
    business_name: 'Coachpraktijk Niels Zwaan', category: 'Coaching', contact_person: 'Niels Zwaan',
    phone: '+31624260672', email: null, website: null, address: null,
    source_url: 'Coachpraktijk Niels Zwaan', source_type: 'public_business_listing',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'lead_intake_and_appointment_booking', priority: 'P1'
  },
  {
    business_name: 'Bijles met Tanisha', category: 'Tutoring & education', contact_person: 'Tanisha',
    phone: '+31620984278', email: null, website: null, address: null,
    source_url: 'Bijles met Tanisha', source_type: 'public_business_listing',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'student_intake_and_appointment_booking', priority: 'P1'
  },
  {
    business_name: 'JM Fotografie Uithoorn', category: 'Photography', contact_person: 'Jenny / Mandy',
    phone: '+31655961226 / +31610738402', email: 'info@jm-fotografie.nl', website: 'https://jm-fotografie.nl', address: null,
    source_url: 'https://jm-fotografie.nl/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'enquiry_intake_and_booking', priority: 'P1'
  },
  {
    business_name: 'Sonah Catering', category: 'Catering & food', contact_person: 'Eelco Meerman',
    phone: '0297-244442 / +31641833825', email: 'info@sonah.nl / eelco@sonah.nl', website: 'https://sonah.nl', address: null,
    source_url: 'https://sonah.nl/algemene-voorwaarden-b2c/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'event_enquiry_and_catering_lead_intake', priority: 'P1'
  },
  {
    business_name: 'Vlekbestrijder', category: 'Cleaning & stain removal', contact_person: null,
    phone: '+31641325922', email: 'Vlekbestrijder@gmail.com', website: 'https://vlekbestrijder.nl', address: null,
    source_url: 'https://vlekbestrijder.nl/contact/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'service_enquiry_and_quote_intake', priority: 'P1'
  },
  {
    business_name: 'Wesselings Hoveniersbedrijf', category: 'Gardening & landscaping', contact_person: 'Ronald Wesselings',
    phone: '0297-530555', email: 'ronald@wesselings.nl', website: 'https://www.wesselings.nl', address: null,
    source_url: 'https://www.wesselings.nl/contact/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'service_request_and_quote_intake', priority: 'P1'
  },
  {
    business_name: 'EVO / EVE Coaching & Training', category: 'Coaching & training', contact_person: 'Evelyne Kadito',
    phone: '+31653646704', email: 'evoeve.coaching@gmail.com', website: null, address: null,
    source_url: 'https://coachdichtbij.nl/coach/holistische-coach-amstelveen-evelyne-kadito-van-der-schaaf/', source_type: 'public_professional_profile',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'lead_intake_and_appointment_booking', priority: 'P1'
  },
  {
    business_name: 'Wiskunde Bijles Uithoorn', category: 'Tutoring & education', contact_person: null,
    phone: '+31653535515', email: null, website: null, address: null,
    source_url: 'Wiskunde Bijles Uithoorn', source_type: 'public_business_listing',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'student_intake_and_appointment_booking', priority: 'P1'
  },
  {
    business_name: 'By Noesha Photography', category: 'Photography', contact_person: 'Nooi van Maarsen',
    phone: '+31645194233', email: 'contact@bynoesha.com', website: null, address: null,
    source_url: 'https://www.theperfectwedding.nl/bedrijven/222326/by-noesha-photography', source_type: 'public_business_profile',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'event_enquiry_and_booking', priority: 'P1'
  },
  {
    business_name: 'Flavours of Dil-li', category: 'Food & catering', contact_person: null,
    phone: '+31616331928', email: null, website: null, address: null,
    source_url: 'Flavours of Dil-li', source_type: 'public_business_listing',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'food_enquiry_and_catering_lead_intake', priority: 'P1'
  },
  {
    business_name: 'Raggers Cleaning', category: 'Cleaning', contact_person: null,
    phone: '0297-563070', email: 'offerte@raggers.nl', website: null, address: null,
    source_url: 'Published business material', source_type: 'published_business_material',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'service_enquiry_and_quote_intake', priority: 'P1'
  },
  {
    business_name: 'Top Broodje', category: 'Food & catering', contact_person: null,
    phone: '+31624418991', email: null, website: 'https://www.topbroodje.nl', address: null,
    source_url: 'https://www.topbroodje.nl/contact', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'food_order_and_enquiry_intake', priority: 'P1'
  },
  {
    business_name: 'Amazing Nails by Nathali', category: 'Beauty & nails', contact_person: 'Nathali',
    phone: '+31653601164', email: 'contact.amazingnails@gmail.com', website: 'https://www.amazing-nails-by-nathali.nl', address: null,
    source_url: 'https://www.amazing-nails-by-nathali.nl/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'appointment_booking', priority: 'P1'
  },
  {
    business_name: 'Technisch Bureau Frank Bouman', category: 'Technical services', contact_person: 'Frank Bouman',
    phone: '0297-548481', email: 'info@tbfb.nl', website: 'https://www.tbfb.nl', address: null,
    source_url: 'https://www.tbfb.nl/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'technical_enquiry_and_lead_intake', priority: 'P1'
  },
  {
    business_name: 'JDG Multiservice', category: 'Multiservice & local services', contact_person: null,
    phone: '+31640635234', email: null, website: 'https://www.jdgmultiservice.nl', address: null,
    source_url: 'https://www.jdgmultiservice.nl/', source_type: 'official_website',
    email_verified: false, contact_verified: true, outreach_status: 'not_contacted',
    ai_agent_use_case: 'service_enquiry_and_lead_intake', priority: 'P1'
  }
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
