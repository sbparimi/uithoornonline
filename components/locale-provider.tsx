'use client';

import { useEffect, useState } from 'react';

type Locale = 'nl' | 'en';
const STORAGE_KEY = 'uithoorn-locale';
const translations: Record<string,string> = {
  'Diensten':'Services','Workshops':'Workshops','Indian food':'Indian food','Ontdek':'Discover','Agenda':'Agenda','Voor bedrijven':'For businesses','Plaats je bedrijf':'List your business','Word aanbieder':'Become a provider','Aanbieders':'Providers','Lokale aanbieders':'Local providers','Gids':'Directory','Lokale diensten':'Local services','Lokale agenda':'Local agenda','Werk & kansen':'Work & opportunities','Lokaal voordeel':'Local offers','Voor lokale ondernemers':'For local entrepreneurs','Account':'Account','Registratie':'Registration','Inloggen':'Sign in','Mijn account':'My account','Nieuwe aanvraag':'New request','Uitloggen':'Sign out','Mijn aanvragen':'My requests','Gesprekken':'Conversations','Meldingen':'Notifications','Nieuwe aanvragen':'New requests','Profielstatus':'Profile status','Geverifieerd':'Verified','In beoordeling':'Under review','Actief':'Active','Review':'Review','Aanvraag':'Request','Lokale aanbieder':'Local provider','Lokaal':'Local','Dienst':'Service','Vacature':'Job','Aanbieding':'Offer','Geen resultaten':'No results','Geen resultaten gevonden. Probeer een andere zoekterm.':'No results found. Try another search term.','Geen nieuwe meldingen.':'No new notifications.','Nog geen aanvragen.':'No requests yet.','Nog geen gesprekken.':'No conversations yet.','Niets gevonden':'Nothing found','Zoekresultaten':'Search results','Toon alles':'Show all','ZOEK LOKAAL':'SEARCH LOCALLY','Populair':'Popular','Lokale ontdekking':'Local discovery','Vind een dienst':'Find a service','Ontdek workshops':'Discover workshops','Bekijk aanbieder':'View provider','Bekijk workshop':'View workshop','Alle workshops':'All workshops','Bekijk menu':'View menu','Ontdek SpiceIndia':'Discover SpiceIndia','Volledige gids':'Full directory','Bekijk lokale aanbieders':'View local providers','Word zichtbaar':'Get discovered','Plaats vacature':'Post a job','Bekijk platform':'View platform','Naar inloggen':'Go to sign in','Account aanmaken':'Create account','Nog geen account? Registreren':'No account yet? Register','Al een account? Inloggen':'Already have an account? Sign in','Check je e-mail.':'Check your email.','Je account is aangemaakt. Bevestig je e-mailadres om verder te gaan.':'Your account has been created. Confirm your email address to continue.','Ga naar je account.':'Go to your account.','We sturen een veilige inloglink naar je e-mailadres.':'We will send a secure sign-in link to your email address.','Inloglink sturen':'Send sign-in link','Ik zoek iets':'I am looking for something','Ik bied iets aan':'I offer something','Naam':'Name','E-mailadres':'Email address','Telefoon':'Phone','Optioneel':'Optional','Bedrijfsnaam':'Business name','Categorie':'Category','Postcode':'Postal code','Wanneer heb je hulp nodig?':'When do you need help?','Selecteer een optie':'Select an option','Deze week':'This week','Deze maand':'This month','Later':'Later','Wat heb je nodig?':'What do you need?','Waarmee kunnen we helpen?':'How can we help?','Aanvraag starten':'Start request','Aanvraag versturen…':'Sending request…','Aanvraag ontvangen':'Request received','We hebben je aanvraag opgeslagen.':'Your request has been saved.','Bekijk mijn aanvragen':'View my requests','Vertel wat je nodig hebt.':'Tell us what you need.','Lokale hulp':'Local help','Hulp nodig? Vraag het lokaal.':'Need help? Ask locally.','Word zichtbaar waar lokaal wordt gezocht.':'Be visible where people search locally.','Gemaakt voor lokaal ontdekken.':'Made for local discovery.','Alles lokaal.':'Everything local.','Alles dichtbij.':'Everything nearby.','Een lokale plek om':'A local place to','te ontdekken.':'discover.','Van zoeken naar':'From searching to','vinden.':'finding.','Leer iets nieuws.':'Learn something new.','Maak iets zelf.':'Make something yourself.','Lokale smaak.':'Local flavour.','Vers bereid.':'Freshly prepared.','Sta waar je':'Be where you','gevonden wordt.':'get found.','Relevant':'Relevant','Eenvoudig':'Simple','Open voor lokaal':'Open to local','Wat je hier vindt':'What you find here','LOKAAL, IN ÉÉN OVERZICHT':'LOCAL, IN ONE PLACE','WAAROM UITHOORN.ONLINE':'WHY UITHOORN.ONLINE','LOKALE AANBIEDERS':'LOCAL PROVIDERS','VOOR LOKALE ONDERNEMERS':'FOR LOCAL ENTREPRENEURS','Indiaas eten,':'Indian food,','lokaal ontdekt.':'discovered locally.','Ook hier zichtbaar worden?':'Want to be visible here too?','Dit gebeurt dichtbij.':'This happens nearby.','Een groeiende agenda voor Uithoorn en De Kwakel.':'A growing agenda for Uithoorn and De Kwakel.','Meer lokaal voordeel.':'More local value.','Promoties van ondernemers uit Uithoorn en De Kwakel, op één plek.':'Promotions from businesses in Uithoorn and De Kwakel, in one place.','Werk dichtbij huis.':'Work close to home.','Ontdek lokale vacatures en kansen van werkgevers in de buurt.':'Discover local jobs and opportunities from nearby employers.','Word onderdeel van lokaal.':'Become part of local.','Maak een account als klant of lokale aanbieder.':'Create an account as a customer or local provider.','Profiel':'Profile','Leads':'Leads','Promotie':'Promotion','Vindbaar met diensten, locatie en duidelijke informatie.':'Discoverable with services, location and clear information.','Ontvang relevante lokale aanvragen.':'Receive relevant local requests.','Maak aanbiedingen zichtbaar voor de buurt.':'Make offers visible to the neighbourhood.','Klus & onderhoud':'Handyman & maintenance','Elektricien & installatie':'Electrician & installation','Tuin & buiten':'Garden & outdoors','Andere lokale dienst':'Other local service','Schilder · klus · onderhoud':'Painter · handyman · maintenance','Schoonmaak · glazenwasser':'Cleaning · window cleaning','Elektricien · installatie':'Electrician · installation','South Indian · takeaway':'South Indian · takeaway','Schilderwerk, timmerwerk en property maintenance in Uithoorn.':'Painting, carpentry and property maintenance in Uithoorn.','Lokale hulp voor klussen en onderhoud in Uithoorn.':'Local help for handyman work and maintenance in Uithoorn.','Schoonmaak en glazenwasserij vanuit Uithoorn.':'Cleaning and window cleaning from Uithoorn.','Elektrische installaties en technische hulp in Uithoorn.':'Electrical installations and technical help in Uithoorn.','Werk met klei, leer handdraaien en maak je eigen keramiek.':'Work with clay, learn wheel throwing and make your own ceramics.','Creatieve cursussen voor beginners en gevorderden.':'Creative courses for beginners and advanced learners.','Leer sieraden maken onder begeleiding van professionele docenten.':'Learn to make jewellery with guidance from professional teachers.','Schilder keramiek met materialen, begeleiding en bakken inbegrepen.':'Paint ceramics with materials, guidance and firing included.','Lokaal evenement. Meer details en praktische informatie volgen binnenkort.':'Local event. More details and practical information will follow soon.'
};
const orderedKeys = Object.keys(translations).sort((a,b)=>b.length-a.length);
function translateText(value: string, locale: Locale) {
  if (locale === 'nl') return value;
  let result = value;
  for (const key of orderedKeys) if (result.includes(key)) result = result.split(key).join(translations[key]);
  return result.replace(/(\\d+) resultaten\\b/g, '$1 results').replace(/(\\d+) resultaat\\b/g, '$1 result');
}
function translateDom(locale: Locale) {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; let node: Node | null;
  while ((node = walker.nextNode())) nodes.push(node as Text);
  nodes.forEach(text => {
    if (!text.parentElement || ['SCRIPT','STYLE'].includes(text.parentElement.tagName)) return;
    const original = text.dataset.uoOriginal ?? text.nodeValue ?? '';
    text.dataset.uoOriginal = original;
    text.nodeValue = translateText(original, locale);
  });
  document.querySelectorAll<HTMLElement>('[placeholder],[aria-label],[title]').forEach(el => {
    for (const attr of ['placeholder','aria-label','title']) {
      const value = el.getAttribute(attr); if (!value) continue;
      const key = `data-uo-original-${attr}`;
      const original = el.getAttribute(key) ?? value;
      el.setAttribute(key, original); el.setAttribute(attr, translateText(original, locale));
    }
  });
}
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('nl');
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Locale | null) || 'nl';
    setLocale(saved);
    const observer = new MutationObserver(() => translateDom(saved));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.body.classList.toggle('locale-en', locale === 'en');
    localStorage.setItem(STORAGE_KEY, locale);
    document.cookie = `uithoorn-locale=${locale};path=/;max-age=31536000;samesite=lax`;
    translateDom(locale);
  }, [locale]);
  return <><div className="uo-locale-bar" aria-label="Language selector"><button className={locale === 'nl' ? 'active' : ''} onClick={() => setLocale('nl')} aria-label="Nederlands" title="Nederlands">🇳🇱 <span>NL</span></button><button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')} aria-label="English" title="English">🇬🇧 <span>EN</span></button></div>{children}</>;
}
