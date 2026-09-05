import type { Metadata } from 'next';
import { DiscoveryDirectory } from '../../components/discovery-directory';
import { businesses } from '../../data';

export const metadata: Metadata = { title: 'Diensten — Uithoorn.online', description: 'Vind praktische lokale hulp en professionals in Uithoorn en De Kwakel.' };

export default function ServicesPage() {
  const items = businesses.filter((b) => b.name !== 'SpiceIndia').map((b) => ({ title: b.name, meta: b.type, description: b.desc, label: 'Dienst' }));
  return <DiscoveryDirectory eyebrow="Lokale diensten" title="Hulp nodig? Vraag het lokaal." intro="Van onderhoud en reparatie tot praktische hulp: begin met lokaal zoeken." items={items} cta="Plaats je bedrijf" />;
}
