import type { Metadata } from 'next';
import { DirectoryPage } from '../../components/directory-page';
import { businesses } from '../../data';
export const metadata: Metadata = { title: 'Lokale bedrijven — Uithoorn.online', description: 'Ontdek lokale bedrijven en ondernemers in Uithoorn en De Kwakel.' };
export default function BusinessesPage() { return <DirectoryPage eyebrow="Lokale bedrijvengids" title="Vind een bedrijf dichtbij." intro="Ontdek lokale ondernemers en diensten in Uithoorn en De Kwakel." items={businesses.map((b) => ({ title: b.name, meta: b.type, description: b.desc, label: b.tag }))} cta="Plaats een aanvraag" />; }
