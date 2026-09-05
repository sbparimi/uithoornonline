import type { Metadata } from 'next';
import { DirectoryPage } from '../../components/directory-page';
import { events } from '../../data';
export const metadata: Metadata = { title: 'Agenda — Uithoorn.online', description: 'Bekijk wat er vandaag en binnenkort gebeurt in Uithoorn en De Kwakel.' };
export default function EventsPage() { return <DirectoryPage eyebrow="Lokale agenda" title="Dit gebeurt dichtbij." intro="Een groeiende agenda voor Uithoorn en De Kwakel." items={events.map(([title, meta]) => ({ title, meta, description: 'Lokaal evenement. Meer details en praktische informatie volgen binnenkort.', label: 'Agenda' }))} />; }
