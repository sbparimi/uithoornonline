import type { Metadata } from 'next';
import DealsHub from '../../components/deals-hub';
import { localDeals } from '../../lib/discovery-data';

export const metadata: Metadata = { title: 'Aanbiedingen — Uithoorn.online', description: 'Ontdek lokale aanbiedingen en promoties in Uithoorn en De Kwakel.' };

export default function DealsPage() {
  return <DealsHub deals={localDeals} />;
}
