import type { Metadata } from 'next';
import { DirectoryPage } from '../../components/directory-page';
import { jobs } from '../../data';
export const metadata: Metadata = { title: 'Lokale banen — Uithoorn.online', description: 'Ontdek banen en werkgelegenheid dichtbij huis in Uithoorn en De Kwakel.' };
export default function JobsPage() { return <DirectoryPage eyebrow="Werk & kansen" title="Werk dichtbij huis." intro="Ontdek lokale vacatures en kansen van werkgevers in de buurt." items={jobs.map((j) => ({ title: j.title, meta: j.meta, description: j.description, label: 'Vacature' }))} cta="Plaats vacature" />; }
