import type { Metadata } from 'next';
import EventsHub from '../../components/events-hub';
import { localEvents } from '../../lib/discovery-data';

export const metadata: Metadata = { title: 'Agenda — Uithoorn.online', description: 'Bekijk evenementen, activiteiten, lessen en initiatieven in Uithoorn en De Kwakel.' };

export default function EventsPage() {
  return <EventsHub events={localEvents} />;
}
