import 'server-only';
import { llmJson } from './llm';

// AI for the request flow for all jobs (docs/AI_REQUESTS.md), on the same provider client as the
// classifier (lib/urgent/llm.ts, owner's own keys). Two jobs:
//  1. followUpQuestions(): 2-4 short questions with tap-to-answer options, so a business can quote.
//  2. jobBrief(): a clean summary of the job for the business, plus an INDICATIVE price range only when
//     there is a sensible basis. Everything AI-written is labelled as such and never invents facts.
// Both fall back to rules when no AI answers, so the flow always works.

export type Lang = 'nl' | 'en';
export type Question = { q: string; options: string[] };
export type Answer = { q: string; a: string };
export type JobBrief = {
  summary: string;
  facts: [string, string][];
  ask: string[];
  price: { min: number; max: number; unit: 'total' | 'hour'; basis: string } | null;
  source: 'ai' | 'rules';
  provider?: string;
  generatedAt: string;
};

const L = (lang: Lang, nl: string, en: string) => (lang === 'en' ? en : nl);
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// ---------- follow-up questions ----------
const SIZE: Record<Lang, Question> = {
  nl: { q: 'Hoe groot is de klus ongeveer?', options: ['Klein (een paar uur)', 'Middel (1–2 dagen)', 'Groot (meerdere dagen)', 'Weet ik niet'] },
  en: { q: 'Roughly how big is the job?', options: ['Small (a few hours)', 'Medium (1–2 days)', 'Large (several days)', "Don't know"] },
};
const BUDGET: Record<Lang, Question> = {
  nl: { q: 'Heb je een budget in gedachten?', options: ['Tot €250', '€250–€1.000', '€1.000–€5.000', 'Meer dan €5.000', 'Nog geen idee'] },
  en: { q: 'Do you have a budget in mind?', options: ['Up to €250', '€250–€1,000', '€1,000–€5,000', 'More than €5,000', 'No idea yet'] },
};
const WHEN: Record<Lang, Question> = {
  nl: { q: 'Wanneer moet het klaar zijn?', options: ['Zo snel mogelijk', 'Binnen 2 weken', 'Binnen een maand', 'Flexibel'] },
  en: { q: 'When should it be done?', options: ['As soon as possible', 'Within 2 weeks', 'Within a month', 'Flexible'] },
};
const SPECIFIC: Record<string, Record<Lang, Question>> = {
  'Home improvement & renovation': { nl: { q: 'Om welke ruimte gaat het, en hoeveel m² ongeveer?', options: ['Badkamer', 'Keuken', 'Woonkamer', 'Hele woning', 'Buitengevel'] }, en: { q: 'Which room is it, and roughly how many m²?', options: ['Bathroom', 'Kitchen', 'Living room', 'Whole house', 'Exterior'] } },
  'Garden & outdoor': { nl: { q: 'Hoe groot is de tuin ongeveer?', options: ['Kleiner dan 50 m²', '50–150 m²', 'Groter dan 150 m²'] }, en: { q: 'Roughly how big is the garden?', options: ['Under 50 m²', '50–150 m²', 'Over 150 m²'] } },
  'Cleaning & household': { nl: { q: 'Hoe vaak wil je hulp?', options: ['Eenmalig', 'Elke week', 'Om de week', 'Maandelijks'] }, en: { q: 'How often do you need help?', options: ['One-off', 'Weekly', 'Every two weeks', 'Monthly'] } },
  'Transport & logistics': { nl: { q: 'Hoeveel moet er mee?', options: ['Een paar spullen', '1–2 kamers', 'Hele woning'] }, en: { q: 'How much needs to be moved?', options: ['A few items', '1–2 rooms', 'Whole home'] } },
  Childcare: { nl: { q: 'Voor hoeveel kinderen, en hoe oud zijn ze?', options: ['1 kind, 0–4 jaar', '1 kind, 4–12 jaar', '2 of meer kinderen'] }, en: { q: 'How many children, and how old?', options: ['1 child, 0–4', '1 child, 4–12', '2 or more children'] } },
  'Lessons & tutoring': { nl: { q: 'Welk vak of niveau?', options: ['Basisschool', 'Middelbare school', 'Volwassene', 'Rijles', 'Muziek'] }, en: { q: 'Which subject or level?', options: ['Primary school', 'Secondary school', 'Adult', 'Driving', 'Music'] } },
  Pets: { nl: { q: 'Om welk dier gaat het?', options: ['Hond', 'Kat', 'Konijn / knaagdier', 'Anders'] }, en: { q: 'Which animal is it?', options: ['Dog', 'Cat', 'Rabbit / rodent', 'Other'] } },
  'Events & occasions': { nl: { q: 'Voor hoeveel gasten?', options: ['Tot 20', '20–50', '50–100', 'Meer dan 100'] }, en: { q: 'How many guests?', options: ['Up to 20', '20–50', '50–100', 'More than 100'] } },
  'Food & catering': { nl: { q: 'Voor hoeveel personen?', options: ['Tot 10', '10–30', '30–100', 'Meer dan 100'] }, en: { q: 'For how many people?', options: ['Up to 10', '10–30', '30–100', 'More than 100'] } },
  Automotive: { nl: { q: 'Om wat voor voertuig gaat het?', options: ['Auto', 'Bestelbus', 'Fiets / e-bike', 'Scooter'] }, en: { q: 'What kind of vehicle?', options: ['Car', 'Van', 'Bike / e-bike', 'Scooter'] } },
};
// No budget question where it reads as odd or sensitive.
const NO_BUDGET = new Set(['Care & health', 'Family & personal', 'Legal advice', 'Childcare']);

export function rulesQuestions(category: string, level: string, lang: Lang): Question[] {
  const out: Question[] = [];
  if (SPECIFIC[category]) out.push(SPECIFIC[category][lang]);
  out.push(SIZE[lang]);
  if (level === 'flexible' || level === 'week') out.push(WHEN[lang]);
  if (!NO_BUDGET.has(category)) out.push(BUDGET[lang]);
  return out.slice(0, 4);
}

function questionPrompt(lang: Lang) {
  return [
    'You are the request assistant of Uithoorn.online, a local marketplace for Uithoorn and De Kwakel (Netherlands).',
    'A resident asked for help with a non-urgent job. Ask the 2 to 4 most useful SHORT follow-up questions a local business needs to give a good quote',
    '(for example: size or quantity, which room or object, current state or material, preferred timing, budget range). Skip anything the description already answers.',
    'Never ask for name, address, postcode, phone, email or photos (asked separately). No yes/no questions when a choice list fits better.',
    `Write in ${lang === 'en' ? 'English' : 'Dutch (informal "je")'}. Every question max 90 characters, with 2 to 5 short answer options (max 30 characters each) the resident can tap.`,
    'Answer options must be realistic for this kind of job in the Netherlands (for a budget question use euro ranges that fit the job, e.g. a bathroom renovation starts around €5,000; include a "weet ik niet"/"no idea" option).',
    'Reply with ONE JSON object only: {"questions":[{"q":"...","options":["...","..."]}]}',
  ].join('\n');
}

export async function followUpQuestions(input: { description: string; category: string; categoryLabel: string; level: string; lang: Lang }): Promise<{ questions: Question[]; source: 'ai' | 'rules'; provider?: string }> {
  const rules = rulesQuestions(input.category, input.level, input.lang);
  const res = await llmJson(questionPrompt(input.lang), `Category: ${input.categoryLabel}\nTiming chosen: ${input.level}\nDescription: ${input.description.slice(0, 1500)}`, { maxTokens: 900, timeoutMs: 12000 });
  const raw = Array.isArray(res?.data?.questions) ? (res!.data.questions as unknown[]) : [];
  const questions: Question[] = [];
  for (const item of raw) {
    const o = item as { q?: unknown; options?: unknown };
    const q = clean(o?.q, 120);
    if (!q || /postcode|adres|address|telefoon|phone|e-?mail|foto|photo/i.test(q)) continue;
    const options = (Array.isArray(o.options) ? o.options : []).map((x) => clean(x, 40)).filter(Boolean).slice(0, 5);
    questions.push({ q, options });
    if (questions.length === 4) break;
  }
  if (questions.length < 2) return { questions: rules, source: 'rules' };
  return { questions, source: 'ai', provider: res!.provider };
}

/** Cleans answers sent by the browser: at most 4, short, question text kept for the business. */
export function cleanAnswers(v: unknown): Answer[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 4).map((x) => ({ q: clean((x as Answer)?.q, 140), a: clean((x as Answer)?.a, 300) })).filter((x) => x.q && x.a);
}

// ---------- job brief for the business ----------
// Indicative prices only where a market rate makes sense and the job is not sensitive or urgent.
const NO_PRICE = new Set(['Legal advice', 'Care & health', 'Family & personal', 'Financial & administration', 'Professional services']);

function briefPrompt(lang: Lang, allowPrice: boolean) {
  return [
    'You write a job brief for a local business on Uithoorn.online (Uithoorn / De Kwakel, Netherlands), so it can answer a resident with a quote in one minute.',
    'Use ONLY the facts given. Never invent facts, sizes, brands or dates. If something important is unknown, list it under "ask".',
    `Write in ${lang === 'en' ? 'English' : 'Dutch'}. Reply with ONE JSON object only:`,
    '{"summary":"2-3 short sentences naming every piece of work the resident asked for, plus where (postcode area) and when","facts":[["label","value"]] (max 6, only from the resident\'s answers and description; do NOT repeat category, postcode or timing),"ask":["max 3 short questions the business should still ask"],',
    allowPrice
      ? '"price": null OR {"min":number,"max":number,"unit":"total"|"hour","basis":"one short sentence why"} in euros incl. VAT, typical Dutch market rates in 2026 for labour plus materials. Base it ONLY on the work described, NEVER on the customer\'s budget (if their budget looks too low, the range must still be the market range). Give a price ONLY when the size/quantity is known well enough for a professional to give a ballpark; otherwise null. Not wider than 3x.}'
      : '"price": null}',
  ].join('\n');
}

export type BriefInput = { category: string; categoryLabel: string; description: string; answers: Answer[]; postcode: string; level: string; photos: number; lang: Lang };

export function rulesBrief(i: BriefInput): JobBrief {
  const facts: [string, string][] = i.answers.slice(0, 6).map((a) => [a.q.replace(/\?$/, ''), a.a]);
  return {
    summary: `${i.categoryLabel} · ${i.postcode.slice(0, 4)}. ${i.description.replace(/\s+/g, ' ').trim().slice(0, 300)}`,
    facts, ask: [], price: null, source: 'rules', generatedAt: new Date().toISOString(),
  };
}

export async function jobBrief(i: BriefInput): Promise<JobBrief> {
  const allowPrice = !NO_PRICE.has(i.category) && i.level !== 'spoed';
  const user = [
    `Category: ${i.categoryLabel}`, `Postcode area: ${i.postcode.slice(0, 4)} (Uithoorn e.o.)`, `Timing: ${i.level}`, `Photos attached: ${i.photos}`,
    `Description: ${i.description.slice(0, 1500)}`, ...i.answers.map((a) => `Q: ${a.q}\nA: ${a.a}`),
  ].join('\n');
  const res = await llmJson(briefPrompt(i.lang, allowPrice), user, { maxTokens: 1200, timeoutMs: 15000 });
  if (!res) return rulesBrief(i);
  const d = res.data;
  const summary = clean(d.summary, 500);
  if (!summary) return rulesBrief(i);
  const dup = /categor|postcode|gebied|area|timing|wanneer|tijdstip|when|urgent/i; // already shown above the brief
  const facts = (Array.isArray(d.facts) ? d.facts : []).map((f) => (Array.isArray(f) ? [clean(f[0], 60), clean(f[1], 160)] : ['', ''])).filter(([k, v]) => k && v && !dup.test(k)).slice(0, 6) as [string, string][];
  const ask = (Array.isArray(d.ask) ? d.ask : []).map((x) => clean(x, 140)).filter(Boolean).slice(0, 3);
  let price: JobBrief['price'] = null;
  const p = d.price as { min?: unknown; max?: unknown; unit?: unknown; basis?: unknown } | null;
  if (allowPrice && p && typeof p === 'object') {
    const min = Math.round(Number(p.min)); const max = Math.round(Number(p.max));
    const unit = p.unit === 'hour' ? 'hour' : 'total';
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min && max <= min * 4 && max < 250000) price = { min, max, unit, basis: clean(p.basis, 200) };
  }
  return { summary, facts: facts.length ? facts : rulesBrief(i).facts, ask, price, source: 'ai', provider: res.provider, generatedAt: new Date().toISOString() };
}

export const priceText = (lang: Lang, p: NonNullable<JobBrief['price']>) => {
  const f = (n: number) => `€${n.toLocaleString(lang === 'en' ? 'en-GB' : 'nl-NL')}`;
  return `${f(p.min)}–${f(p.max)}${p.unit === 'hour' ? L(lang, ' per uur', ' per hour') : ''}`;
};
