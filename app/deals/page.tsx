import type { Metadata } from 'next';
import { DirectoryPage } from '../../components/directory-page';
import { deals } from '../../data';
export const metadata: Metadata = { title: 'Aanbiedingen — Uithoorn.online', description: 'Ontdek lokale aanbiedingen en promoties in Uithoorn en De Kwakel.' };
export default function DealsPage() { return <DirectoryPage eyebrow="Lokaal voordeel" title="Meer lokaal voordeel." intro="Promoties van ondernemers uit Uithoorn en De Kwakel, op één plek." items={deals.map((d) => ({ title: d.title, meta: d.meta, description: d.description, label: 'Aanbieding' }))} />; }
