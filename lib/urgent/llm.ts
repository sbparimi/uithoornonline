import 'server-only';
import { REQUEST_CATEGORIES } from '../request-options';

// Provider-agnostic intake brain. classifyIntake() asks an LLM (when a key is configured) and always
// falls back to the rule-based classifier below, so the intake works with no AI at all.
//
// Providers, picked by INTAKE_LLM_PROVIDER or by whichever key exists (in this order):
//   groq      GROQ_API_KEY                         (OpenAI-compatible, https://api.groq.com/openai/v1)
//   kimi      KIMI_API_KEY + KIMI_BASE_URL (+KIMI_MODEL)  (OpenAI-compatible)
//   openai    OPENAI_API_KEY
//   anthropic ANTHROPIC_API_KEY
// INTAKE_LLM_MODEL overrides the model name. INTAKE_LLM_PROVIDER=none forces the rules.

export type UrgencyLevel = 'spoed' | 'today' | 'week' | 'flexible';
export type Classification = {
  category: string; urgency: UrgencyLevel; summary: string; tip: string | null; followUp: string | null;
  source: 'ai' | 'rules'; provider?: string;
  /** Why the AI was not used (previews only, never in production responses). */
  debug?: string;
};

type Provider = { name: string; kind: 'openai' | 'anthropic'; baseUrl: string; key: string; model: string };

function configured(): Record<string, Provider | null> {
  const model = process.env.INTAKE_LLM_MODEL;
  return {
    groq: process.env.GROQ_API_KEY ? { name: 'groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', key: process.env.GROQ_API_KEY, model: model || 'llama-3.3-70b-versatile' } : null,
    kimi: process.env.KIMI_API_KEY && process.env.KIMI_BASE_URL ? { name: 'kimi', kind: 'openai', baseUrl: process.env.KIMI_BASE_URL.replace(/\/$/, ''), key: process.env.KIMI_API_KEY, model: model || process.env.KIMI_MODEL || 'moonshot-v1-8k' } : null,
    openai: process.env.OPENAI_API_KEY ? { name: 'openai', kind: 'openai', baseUrl: 'https://api.openai.com/v1', key: process.env.OPENAI_API_KEY, model: model || 'gpt-4o-mini' } : null,
    anthropic: process.env.ANTHROPIC_API_KEY ? { name: 'anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', key: process.env.ANTHROPIC_API_KEY, model: model || 'claude-3-5-haiku-latest' } : null,
  };
}

/** Every configured provider in the order they are tried (INTAKE_LLM_PROVIDER pins one; "none" = rules only). */
export function llmProviders(): Provider[] {
  const forced = (process.env.INTAKE_LLM_PROVIDER || '').toLowerCase();
  if (forced === 'none') return [];
  const all = configured();
  if (forced && forced in all) return all[forced] ? [all[forced]!] : [];
  return ['groq', 'kimi', 'openai', 'anthropic'].map((k) => all[k]).filter((p): p is Provider => Boolean(p));
}

export function llmProvider(): Provider | null {
  return llmProviders()[0] ?? null;
}

// ---------- rule-based fallback ----------
const RULES: [RegExp, string][] = [
  [/lek|lekkage|water ?schade|verstop|riool|wc|toilet|kraan|afvoer|leiding|cv|ketel|verwarming|boiler|geiser|douche|plumb|leak|drain|pipe|heating/i, 'Plumber'],
  [/stroom|kortsluiting|stopcontact|groep|meterkast|aardlek|elektr|lamp|bedrading|zekering|power|electric|socket|fuse/i, 'Electrician & installation'],
  [/buitengesloten|slot|sleutel|inbraak|alarm|camera|beveilig|deur.*(dicht|open)|locked out|lock|burglar|security/i, 'Security & alarm systems'],
  [/tuin|gras|heg|boom|bestrating|schutting|hovenier|garden|lawn|hedge|tree|fence/i, 'Garden & outdoor'],
  [/schoonma|poets|ramen|glazenwas|clean|window/i, 'Cleaning & household'],
  [/verhuis|transport|bezorg|koerier|move|moving|delivery/i, 'Transport & logistics'],
  [/schilder|verbouw|renov|badkamer|keuken|vloer|tegel|stuc|dak|bouw|paint|renovat|roof|floor|tile/i, 'Home improvement & renovation'],
  [/klus|monteer|ophang|repar|kast|handyman|mount|assemble|repair/i, 'Handyman'],
  [/computer|laptop|wifi|internet|printer|netwerk|telefoon instell|it|virus/i, 'Computer & IT help'],
  [/auto|garage|band|apk|fiets|car|tyre|tire|bike/i, 'Automotive'],
  [/kapper|haar|nagel|beauty|hair|nails/i, 'Hair & beauty'],
  [/oppas|kinderopvang|gastouder|babysit|childcare/i, 'Childcare'],
  [/hond|kat|dier|huisdier|dog|cat|pet/i, 'Pets'],
  [/zorg|verpleeg|thuiszorg|fysio|care|nurse/i, 'Care & health'],
  [/bijles|les |huiswerk|tutor|lesson/i, 'Lessons & tutoring'],
  [/foto|video|photo/i, 'Photography & video'],
  [/feest|evenement|event|party|catering|eten|food/i, 'Events & occasions'],
  [/boekhoud|belasting|administratie|tax|accounting/i, 'Financial & administration'],
  [/advocaat|jurid|notaris|legal|lawyer/i, 'Legal advice'],
];
const SPOED = /spoed|nood|direct|meteen|nu |nu$|acuut|lekt|lekkage|overstroom|onder water|geen stroom|kortsluiting|brand|rook|gaslucht|gas ruik|buitengesloten|ingebroken|inbraak|verstopt|geen verwarming|geen warm water|urgent|emergency|asap|right now|flood|locked out|no power|burst/i;
const TODAY = /vandaag|vanavond|vanmiddag|vannacht|today|tonight|this evening/i;
const WEEK = /deze week|morgen|overmorgen|this week|tomorrow|binnen een paar dagen/i;

const TIPS: Record<string, [string, string]> = {
  Plumber: ['Tip: draai de hoofdkraan dicht (meestal bij de watermeter) en zet emmers/handdoeken neer.', 'Tip: close the main water valve (usually near the water meter) and put down buckets/towels.'],
  'Electrician & installation': ['Tip: raak niets aan dat nat of warm is. Zet de betreffende groep in de meterkast uit. Ruik je brand of zie je rook? Bel 112.', "Tip: don't touch anything wet or hot. Switch off that group in the fuse box. Smell burning or see smoke? Call 112."],
  'Security & alarm systems': ['Tip: is er net ingebroken? Raak zo min mogelijk aan en bel bij gevaar 112 (geen spoed: 0900-8844).', 'Tip: just had a break-in? Touch as little as possible; in danger call 112 (non-urgent police: 0900-8844).'],
};

export function classifyByRules(text: string, lang: 'nl' | 'en' = 'nl'): Classification {
  const t = ` ${text.toLowerCase()} `;
  const category = RULES.find(([re]) => re.test(t))?.[1] ?? 'Handyman';
  const urgency: UrgencyLevel = SPOED.test(t) ? 'spoed' : TODAY.test(t) ? 'today' : WEEK.test(t) ? 'week' : 'flexible';
  const tip = urgency === 'spoed' && TIPS[category] ? TIPS[category][lang === 'en' ? 1 : 0] : null;
  return { category, urgency, summary: text.trim().replace(/\s+/g, ' ').slice(0, 200), tip, followUp: null, source: 'rules' };
}

// ---------- LLM ----------
function prompt(lang: 'nl' | 'en') {
  return [
    'You are the intake assistant of Uithoorn.online, a local marketplace for Uithoorn and De Kwakel (Netherlands).',
    'A resident describes a problem. Classify it. Reply with ONE JSON object only, no prose, with keys:',
    `"category": exactly one of ${JSON.stringify(REQUEST_CATEGORIES)};`,
    '"urgency": "spoed" (needs help right now: leaks, flooding, no power, no heating in winter, locked out, break-in, blocked toilet), "today", "week" or "flexible";',
    `"summary": one short sentence in ${lang === 'en' ? 'English' : 'Dutch'} that a tradesperson understands;`,
    `"tip": for spoed only, one short safety tip in ${lang === 'en' ? 'English' : 'Dutch'} (mention 112 if there is danger), else null;`,
    `"followUp": null, or ONE short question in ${lang === 'en' ? 'English' : 'Dutch'} if a key detail is missing (e.g. which room, how bad), else null.`,
    'Never invent facts. Never give prices.',
  ].join('\n');
}

// When a provider no longer serves the configured model (404), ask its /models list once and use the
// best chat model it offers (OpenAI-compatible providers only). Cached per server instance.
const discovered = new Map<string, string>();
const PREFER = ['gpt-oss-120b', 'llama-3.3-70b', 'llama-4-maverick', 'llama-4-scout', 'kimi-k2', 'qwen3', 'qwen', 'gpt-oss-20b', 'llama-3.1-8b', 'moonshot', 'gpt-4o-mini'];
async function discoverModel(p: Provider): Promise<string | null> {
  if (discovered.has(p.name)) return discovered.get(p.name)!;
  try {
    const r = await fetch(`${p.baseUrl}/models`, { headers: { Authorization: `Bearer ${p.key}` }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const ids: string[] = ((await r.json())?.data ?? []).map((m: { id?: string }) => String(m.id ?? '')).filter((id: string) => id && !/whisper|tts|guard|embed|vision-only|playai|distil/i.test(id));
    const pick = PREFER.map((want) => ids.find((id) => id.toLowerCase().includes(want))).find(Boolean) ?? ids[0] ?? null;
    if (pick) discovered.set(p.name, pick);
    return pick;
  } catch { return null; }
}

async function callLlm(p0: Provider, system: string, user: string, timeoutMs: number): Promise<string> {
  try { return await callOnce({ ...p0, model: discovered.get(p0.name) ?? p0.model }, system, user, timeoutMs); }
  catch (e) {
    if (p0.kind !== 'openai' || !/ 404$| 400$/.test(e instanceof Error ? e.message : '')) throw e;
    const model = await discoverModel(p0);
    if (!model || model === p0.model) throw e;
    return callOnce({ ...p0, model }, system, user, timeoutMs);
  }
}

async function callOnce(p: Provider, system: string, user: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (p.kind === 'anthropic') {
      const r = await fetch(`${p.baseUrl}/messages`, { method: 'POST', signal: ctrl.signal, headers: { 'x-api-key': p.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: p.model, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }) });
      if (!r.ok) throw new Error(`${p.name} ${r.status}`);
      const j = await r.json();
      return String(j?.content?.[0]?.text ?? '');
    }
    const r = await fetch(`${p.baseUrl}/chat/completions`, { method: 'POST', signal: ctrl.signal, headers: { Authorization: `Bearer ${p.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: p.model, temperature: 0.1, max_tokens: 400, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!r.ok) throw new Error(`${p.name} ${r.status}`);
    const j = await r.json();
    return String(j?.choices?.[0]?.message?.content ?? '');
  } finally { clearTimeout(timer); }
}

function parseJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const v = JSON.parse(m[0]); return v && typeof v === 'object' ? v as Record<string, unknown> : null; } catch { return null; }
}

const LEVELS: UrgencyLevel[] = ['spoed', 'today', 'week', 'flexible'];
const debug = (provider: string, why: string) => (process.env.VERCEL_ENV === 'production' ? {} : { debug: `${provider}: ${why.slice(0, 160)}` });

export async function classifyIntake(text: string, lang: 'nl' | 'en' = 'nl'): Promise<Classification> {
  const rules = classifyByRules(text, lang);
  const providers = llmProviders();
  if (!providers.length) return { ...rules, ...(process.env.VERCEL_ENV === 'production' ? {} : { debug: 'no LLM key in this environment' }) };
  const errors: string[] = [];
  for (const p of providers) {
    const r = await classifyWith(p, text, lang, rules);
    if ('category' in r) return r;
    errors.push(`${p.name}: ${r.error}`);
  }
  return { ...rules, ...debug('ai', errors.join('; ')) };
}

async function classifyWith(p: Provider, text: string, lang: 'nl' | 'en', rules: Classification): Promise<Classification | { error: string }> {
  try {
    const out = parseJson(await callLlm(p, prompt(lang), text.slice(0, 2000), 8000));
    if (!out) return { error: 'unparseable answer' };
    const category = REQUEST_CATEGORIES.includes(String(out.category)) ? String(out.category) : rules.category;
    const urgency = LEVELS.includes(out.urgency as UrgencyLevel) ? out.urgency as UrgencyLevel : rules.urgency;
    const s = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.trim().toLowerCase() !== 'null' ? v.trim().slice(0, max) : null);
    return { category, urgency, summary: s(out.summary, 240) ?? rules.summary, tip: urgency === 'spoed' ? (s(out.tip, 240) ?? rules.tip) : null, followUp: s(out.followUp, 200), source: 'ai', provider: `${p.name}/${discovered.get(p.name) ?? p.model}` };
  } catch (e) {
    console.warn('[intake] llm failed:', p.name, e instanceof Error ? e.message : e);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
