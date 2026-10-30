import { Gift } from 'lucide-react';
import '../app/growth.css';

// "First leads free" notice (business signup + dashboard). Copy only: the number comes from
// FIRST_LEADS_FREE (e.g. 10); unset = wording without a number. Pricing itself is unchanged.
export function firstLeadsFreeCount(): number | null {
  const n = Number.parseInt(process.env.FIRST_LEADS_FREE || '', 10);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
}

const copy = (lang: 'nl' | 'en', n: number | null) => lang === 'en'
  ? { title: n ? `Your first ${n} requests are free` : 'Your first requests are free', text: 'See what Uithoorn.online brings you first, without paying anything.' }
  : { title: n ? `Je eerste ${n} aanvragen zijn gratis` : 'Je eerste aanvragen zijn gratis', text: 'Zie eerst wat Uithoorn.online je oplevert, zonder iets te betalen.' };

export function FirstLeadsFree({ lang, compact = false }: { lang: 'nl' | 'en'; compact?: boolean }) {
  const c = copy(lang, firstLeadsFreeCount());
  return (
    <div className={`first-leads-free${compact ? ' is-compact' : ''}`} role="note">
      <Gift aria-hidden="true" />
      <div><strong>{c.title}</strong><span>{c.text}</span></div>
    </div>
  );
}
