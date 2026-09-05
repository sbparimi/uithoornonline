import type { Metadata } from 'next';
import { DiscoveryDirectory } from '../../components/discovery-directory';
import { businesses } from '../../data';

export const metadata: Metadata = { title: 'Lokale aanbieders — Uithoorn.online', description: 'Vind lokale ondernemers en diensten in Uithoorn en De Kwakel.' };

export default function BusinessesPage() {
  return <DiscoveryDirectory eyebrow="Lokale aanbieders" title="Vind iemand dichtbij." intro="Lokale professionals voor praktische hulp, onderhoud en techniek in Uithoorn en De Kwakel." items={businesses.filter((b) => b.name !== 'SpiceIndia').map((b) => ({ title: b.name, meta: b.type, description: b.desc, label: 'Dienst' }))} cta="Word zichtbaar" />;
}
