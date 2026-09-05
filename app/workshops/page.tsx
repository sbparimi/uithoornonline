import type { Metadata } from 'next';
import { DiscoveryDirectory } from '../../components/discovery-directory';
import { workshops } from '../../data';

export const metadata: Metadata = { title: 'Workshops — Uithoorn.online', description: 'Ontdek workshops en creatieve cursussen in Uithoorn en De Kwakel.' };

export default function WorkshopsPage() {
  return <DiscoveryDirectory eyebrow="Workshops & cursussen" title="Leer iets nieuws. Maak iets zelf." intro="Ontdek keramiek, kunst, edelsmeden en andere creatieve workshops in Uithoorn en De Kwakel." items={workshops.map((w) => ({ title: w.title, meta: w.meta, description: w.description, label: w.provider }))} cta="Word aanbieder" />;
}
