import { Briefcase, Car, GraduationCap, Hammer, HeartPulse, LayoutGrid, PartyPopper, Scissors, ShoppingBag, UtensilsCrossed, type LucideProps } from 'lucide-react';
import type { IconName } from '../../lib/directory/taxonomy';

const ICONS = { hammer: Hammer, utensils: UtensilsCrossed, heart: HeartPulse, scissors: Scissors, briefcase: Briefcase, car: Car, graduation: GraduationCap, bag: ShoppingBag, party: PartyPopper, grid: LayoutGrid } as const;

export function SectionIcon({ name, ...props }: { name: IconName } & LucideProps) {
  const Icon = ICONS[name] ?? LayoutGrid;
  return <Icon aria-hidden="true" {...props} />;
}
