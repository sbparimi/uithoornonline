// Opening hours: one small shape shared by the business page, the profile editor and the directory's
// "Nu open" filter. Pure TypeScript (no server-only imports), times are Europe/Amsterdam.
//   { mon: [["09:00","17:30"]], tue: [], ..., note?: "Op afspraak" }
//   [] = closed that day · missing day = unknown · a range that ends before it starts runs past midnight.

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];
export type Range = [string, string];
export type OpeningHours = Partial<Record<Day, Range[]>> & { note?: string };

export const DAY_LABELS: Record<'nl' | 'en', Record<Day, string>> = {
  nl: { mon: 'Maandag', tue: 'Dinsdag', wed: 'Woensdag', thu: 'Donderdag', fri: 'Vrijdag', sat: 'Zaterdag', sun: 'Zondag' },
  en: { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' },
};

const TIME = /^([01]?\d|2[0-4]):([0-5]\d)$/;
export function normTime(v: unknown): string | null {
  const m = String(v ?? '').trim().replace('.', ':').match(TIME);
  if (!m) return null;
  const h = Number(m[1]);
  if (h === 24 && m[2] !== '00') return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Validates/normalises anything (DB jsonb, a form, an AI answer) into OpeningHours, or null when empty. */
export function cleanHours(raw: unknown): OpeningHours | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: OpeningHours = {};
  let any = false;
  for (const d of DAYS) {
    const v = src[d];
    if (v === undefined || v === null) continue;
    if (!Array.isArray(v)) continue;
    const ranges: Range[] = [];
    for (const r of v.slice(0, 3)) {
      if (!Array.isArray(r) || r.length !== 2) continue;
      const a = normTime(r[0]), b = normTime(r[1]);
      if (a && b && a !== b) ranges.push([a, b]);
    }
    out[d] = ranges; any = true;
  }
  const note = typeof src.note === 'string' ? src.note.trim().slice(0, 160) : '';
  if (note) { out.note = note; any = true; }
  return any ? out : null;
}

export function hasAnyHours(h: OpeningHours | null | undefined): boolean {
  return !!h && DAYS.some((d) => Array.isArray(h[d]));
}

/** Weekday + minutes since midnight right now in Amsterdam. */
export function amsterdamNow(at: Date = new Date()): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const wd = (parts.find((p) => p.type === 'weekday')?.value || 'Mon').toLowerCase().slice(0, 3) as Day;
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0), m = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return { day: DAYS.includes(wd) ? wd : 'mon', minutes: h * 60 + m };
}

/** true = open now, false = closed now, null = unknown (no hours for today/yesterday-overnight). */
export function isOpenNow(h: OpeningHours | null | undefined, at: Date = new Date()): boolean | null {
  if (!hasAnyHours(h)) return null;
  const { day, minutes } = amsterdamNow(at);
  const today = h![day];
  const prev = h![DAYS[(DAYS.indexOf(day) + 6) % 7]];
  // Yesterday's range that runs past midnight.
  if (Array.isArray(prev)) for (const [a, b] of prev) if (mins(b) < mins(a) && minutes < mins(b)) return true;
  if (!Array.isArray(today)) return null;
  for (const [a, b] of today) {
    const s = mins(a), e = b === '24:00' ? 1440 : mins(b);
    if (e > s ? minutes >= s && minutes < e : minutes >= s) return true;
  }
  return false;
}

export function formatDay(ranges: Range[] | undefined, lang: 'nl' | 'en'): string {
  if (!Array.isArray(ranges)) return lang === 'en' ? 'Unknown' : 'Onbekend';
  if (!ranges.length) return lang === 'en' ? 'Closed' : 'Gesloten';
  return ranges.map(([a, b]) => `${a} – ${b}`).join(', ');
}
