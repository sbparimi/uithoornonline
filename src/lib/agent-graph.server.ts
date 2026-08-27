/**
 * Agent graph engine — server only.
 *
 * A deterministic, typed state graph replaces the previous single "model +
 * tool loop". Every node is a pure-ish function `(state) => Promise<state>`
 * that also declares which node runs next, so the control flow lives in code
 * (auditable, testable, bounded) instead of inside the model's head.
 *
 *   ingest ─▶ guard ─▶ plan ─▶ retrieve ─▶ draft ─▶ verify ─┬─▶ finalize
 *                │                  ▲                       │
 *                │                  └──── repair ◀──────────┘ (max 1x)
 *                └─▶ finalize (refusal / injection / out of scope)
 *
 * Hard problems each node is designed to eliminate:
 *  - guard      : prompt injection, scope drift, PII leakage into logs
 *  - plan       : re-asking for slots the user already gave (deterministic
 *                 extraction beats the model), tool-order confusion
 *  - retrieve   : tool thrashing / infinite loops / oscillation (memoised
 *                 calls + per-tool budgets + wall-clock budget + timeouts)
 *  - draft      : unconstrained prose (forced structured tool output)
 *  - verify     : hallucination (independent LLM entailment check of every
 *                 factual claim against the retrieved evidence text)
 *  - repair     : one bounded corrective pass instead of an endless retry loop
 *  - finalize   : deterministic last line of defence — regex claim guard,
 *                 citation whitelist, source conflict + staleness detection,
 *                 status downgrade the model cannot override
 */
import {
  searchKnowledgeWithStatus,
  type KnowledgeHit,
} from "@/lib/knowledge.server";
import {
  pdokLookupAddress,
  pdokCheckNoiseZone,
  type AddressLookup,
} from "@/lib/official-sources.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/* ------------------------------------------------------------------ types */

export const STATUSES = [
  "CONFIRMED",
  "INSUFFICIENT_EVIDENCE",
  "SOURCE_UNAVAILABLE",
  "MANUAL_REVIEW_REQUIRED",
  "NON_FACTUAL",
  "OUT_OF_SCOPE",
] as const;
export type Status = (typeof STATUSES)[number];

export type Lang = "nl" | "en";
export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };
export type Slots = Partial<
  Record<"name" | "address" | "postcode" | "email" | "phone", string>
>;
export type QuickReply = { label: string; action: string };

export type Evidence = {
  finding: string;
  dataset: string;
  dataset_version: string;
  retrieved_at: string;
  confidence: "high" | "medium" | "low";
  url: string;
  tier: number;
  stale: boolean;
};

export type TraceEntry = {
  node: string;
  ms: number;
  detail?: Record<string, unknown>;
};

export type GraphResult = {
  message: string;
  quickReplies: QuickReply[];
  collectedSlots: Slots;
  sources: { title: string; url: string }[];
  status: Status;
  evidence: Evidence[];
  requestId: string;
  trace: TraceEntry[];
};

type NodeName =
  | "ingest"
  | "guard"
  | "plan"
  | "retrieve"
  | "draft"
  | "verify"
  | "repair"
  | "finalize";

type Draft = {
  status: Status;
  message: string;
  quickReplies: unknown;
  collectedSlots: Record<string, unknown> | undefined;
  evidence: unknown;
};

type State = {
  requestId: string;
  lang: Lang;
  apiKey: string;
  startedAt: number;
  messages: ChatMessage[];
  slots: Slots;
  lastUser: string;

  next: NodeName | null;
  trace: TraceEntry[];
  flags: Record<string, unknown>;

  /** conversation sent to the model in the retrieve/draft nodes */
  convo: any[];
  /** every citable source discovered this turn, keyed by url */
  hits: Map<string, KnowledgeHit>;
  /** memoised tool results — kills repeated identical tool calls */
  toolMemo: Map<string, string>;
  toolCalls: Record<string, number>;
  sourceUnavailable: boolean;
  repairs: number;

  draft: Draft | null;
  unsupported: string[];
  result: GraphResult | null;
};

/* -------------------------------------------------------------- constants */

const MODEL = "google/gemini-2.5-flash";
const VERIFIER_MODEL = "google/gemini-2.5-flash-lite";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const WALL_CLOCK_BUDGET_MS = 45_000;
const MODEL_TIMEOUT_MS = 25_000;
const TOOL_TIMEOUT_MS = 12_000;
const MAX_RETRIEVE_STEPS = 6;
const MAX_CALLS_PER_TOOL = 3;
const MAX_REPAIRS = 1;
const STALE_DAYS = 180;

const ALLOWED_ROUTES = ["/check", "/claim", "/log", "/map"] as const;

const FALLBACK_QR: QuickReply[] = [
  { label: "Check mijn adres", action: "route:/check" },
  { label: "Hoe werkt compensatie?", action: "ask:Hoe werkt de compensatie?" },
  { label: "Geluid melden", action: "route:/log" },
];

const POSTCODE_RE = /\b(142[0-4])\s?([A-Z]{2})?\b/i;
const HOUSENR_RE = /\b(?:nr\.?|huisnummer|nummer)?\s?(\d{1,4}[a-zA-Z]?)\b/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_FIND_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;
const PHONE_FIND_RE = /(?:\+31|0)[\d\s\-()]{8,}/;
const URL_RE = /^https?:\/\/[^\s]{4,300}$/i;

const FACTUAL_CLAIM_RE =
  /(€\s?\d|\d+\s?%|\b\d{1,3}\s?(dB|decibel)\b|\bL(den|night|aeq)\b|\b(19|20)\d{2}\b|\bartikel\s?\d|\bart\.\s?\d|\bwet\b|\bregeling\b|\bbesluit\b|\bkamerstuk\b|\bdeadline\b|\bvergoeding\s+van\b|\buitkering\s+van\b)/i;

/** Prompt-injection / jailbreak surface, NL + EN. */
const INJECTION_RE =
  /(negeer|vergeet)\s+(alle\s+)?(voorgaande|bovenstaande|vorige)\s+(instructies|regels)|ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules)|disregard\s+(the\s+)?(system|previous)|system\s*prompt|jouw\s+systeem(prompt|instructies)|developer\s+mode|do\s+anything\s+now|\bDAN\s+mode\b|reveal\s+your\s+(prompt|instructions)|act\s+as\s+(?!a\s+resident)/i;

/** Topics we are competent in. Anything else is refused, not guessed. */
const IN_SCOPE_RE =
  /(schiphol|vlieg|vliegtuig|aircraft|flight|geluid|lawaai|noise|decibel|db|overlast|nuisance|hinder|compensat|schade|nadeelcompensatie|isolatie|isolation|claim|klacht|complaint|melding|bas\b|ilt\b|lib\b|uithoorn|kwakel|142\d|postcode|adres|address|zone|aanvliegroute|baan|kaagbaan|aalsmeerbaan|buitenveldert|slaap|gezondheid|health|wet|regeling|procedure|formulier|gemeente|hoe werkt|wat kan ik|help|hallo|hoi|hi\b|hello|dank|bedankt|thanks|taal|language|english|nederlands)/i;

const T = {
  ungrounded: {
    nl: "Daar heb ik op dit moment geen geverifieerde bron voor. Ik wil je geen bedrag, datum of regel noemen die ik niet uit een officiële bron kan aantonen. Kijk op bezoekbas.nl of schiphol.nl, of vraag me om gericht te zoeken.",
    en: "I don't have a verified source for that right now. I won't state an amount, date or rule I can't back with an official source. Please check bezoekbas.nl or schiphol.nl, or ask me to search specifically.",
  },
  unavailable: {
    nl: "Ik kan de officiële bronnen op dit moment niet bereiken (SOURCE UNAVAILABLE). Probeer het later opnieuw of kijk rechtstreeks op bezoekbas.nl en schiphol.nl.",
    en: "I can't reach the official sources right now (SOURCE UNAVAILABLE). Please try again later or visit bezoekbas.nl and schiphol.nl directly.",
  },
  injection: {
    nl: "Ik kan mijn instructies of interne werking niet aanpassen of tonen. Ik help je wel graag met Schiphol-geluidsoverlast in Uithoorn.",
    en: "I can't change or reveal my instructions or internal workings. I'm happy to help with Schiphol noise nuisance in Uithoorn.",
  },
  outOfScope: {
    nl: "Daar ga ik niet over. Ik beantwoord alleen vragen over Schiphol-geluidsoverlast in Uithoorn (1421-1424): adrescontrole, melden, procedures en compensatieaanvragen.",
    en: "That's outside my scope. I only answer questions about Schiphol noise nuisance in Uithoorn (1421-1424): address checks, reporting, procedures and compensation applications.",
  },
  timeout: {
    nl: "Dat duurde te lang om betrouwbaar te beantwoorden. Stel je vraag opnieuw, dan probeer ik het gerichter.",
    en: "That took too long to answer reliably. Please ask again and I'll try a narrower search.",
  },
  stale: {
    nl: "\n\n_Let op: sommige bronnen zijn ouder dan 6 maanden en weerspiegelen mogelijk niet de laatste publicatie._",
    en: "\n\n_Note: some sources are older than 6 months and may not reflect the latest publication._",
  },
  review: {
    nl: "\n\n_Let op: officiële bronnen spreken elkaar hier mogelijk tegen. Dit antwoord is gemarkeerd voor menselijke controle._",
    en: "\n\n_Note: official sources may conflict here. This answer is flagged for human review._",
  },
  ai: {
    nl: "\n\n_Antwoord van een AI-systeem, uitsluitend gebaseerd op bovenstaande bronnen._",
    en: "\n\n_Answer generated by an AI system, based solely on the sources above._",
  },
};
const t = (k: keyof typeof T, lang: Lang) => T[k][lang];

/* ---------------------------------------------------------------- prompts */

const SYSTEM_PROMPT = `Je bent "Uithoorn Online", een AI-beslissingsondersteunend systeem (EU AI Act, art. 50) voor Schiphol-geluidsoverlast in Uithoorn (postcodes 1421-1424). Je stelt zelf niets vast; je vat uitsluitend samen wat officiële bronnen zeggen.

ACTIEF GEDRAG:
- Stuur de gebruiker niet weg met "kijk op de officiële bronnen". JIJ raadpleegt ze via je tools.
- Vraag door tot je POSTCODE + HUISNUMMER hebt, roep dan lookupAddress aan.
- Met coordinaten uit lookupAddress roep je checkNoiseZone aan.
- Voor procedures/regelingen/bedragen roep je searchKnowledge aan.

TOOL-VOLGORDE bij adresvraag: checkAddress -> lookupAddress -> checkNoiseZone -> searchKnowledge.

GROUNDING (overtreden = systeemfout, wordt server-side gedetecteerd en geblokkeerd):
A. Elke feitelijke uitspraak komt LETTERLIJK uit een tool-resultaat van DEZE beurt.
B. Verzin NOOIT URLs, bedragen, datums, dB-waarden of formuliernamen. Geen "ongeveer", geen "meestal".
C. Kun je iets niet staven? Zeg dat expliciet en gebruik status INSUFFICIENT_EVIDENCE.
D. Geef nooit een schatting van compensatie. De app stelt geen bedrag vast.
E. Elke claim in message[] die een getal, jaartal, bedrag of regel bevat MOET een bijbehorend evidence[]-item met exacte url hebben.

UITKOMST-CONTRACT (tool replyStructured):
- CONFIRMED: elke feitelijke claim heeft een evidence-item.
- INSUFFICIENT_EVIDENCE: gezocht, niets bruikbaars gevonden.
- SOURCE_UNAVAILABLE: een tool gaf ok=false.
- MANUAL_REVIEW_REQUIRED: bronnen spreken elkaar tegen.
- NON_FACTUAL: begroeting/navigatie zonder feitelijke claim.

CONVERSATIE: Nederlands tenzij LANGUAGE OVERRIDE. Max 3 zinnen. Verzamel slots 1 tegelijk en vraag nooit opnieuw naar iets dat al bekend is. Geef 2-4 quickReplies ("route:/check|/claim|/log|/map" of "ask:<vraag>").`;

/* ------------------------------------------------------------------ tools */

const fn = (name: string, description: string, properties: any, required: string[]) => ({
  type: "function" as const,
  function: {
    name,
    description,
    parameters: { type: "object", properties, required, additionalProperties: false },
  },
});

const TOOLS = [
  fn(
    "checkAddress",
    "Snelle postcode-range check (1421-1424). Zegt niets over compensatierecht.",
    { postcode: { type: "string" }, houseNumber: { type: "string" } },
    ["postcode"],
  ),
  fn(
    "lookupAddress",
    "Officiële BAG-lookup via PDOK Locatieserver. Vereist postcode EN huisnummer. Geeft BAG-id, exact adres, gemeente en lon/lat.",
    { postcode: { type: "string" }, houseNumber: { type: "string" } },
    ["postcode", "houseNumber"],
  ),
  fn(
    "checkNoiseZone",
    "Controleer via PDOK LIB WFS of lon/lat binnen een wettelijk Schiphol-beperkingengebied valt. Gebruik coordinaten uit lookupAddress.",
    { lon: { type: "number" }, lat: { type: "number" } },
    ["lon", "lat"],
  ),
  fn(
    "searchKnowledge",
    "Zoek in de geverifieerde kennisbank (wetten.overheid.nl/BAS/Schiphol/ILT/gemeente). Resultaat bevat source_tier (1=wet) en retrieved_at.",
    { query: { type: "string" } },
    ["query"],
  ),
  {
    type: "function" as const,
    function: {
      name: "replyStructured",
      description: "Definitief antwoord met EU-AI-Act status en evidence blocks.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: STATUSES as unknown as string[] },
          message: { type: "string" },
          quickReplies: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              properties: { label: { type: "string" }, action: { type: "string" } },
              required: ["label", "action"],
              additionalProperties: false,
            },
          },
          collectedSlots: {
            type: "object",
            properties: {
              name: { type: "string" },
              address: { type: "string" },
              postcode: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
            additionalProperties: false,
          },
          evidence: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              properties: {
                finding: { type: "string" },
                dataset: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                url: { type: "string" },
              },
              required: ["finding", "dataset", "url"],
              additionalProperties: false,
            },
          },
        },
        required: ["status", "message", "quickReplies"],
        additionalProperties: false,
      },
    },
  },
];

/* ---------------------------------------------------------------- helpers */

async function withTimeout<R>(p: Promise<R>, ms: number, label: string): Promise<R> {
  let timer: ReturnType<typeof setTimeout>;
  return await Promise.race([
    p,
    new Promise<R>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

type GatewayResult =
  | { ok: true; message: any }
  | { ok: false; kind: "unavailable" | "blocked"; status?: number };

/** Single gateway call with bounded retry on 429/5xx. */
async function callGateway(
  apiKey: string,
  body: Record<string, unknown>,
  attempts = 3,
): Promise<GatewayResult> {
  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await withTimeout(
        fetch(GATEWAY, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        }),
        MODEL_TIMEOUT_MS,
        "gateway",
      );
    } catch (e) {
      console.error("gateway fetch failed", e);
      if (i === attempts - 1) return { ok: false, kind: "unavailable" };
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
      continue;
    }
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const message = json?.choices?.[0]?.message;
      if (!message) return { ok: false, kind: "unavailable" };
      return { ok: true, message };
    }
    if (res.status === 402 || res.status === 403 || res.status === 401) {
      console.error("gateway blocked", res.status, await res.text().catch(() => ""));
      return { ok: false, kind: "blocked", status: res.status };
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** i;
      if (i === attempts - 1) return { ok: false, kind: "unavailable", status: res.status };
      await new Promise((r) => setTimeout(r, Math.min(delay, 4000)));
      continue;
    }
    console.error("gateway error", res.status, await res.text().catch(() => ""));
    return { ok: false, kind: "unavailable", status: res.status };
  }
  return { ok: false, kind: "unavailable" };
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function sanitizeSlots(input: Record<string, unknown> | undefined): Slots {
  const out: Slots = {};
  if (!input) return out;
  if (typeof input.name === "string" && input.name.trim().length >= 2)
    out.name = input.name.trim().slice(0, 120);
  if (typeof input.address === "string" && input.address.trim().length >= 2)
    out.address = input.address.trim().slice(0, 200);
  if (typeof input.postcode === "string") {
    const m = input.postcode.match(POSTCODE_RE);
    if (m) out.postcode = m[0].toUpperCase().replace(/\s+/g, "");
  }
  if (typeof input.email === "string" && EMAIL_RE.test(input.email.trim()))
    out.email = input.email.trim().toLowerCase();
  if (typeof input.phone === "string" && PHONE_RE.test(input.phone.trim()))
    out.phone = input.phone.trim();
  return out;
}

function sanitizeQuickReplies(input: unknown): QuickReply[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (q): q is QuickReply =>
        !!q &&
        typeof q.label === "string" &&
        typeof q.action === "string" &&
        q.label.trim().length > 0 &&
        (q.action.startsWith("ask:") ||
          (q.action.startsWith("route:") &&
            (ALLOWED_ROUTES as readonly string[]).includes(q.action.slice(6)))),
    )
    .map((q) => ({ label: q.label.trim().slice(0, 40), action: q.action }))
    .slice(0, 4);
}

function sanitizeEvidence(input: unknown, hits: Map<string, KnowledgeHit>): Evidence[] {
  if (!Array.isArray(input)) return [];
  const out: Evidence[] = [];
  const seen = new Set<string>();
  for (const e of input) {
    if (!e || typeof e !== "object") continue;
    const url = String((e as { url?: unknown }).url ?? "").trim();
    if (!URL_RE.test(url) || seen.has(url)) continue;
    const hit = hits.get(url);
    if (!hit) continue; // citation whitelist: must be retrieved this turn
    seen.add(url);
    const ageDays = (Date.now() - new Date(hit.fetched_at).getTime()) / 86_400_000;
    out.push({
      finding: String((e as { finding?: unknown }).finding ?? "").slice(0, 280),
      dataset: hit.source_title || hit.source_url,
      dataset_version: `fetched ${hit.fetched_at.slice(0, 10)}`,
      retrieved_at: hit.fetched_at,
      confidence:
        ((e as { confidence?: unknown }).confidence as Evidence["confidence"]) ?? "medium",
      url,
      tier: hit.source_tier,
      stale: ageDays > STALE_DAYS,
    });
    if (out.length >= 6) break;
  }
  return out;
}

function detectConflict(evidence: Evidence[]): boolean {
  const auth = evidence.filter((e) => e.tier <= 3 && FACTUAL_CLAIM_RE.test(e.finding));
  if (auth.length < 2) return false;
  return new Set(auth.map((e) => safeHost(e.url))).size >= 2;
}

/** Mask direct identifiers before anything is written to the audit table. */
function redact(s: string): string {
  return s
    .replace(EMAIL_FIND_RE, "[email]")
    .replace(PHONE_FIND_RE, "[phone]")
    .slice(0, 4000);
}

function executeCheckAddress(args: { postcode?: string; houseNumber?: string }) {
  const raw = String(args.postcode ?? "").trim();
  const m = raw.match(/\d{4}/);
  if (!m) return { ok: false, reason: "invalid_postcode", message: "Geen geldige postcode." };
  const num = parseInt(m[0], 10);
  const inUithoorn = num >= 1421 && num <= 1424;
  return {
    ok: true,
    postcode: m[0],
    houseNumber: args.houseNumber ?? null,
    inUithoorn,
    note: "Postale check; zegt niets over compensatierecht.",
    message: inUithoorn
      ? `Postcode ${m[0]} hoort bij Uithoorn / De Kwakel.`
      : `Postcode ${m[0]} valt buiten 1421-1424.`,
  };
}

async function logAudit(row: {
  request_id: string;
  lang: string;
  question: string;
  status: Status;
  message: string;
  evidence: Evidence[];
  sources: { title: string; url: string }[];
  flags: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("chat_audit_log").insert({
      request_id: row.request_id,
      lang: row.lang,
      question: redact(row.question),
      status: row.status,
      message: redact(row.message),
      evidence: row.evidence as unknown as any,
      sources: row.sources as unknown as any,
      flags: row.flags as unknown as any,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

/** Terminal result builder — the only place a GraphResult is constructed. */
function terminate(
  s: State,
  status: Status,
  message: string,
  opts: { evidence?: Evidence[]; slots?: Slots; qr?: QuickReply[] } = {},
): State {
  const evidence = opts.evidence ?? [];
  const sources = evidence.map((e) => ({ title: e.dataset, url: e.url }));
  s.result = {
    message: message || "…",
    quickReplies: opts.qr?.length ? opts.qr : FALLBACK_QR,
    collectedSlots: opts.slots ?? {},
    sources,
    status,
    evidence,
    requestId: s.requestId,
    trace: s.trace,
  };
  s.next = null;
  return s;
}

/* ------------------------------------------------------------------ nodes */

/** ingest: normalise history, cap context, seed the model conversation. */
async function nodeIngest(s: State): Promise<State> {
  const msgs = s.messages.filter((m) => m.role !== "system");
  const trimmed = msgs.length > 20 ? [msgs[0], ...msgs.slice(-19)] : msgs;
  s.messages = trimmed;
  s.lastUser = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";
  s.next = "guard";
  return s;
}

/** guard: injection defence + scope gate. Refusals never reach the model. */
async function nodeGuard(s: State): Promise<State> {
  if (INJECTION_RE.test(s.lastUser)) {
    s.flags.injection_blocked = true;
    return terminate(s, "NON_FACTUAL", t("injection", s.lang), { slots: {} });
  }
  const short = s.lastUser.trim().length <= 3;
  if (!short && !IN_SCOPE_RE.test(s.lastUser)) {
    s.flags.out_of_scope = true;
    return terminate(s, "OUT_OF_SCOPE", t("outOfScope", s.lang), { slots: {} });
  }
  s.next = "plan";
  return s;
}

/**
 * plan: deterministic slot extraction from the raw user text. The model is a
 * bad short-term memory; regexes are not. Anything found here is injected as
 * known context so the agent cannot re-ask for it or mangle it.
 */
async function nodePlan(s: State): Promise<State> {
  const text = s.lastUser;
  const found: Slots = {};
  const pc = text.match(POSTCODE_RE);
  if (pc) found.postcode = pc[0].toUpperCase().replace(/\s+/g, "");
  const em = text.match(EMAIL_FIND_RE);
  if (em && EMAIL_RE.test(em[0])) found.email = em[0].toLowerCase();
  const ph = text.match(PHONE_FIND_RE);
  if (ph && PHONE_RE.test(ph[0].trim())) found.phone = ph[0].trim();
  if (pc) {
    const after = text.slice(pc.index! + pc[0].length);
    const hn = after.match(HOUSENR_RE);
    if (hn) found.address = `${found.postcode} ${hn[1]}`;
  }
  s.slots = { ...s.slots, ...found };
  s.flags.slots_extracted = Object.keys(found);

  const known = Object.keys(s.slots).length
    ? `\n\nREEDS BEKEND (nooit opnieuw vragen): ${JSON.stringify(s.slots)}`
    : "\n\nNog geen gegevens verzameld.";
  const langDirective =
    s.lang === "en" ? "\n\nLANGUAGE OVERRIDE: reply in English." : "\n\nTAAL: Nederlands.";

  s.convo = [
    { role: "system", content: SYSTEM_PROMPT + known + langDirective },
    ...s.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  s.next = "retrieve";
  return s;
}

async function runTool(s: State, name: string, args: any): Promise<string> {
  const key = `${name}:${JSON.stringify(args)}`;
  const memo = s.toolMemo.get(key);
  if (memo) {
    s.flags.memo_hits = ((s.flags.memo_hits as number) ?? 0) + 1;
    return memo;
  }
  s.toolCalls[name] = (s.toolCalls[name] ?? 0) + 1;
  if (s.toolCalls[name] > MAX_CALLS_PER_TOOL) {
    return JSON.stringify({
      ok: false,
      reason: "budget_exceeded",
      message: `Tool ${name} budget bereikt. Antwoord nu met replyStructured op basis van wat je hebt.`,
    });
  }

  let payload: unknown;
  try {
    if (name === "checkAddress") {
      payload = executeCheckAddress(args);
    } else if (name === "lookupAddress") {
      const r: AddressLookup = await withTimeout(
        pdokLookupAddress(String(args?.postcode ?? ""), String(args?.houseNumber ?? "")),
        TOOL_TIMEOUT_MS,
        name,
      );
      if (!r.ok && r.reason === "unavailable") s.sourceUnavailable = true;
      if (r.ok) {
        s.hits.set(r.source_url, {
          source_url: r.source_url,
          source_title: `BAG: ${r.label}`,
          source_type: "official",
          source_tier: 2,
          content: JSON.stringify(r),
          similarity: 1,
          fetched_at: r.retrieved_at,
        });
      }
      payload = r;
    } else if (name === "checkNoiseZone") {
      const lon = Number(args?.lon);
      const lat = Number(args?.lat);
      const r =
        Number.isFinite(lon) && Number.isFinite(lat)
          ? await withTimeout(pdokCheckNoiseZone(lon, lat), TOOL_TIMEOUT_MS, name)
          : ({ ok: false as const, reason: "unavailable" as const, message: "lon/lat ontbreekt." } as any);
      if (!r.ok && r.reason === "unavailable") s.sourceUnavailable = true;
      if (r.ok) {
        s.hits.set(r.source_url, {
          source_url: r.source_url,
          source_title: "PDOK — Luchthavenindelingbesluit Schiphol (LIB)",
          source_type: "official",
          source_tier: 2,
          content: JSON.stringify(r),
          similarity: 1,
          fetched_at: r.retrieved_at,
        });
      }
      payload = r;
    } else if (name === "searchKnowledge") {
      const q = String(args?.query ?? "").trim().slice(0, 300);
      const r = q
        ? await withTimeout(searchKnowledgeWithStatus(q, 4), TOOL_TIMEOUT_MS, name)
        : { ok: true as const, hits: [] };
      if (!r.ok) s.sourceUnavailable = true;
      const hits = r.ok ? r.hits : [];
      for (const h of hits) if (h?.source_url && URL_RE.test(h.source_url)) s.hits.set(h.source_url, h);
      payload = {
        ok: r.ok,
        hits: hits.map((h) => ({
          title: h.source_title,
          url: h.source_url,
          tier: h.source_tier,
          retrieved_at: h.fetched_at,
          similarity: Number(h.similarity.toFixed(3)),
          excerpt: h.content.slice(0, 800),
        })),
      };
    } else {
      payload = { ok: false, reason: "unknown_tool" };
    }
  } catch (e) {
    console.error("tool failed", name, e);
    s.sourceUnavailable = true;
    payload = { ok: false, reason: "unavailable", message: `Tool ${name} onbereikbaar.` };
  }

  const str = JSON.stringify(payload);
  s.toolMemo.set(key, str);
  return str;
}

/**
 * retrieve + draft: bounded tool loop. Exits the moment the model emits
 * replyStructured, or when a budget is hit (then it is forced to answer with
 * whatever evidence exists rather than looping forever).
 */
async function nodeRetrieve(s: State): Promise<State> {
  for (let step = 0; step < MAX_RETRIEVE_STEPS; step++) {
    if (Date.now() - s.startedAt > WALL_CLOCK_BUDGET_MS) {
      s.flags.wall_clock_exceeded = true;
      return terminate(s, "SOURCE_UNAVAILABLE", t("timeout", s.lang));
    }
    const out = await callGateway(s.apiKey, {
      model: MODEL,
      messages: s.convo,
      tools: TOOLS,
      tool_choice: step === MAX_RETRIEVE_STEPS - 1 ? "required" : "required",
    });
    if (!out.ok) {
      s.flags.gateway = out.kind;
      return terminate(s, "SOURCE_UNAVAILABLE", t("unavailable", s.lang));
    }
    const choice = out.message;
    const toolCalls = choice?.tool_calls ?? [];

    if (!toolCalls.length) {
      // Free-form prose is never trusted: route it through verification as a
      // draft with no evidence, so the finalize guard can catch claims.
      s.draft = {
        status: "NON_FACTUAL",
        message: typeof choice?.content === "string" ? choice.content.trim() : "",
        quickReplies: [],
        collectedSlots: undefined,
        evidence: [],
      };
      s.flags.no_tool_call = true;
      s.next = "verify";
      return s;
    }

    s.convo.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });

    let reply: any = null;
    for (const tc of toolCalls) {
      const name = tc?.function?.name;
      let args: any = {};
      try {
        args =
          typeof tc?.function?.arguments === "string"
            ? JSON.parse(tc.function.arguments)
            : (tc?.function?.arguments ?? {});
      } catch {
        args = {};
      }
      if (name === "replyStructured") {
        reply = args;
        s.convo.push({ role: "tool", tool_call_id: tc.id, content: "ok" });
      } else {
        const content = await runTool(s, name, args);
        s.convo.push({ role: "tool", tool_call_id: tc.id, content });
      }
    }

    if (reply) {
      s.draft = {
        status: (STATUSES as readonly string[]).includes(reply.status)
          ? (reply.status as Status)
          : "INSUFFICIENT_EVIDENCE",
        message: typeof reply.message === "string" ? reply.message.trim() : "",
        quickReplies: reply.quickReplies,
        collectedSlots: reply.collectedSlots,
        evidence: reply.evidence,
      };
      s.flags.retrieve_steps = step + 1;
      s.next = "verify";
      return s;
    }
  }
  s.flags.loop_exhausted = true;
  return terminate(s, "INSUFFICIENT_EVIDENCE", t("ungrounded", s.lang));
}

/**
 * verify: independent entailment check. A second, cheaper model sees ONLY the
 * draft answer plus the raw retrieved excerpts and must decide, per sentence,
 * whether the evidence supports it. The drafting model never sees this call,
 * so it cannot talk its way past it.
 */
async function nodeVerify(s: State): Promise<State> {
  const draft = s.draft!;
  const evidence = sanitizeEvidence(draft.evidence, s.hits);
  const factual = FACTUAL_CLAIM_RE.test(draft.message);

  // Cheap deterministic exits — no model call needed.
  if (!factual || !draft.message) {
    s.flags.verify = "skipped_non_factual";
    s.next = "finalize";
    return s;
  }
  if (evidence.length === 0) {
    s.flags.verify = "no_citations";
    s.unsupported = ["message contains factual claims but has no citation"];
    s.next = s.repairs < MAX_REPAIRS ? "repair" : "finalize";
    return s;
  }
  if (Date.now() - s.startedAt > WALL_CLOCK_BUDGET_MS) {
    s.flags.verify = "skipped_budget";
    s.next = "finalize";
    return s;
  }

  const corpus = evidence
    .map((e) => {
      const hit = s.hits.get(e.url);
      return `[${e.url}]\n${(hit?.content ?? "").slice(0, 1500)}`;
    })
    .join("\n\n---\n\n");

  const out = await callGateway(
    s.apiKey,
    {
      model: VERIFIER_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Je bent een strikte feitverificateur. Je krijgt BRONNEN en een ANTWOORD. Splits het antwoord in feitelijke beweringen (getallen, bedragen, datums, regels, zone-uitspraken, procedurestappen). Een bewering is SUPPORTED alleen als de tekst in BRONNEN dat letterlijk of onmiskenbaar impliceert. Twijfel = UNSUPPORTED. Beleefdheden, vragen en navigatie-aanwijzingen negeer je. Antwoord uitsluitend met het tool-call verdict.",
        },
        { role: "user", content: `BRONNEN:\n${corpus}\n\nANTWOORD:\n${draft.message}` },
      ],
      tools: [
        fn(
          "verdict",
          "Verificatie-uitkomst.",
          {
            supported: { type: "boolean" },
            unsupported_claims: { type: "array", maxItems: 6, items: { type: "string" } },
          },
          ["supported"],
        ),
      ],
      tool_choice: "required",
    },
    2,
  );

  if (!out.ok) {
    // Fail closed: cannot verify => treat factual content as unsupported.
    s.flags.verify = "verifier_unavailable";
    s.unsupported = ["verifier unavailable"];
    s.next = "finalize";
    return s;
  }

  let verdict: any = {};
  try {
    const tc = out.message?.tool_calls?.[0];
    verdict =
      typeof tc?.function?.arguments === "string"
        ? JSON.parse(tc.function.arguments)
        : (tc?.function?.arguments ?? {});
  } catch {
    verdict = {};
  }
  const unsupported = Array.isArray(verdict.unsupported_claims)
    ? verdict.unsupported_claims.map((c: unknown) => String(c).slice(0, 200)).slice(0, 6)
    : [];
  const supported = verdict.supported === true && unsupported.length === 0;
  s.unsupported = supported ? [] : unsupported.length ? unsupported : ["unspecified unsupported claim"];
  s.flags.verify = supported ? "supported" : "unsupported";
  s.flags.unsupported_claims = s.unsupported;

  s.next = supported ? "finalize" : s.repairs < MAX_REPAIRS ? "repair" : "finalize";
  return s;
}

/** repair: one corrective pass. The model must drop or cite the flagged claims. */
async function nodeRepair(s: State): Promise<State> {
  s.repairs++;
  s.convo.push({
    role: "user",
    content: `SYSTEEMCONTROLE — je vorige antwoord is afgekeurd door de feitverificateur. Niet-gedekte beweringen:\n- ${s.unsupported.join(
      "\n- ",
    )}\n\nHerschrijf het antwoord: verwijder elke bewering die niet letterlijk uit een tool-resultaat van deze beurt komt, OF zoek eerst met searchKnowledge naar een bron die de bewering wél dekt en citeer die in evidence[]. Als er geen bron is, zeg dat eerlijk met status INSUFFICIENT_EVIDENCE. Antwoord met replyStructured.`,
  });
  s.next = "retrieve";
  return s;
}

/**
 * finalize: deterministic last line of defence. The model's self-declared
 * status is discarded and recomputed from what is actually provable.
 */
async function nodeFinalize(s: State): Promise<State> {
  const draft = s.draft ?? {
    status: "INSUFFICIENT_EVIDENCE" as Status,
    message: "",
    quickReplies: [],
    collectedSlots: undefined,
    evidence: [],
  };
  const evidence = sanitizeEvidence(draft.evidence, s.hits);
  let message = draft.message;
  const looksFactual = FACTUAL_CLAIM_RE.test(message);
  const stillUnsupported = s.unsupported.length > 0;

  let status: Status;
  if (s.sourceUnavailable && evidence.length === 0 && looksFactual) {
    status = "SOURCE_UNAVAILABLE";
    message = t("unavailable", s.lang);
  } else if (looksFactual && (evidence.length === 0 || stillUnsupported)) {
    status = "INSUFFICIENT_EVIDENCE";
    message = t("ungrounded", s.lang);
  } else if (detectConflict(evidence)) {
    status = "MANUAL_REVIEW_REQUIRED";
    message += t("review", s.lang);
    s.flags.conflict = true;
  } else if (looksFactual) {
    status = "CONFIRMED";
  } else {
    status = "NON_FACTUAL";
  }

  const usableEvidence = status === "INSUFFICIENT_EVIDENCE" || status === "SOURCE_UNAVAILABLE" ? [] : evidence;
  if (usableEvidence.some((e) => e.stale)) {
    message += t("stale", s.lang);
    s.flags.stale_evidence = true;
  }
  if (usableEvidence.length > 0) message += t("ai", s.lang);

  return terminate(s, status, message, {
    evidence: usableEvidence,
    slots: sanitizeSlots(draft.collectedSlots),
    qr: sanitizeQuickReplies(draft.quickReplies),
  });
}

const NODES: Record<NodeName, (s: State) => Promise<State>> = {
  ingest: nodeIngest,
  guard: nodeGuard,
  plan: nodePlan,
  retrieve: nodeRetrieve,
  draft: nodeRetrieve,
  verify: nodeVerify,
  repair: nodeRepair,
  finalize: nodeFinalize,
};

/* ------------------------------------------------------------------ runner */

export async function runAgentGraph(input: {
  messages: ChatMessage[];
  slots: Slots;
  lang: Lang;
}): Promise<GraphResult> {
  const requestId = crypto.randomUUID();
  const lang = input.lang;
  const apiKey = process.env.LOVABLE_API_KEY ?? "";

  const s: State = {
    requestId,
    lang,
    apiKey,
    startedAt: Date.now(),
    messages: input.messages,
    slots: { ...input.slots },
    lastUser: "",
    next: "ingest",
    trace: [],
    flags: {},
    convo: [],
    hits: new Map(),
    toolMemo: new Map(),
    toolCalls: {},
    sourceUnavailable: false,
    repairs: 0,
    draft: null,
    unsupported: [],
    result: null,
  };

  if (!apiKey) {
    const st = terminate(s, "SOURCE_UNAVAILABLE", t("unavailable", lang));
    return st.result!;
  }

  // Bounded graph traversal — a node can never create an unbounded walk.
  const MAX_TRANSITIONS = 24;
  for (let i = 0; i < MAX_TRANSITIONS && s.next; i++) {
    const node = s.next;
    const t0 = Date.now();
    try {
      await NODES[node](s);
    } catch (e) {
      console.error(`graph node ${node} threw`, e);
      s.flags.node_error = node;
      terminate(s, "SOURCE_UNAVAILABLE", t("unavailable", lang));
    }
    s.trace.push({ node, ms: Date.now() - t0 });
    if (s.next === node) {
      // self-loop protection
      s.flags.self_loop = node;
      terminate(s, "INSUFFICIENT_EVIDENCE", t("ungrounded", lang));
    }
  }
  if (!s.result) {
    s.flags.transitions_exhausted = true;
    terminate(s, "INSUFFICIENT_EVIDENCE", t("ungrounded", lang));
  }

  const result = s.result!;
  await logAudit({
    request_id: requestId,
    lang,
    question: s.lastUser,
    status: result.status,
    message: result.message,
    evidence: result.evidence,
    sources: result.sources,
    flags: {
      ...s.flags,
      repairs: s.repairs,
      tool_calls: s.toolCalls,
      trace: s.trace,
      total_ms: Date.now() - s.startedAt,
    },
  });
  return result;
}
