export type LocalEvent = {
  slug: string;
  title: string;
  dateLabel: string;
  dateSort: string;
  place: string;
  type: 'event' | 'activity' | 'workshop';
  description: string;
};

export const localEvents: LocalEvent[] = [
  { slug: 'kermis-de-kwakel', title: 'Kermis De Kwakel', dateLabel: '4–8 september 2026', dateSort: '2026-09-08', place: 'De Kwakel', type: 'event', description: 'Lokale kermis in De Kwakel.' },
  { slug: 'open-monumentendag', title: 'Open Monumentendag', dateLabel: '12 september 2026', dateSort: '2026-09-12', place: 'Uithoorn', type: 'event', description: 'Ontdek lokale monumenten en bijzondere plekken tijdens Open Monumentendag.' },
  { slug: 'kunst-in-de-kwakel', title: 'Kunst in De Kwakel', dateLabel: '24–25 oktober 2026', dateSort: '2026-10-24', place: 'De Kwakel', type: 'event', description: 'Lokale kunst en creatieve makers in De Kwakel.' },
  { slug: 'keramiek-handdraaien', title: 'Keramiek & handdraaien', dateLabel: 'Vanaf 14 september 2026', dateSort: '2026-09-14', place: 'Fort aan de Drecht', type: 'workshop', description: 'Werk met klei, leer handdraaien en maak je eigen keramiek.' },
  { slug: 'tekenen-schilderen', title: 'Tekenen & schilderen', dateLabel: 'Vanaf 7 september 2026', dateSort: '2026-09-07', place: 'Uithoorn', type: 'workshop', description: 'Creatieve cursussen voor beginners en gevorderden.' },
  { slug: 'edelsmeden', title: 'Edelsmeden', dateLabel: 'Vanaf 7 september 2026', dateSort: '2026-09-07', place: 'Uithoorn', type: 'workshop', description: 'Leer sieraden maken onder begeleiding van professionele docenten.' },
  { slug: 'keramiek-schilderen-pop-up', title: 'Keramiek schilderen pop-up', dateLabel: 'Op aanvraag', dateSort: '2026-12-31', place: 'Uithoorn', type: 'activity', description: 'Schilder keramiek met materialen, begeleiding en bakken inbegrepen.' },
];

export const localDeals: Array<{ slug: string; title: string; label: string; description: string }> = [];

export function getEvent(slug: string) {
  return localEvents.find((event) => event.slug === slug);
}
