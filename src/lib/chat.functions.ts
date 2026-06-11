import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchKnowledgeWithStatus, type KnowledgeHit } from "@/lib/knowledge.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const SlotsSchema = z
  .object({
    name: z.string().max(120).optional(),
    address: z.string().max(200).optional(),
    postcode: z.string().max(10).optional(),
    email: z.string().max(160).optional(),
    phone: z.string().max(40).optional(),
  })
  .optional();

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  slots: SlotsSchema,
  lang: z.enum(["nl", "en"]).optional(),
});

const ALLOWED_ROUTES = ["/check", "/claim", "/log", "/map"] as const;

// EU AI Act regulated decision-support: every assistant turn returns one of
// these statuses. CONFIRMED means every factual claim has a tier 1-4 source.
// INSUFFICIENT_EVIDENCE means we have no usable source and refused to guess.
// SOURCE_UNAVAILABLE means a required authoritative source could not be
// reached. MANUAL_REVIEW_REQUIRED means two authoritative sources conflicted.
// NON_FACTUAL covers chit-chat / scope refusal / pure UI guidance.
const STATUSES = [
  "CONFIRMED",
  "INSUFFICIENT_EVIDENCE",
  "SOURCE_UNAVAILABLE",
  "MANUAL_REVIEW_REQUIRED",
  "NON_FACTUAL",
] as const;
type Status = (typeof STATUSES)[number];

const SYSTEM_PROMPT = `Je bent "Uithoorn Online", een AI-beslissingsondersteunend systeem (EU AI Act) voor Schiphol-geluidsoverlast in Uithoorn (postcodes 1421-1424). Je geeft NOOIT zelf advies over compensatiebedragen, juridische uitkomsten of medische gevolgen. Je vat uitsluitend samen wat in officiele bronnen staat.

TRANSPARANTIE (Art. 50): benoem bij twijfel dat je een AI bent en dat informatie uit publieke bronnen komt (BAS, Schiphol, ILT, gemeente Uithoorn, rijksoverheid, wetten.overheid.nl).

GROUNDING REGELS (overtreden = systeemfout):
A. Elke feitelijke uitspraak (bedragen, %, dB/Lden/Lnight, jaartallen, deadlines, namen van wetten/regelingen/instanties, URLs, telefoonnummers) MOET letterlijk uit een searchKnowledge-hit van DEZE beurt komen.
B. Verzin NOOIT URLs, bedragen, datums of formulier-namen. Geen "ongeveer", "meestal", "rond de".
C. Roep EERST searchKnowledge aan voor elke feiten- of procedurevraag.
D. Geef GEEN schattingen van compensatiebedragen of uitkomsten. De app stelt geen vergoeding vast.

UITKOMST-CONTRACT (replyStructured):
- status="CONFIRMED" als je beweringen volledig steunen op tier 1-4 hits.
- status="INSUFFICIENT_EVIDENCE" als je geen geverifieerde bron hebt: zeg dat letterlijk en verwijs naar bezoekbas.nl / schiphol.nl.
- status="MANUAL_REVIEW_REQUIRED" alleen wanneer twee gezaghebbende bronnen elkaar tegenspreken.
- status="NON_FACTUAL" voor begroeting, scope-weigering, of UI-navigatie zonder feitelijke claim.
- evidence[]: per feitelijke claim 1 item met {finding, dataset, dataset_version, retrieved_at, confidence, url}. dataset = source_title, dataset_version = "fetched <retrieved_at>".

CONVERSATIE:
- NL tenzij LANGUAGE OVERRIDE.
- Max 3 zinnen. Vriendelijk weigeren bij off-topic.
- Verzamel slots conversationeel: naam, adres, postcode, email, telefoon - 1 tegelijk, niet opnieuw vragen.
- Bij postcode: roep DIRECT checkAddress aan (postale check, GEEN claim-belofte).
- Geef 2-4 quickReplies. Actie-types: "route:/check|/claim|/log|/map" of "ask:<vraag>".`;

const checkAddressTool = {
  type: "function" as const,
  function: {
    name: "checkAddress",
    description: "Postale check of een postcode bij Uithoorn hoort. GEEN claim-uitspraak.",
    parameters: {
      type: "object",
      properties: {
        postcode: { type: "string" },
        houseNumber: { type: "string" },
      },
      required: ["postcode"],
      additionalProperties: false,
    },
  },
};

const searchKnowledgeTool = {
  type: "function" as const,
  function: {
    name: "searchKnowledge",
    description:
      "Zoek geverifieerde bronnen (BAS/Schiphol/ILT/gemeente/wetten.overheid.nl). VERPLICHT voor elke feitelijke claim. Resultaat bevat source_tier (1=wet, 5=overig) en retrieved_at.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const replyStructuredTool = {
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
          description: "1 item per feitelijke claim. Leeg bij NON_FACTUAL / INSUFFICIENT_EVIDENCE.",
          items: {
            type: "object",
            properties: {
              finding: { type: "string" },
              dataset: { type: "string" },
              dataset_version: { type: "string" },
              retrieved_at: { type: "string" },
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
};

const FALLBACK_QR = [
  { label: "Check mijn adres", action: "route:/check" },
  { label: "Hoe werkt compensatie?", action: "ask:Hoe werkt de compensatie?" },
  { label: "Geluid melden", action: "route:/log" },
];

const POSTCODE_RE = /\b(142[0-4])\s?[A-Z]{0,2}\b/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;
const URL_RE = /^https?:\/\/[^\s]{4,300}$/i;
const STALE_DAYS = 180;

const FACTUAL_CLAIM_RE =
  /(€\s?\d|\d+\s?%|\b\d{1,3}\s?(dB|decibel)\b|\bL(den|night|aeq)\b|\b(19|20)\d{2}\b|\bartikel\s?\d|\bart\.\s?\d|\bwet\b|\bregeling\b|\bbesluit\b|\bkamerstuk\b|\bdeadline\b|\bvergoeding\s+van\b|\buitkering\s+van\b)/i;

const UNGROUNDED_FALLBACK_NL =
  "Daar heb ik op dit moment geen geverifieerde bron voor. Kijk op bezoekbas.nl of schiphol.nl voor actuele en officiële informatie.";
const UNGROUNDED_FALLBACK_EN =
  "I don't have a verified source for that right now. Please check bezoekbas.nl or schiphol.nl for current official information.";
const SOURCE_UNAVAILABLE_NL =
  "Ik kan de officiële bronnen op dit moment niet bereiken (SOURCE UNAVAILABLE). Probeer het later opnieuw of kijk rechtstreeks op bezoekbas.nl en schiphol.nl.";
const SOURCE_UNAVAILABLE_EN =
  "I can't reach the official sources right now (SOURCE UNAVAILABLE). Please try again later or visit bezoekbas.nl and schiphol.nl directly.";

function sanitizeSlots(input: Record<string, unknown> | undefined) {
  const out: Record<string, string> = {};
  if (!input) return out;
  if (typeof input.name === "string" && input.name.trim().length >= 2)
    out.name = input.name.trim().slice(0, 120);
  if (typeof input.address === "string" && input.address.trim().length >= 2)
    out.address = input.address.trim().slice(0, 200);
  if (typeof input.postcode === "string") {
    const m = input.postcode.match(POSTCODE_RE);
    if (m) out.postcode = m[1];
  }
  if (typeof input.email === "string" && EMAIL_RE.test(input.email.trim()))
    out.email = input.email.trim().toLowerCase();
  if (typeof input.phone === "string" && PHONE_RE.test(input.phone.trim()))
    out.phone = input.phone.trim();
  return out;
}

function sanitizeQuickReplies(input: unknown) {
  if (!Array.isArray(input)) return [] as { label: string; action: string }[];
  return input
    .filter(
      (q): q is { label: string; action: string } =>
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

type Evidence = {
  finding: string;
  dataset: string;
  dataset_version: string;
  retrieved_at: string;
  confidence: "high" | "medium" | "low";
  url: string;
  tier: number;
  stale: boolean;
};

function sanitizeEvidence(input: unknown, hitsByUrl: Map<string, KnowledgeHit>) {
  if (!Array.isArray(input)) return [] as Evidence[];
  const out: Evidence[] = [];
  const seen = new Set<string>();
  for (const e of input) {
    if (!e || typeof e !== "object") continue;
    const url = String((e as { url?: unknown }).url ?? "").trim();
    if (!URL_RE.test(url) || seen.has(url)) continue;
    const hit = hitsByUrl.get(url);
    if (!hit) continue; // grounding: must come from this turn's search
    seen.add(url);
    const fetchedAt = hit.fetched_at;
    const ageDays =
      (Date.now() - new Date(fetchedAt).getTime()) / (1000 * 60 * 60 * 24);
    out.push({
      finding: String((e as { finding?: unknown }).finding ?? "").slice(0, 280),
      dataset: hit.source_title || hit.source_url,
      dataset_version: `fetched ${fetchedAt.slice(0, 10)}`,
      retrieved_at: fetchedAt,
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
  // Two authoritative (tier <= 3) sources cited for findings that look like
  // numeric/regulatory facts but from different domains => manual review.
  const auth = evidence.filter((e) => e.tier <= 3 && FACTUAL_CLAIM_RE.test(e.finding));
  if (auth.length < 2) return false;
  const hosts = new Set(auth.map((e) => safeHost(e.url)));
  return hosts.size >= 2;
}

function safeHost(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
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
      question: row.question.slice(0, 4000),
      status: row.status,
      message: row.message.slice(0, 4000),
      evidence: row.evidence as unknown as any,
      sources: row.sources as unknown as any,
      flags: row.flags as unknown as any,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const requestId = crypto.randomUUID();
    const lang = data.lang ?? "nl";
    const lastUser =
      [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        message: "De AI-assistent is nog niet geconfigureerd.",
        quickReplies: FALLBACK_QR,
        collectedSlots: {},
        sources: [],
        status: "SOURCE_UNAVAILABLE" as Status,
        evidence: [] as Evidence[],
        requestId,
      };
    }

    const trimmed =
      data.messages.length > 20 ? [data.messages[0], ...data.messages.slice(-19)] : data.messages;
    const slotsContext =
      data.slots && Object.keys(data.slots).length
        ? `\n\nReeds verzameld: ${JSON.stringify(data.slots)}`
        : "\n\nNog geen gegevens verzameld.";
    const langDirective =
      lang === "en"
        ? "\n\nLANGUAGE OVERRIDE: reply in English."
        : "\n\nTAAL: Nederlands.";

    const convo: any[] = [
      { role: "system", content: SYSTEM_PROMPT + slotsContext + langDirective },
      ...trimmed,
    ];

    const hitsByUrl = new Map<string, KnowledgeHit>();
    let sourceUnavailable = false;
    let searchAttempts = 0;

    for (let step = 0; step < 4; step++) {
      let res: Response;
      try {
        res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: convo,
            tools: [checkAddressTool, searchKnowledgeTool, replyStructuredTool],
            tool_choice: "required",
          }),
        });
      } catch (e) {
        console.error("AI gateway fetch failed", e);
        const message = lang === "en" ? SOURCE_UNAVAILABLE_EN : SOURCE_UNAVAILABLE_NL;
        await logAudit({
          request_id: requestId,
          lang,
          question: lastUser,
          status: "SOURCE_UNAVAILABLE",
          message,
          evidence: [],
          sources: [],
          flags: { gateway_error: true },
        });
        return {
          message,
          quickReplies: FALLBACK_QR,
          collectedSlots: {},
          sources: [],
          status: "SOURCE_UNAVAILABLE" as Status,
          evidence: [],
          requestId,
        };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("AI gateway error", res.status, text);
        const message =
          res.status === 429
            ? "Even geduld — te veel aanvragen."
            : res.status === 402
              ? "De assistent heeft tijdelijk geen credits."
              : lang === "en"
                ? SOURCE_UNAVAILABLE_EN
                : SOURCE_UNAVAILABLE_NL;
        await logAudit({
          request_id: requestId,
          lang,
          question: lastUser,
          status: "SOURCE_UNAVAILABLE",
          message,
          evidence: [],
          sources: [],
          flags: { gateway_status: res.status },
        });
        return {
          message,
          quickReplies: FALLBACK_QR,
          collectedSlots: {},
          sources: [],
          status: "SOURCE_UNAVAILABLE" as Status,
          evidence: [],
          requestId,
        };
      }

      const json = await res.json().catch(() => null);
      const choice = json?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls ?? [];

      if (!toolCalls.length) {
        const text = typeof choice?.content === "string" ? choice.content.trim() : "";
        const msg = text || "Sorry, kun je het anders verwoorden?";
        await logAudit({
          request_id: requestId,
          lang,
          question: lastUser,
          status: "NON_FACTUAL",
          message: msg,
          evidence: [],
          sources: [],
          flags: { no_tool_call: true },
        });
        return {
          message: msg,
          quickReplies: FALLBACK_QR,
          collectedSlots: {},
          sources: [],
          status: "NON_FACTUAL" as Status,
          evidence: [],
          requestId,
        };
      }

      convo.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });

      let sawReply: any = null;
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
        if (name === "checkAddress") {
          const result = executeCheckAddress(args);
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        } else if (name === "searchKnowledge") {
          searchAttempts++;
          const q = String(args?.query ?? "").trim().slice(0, 300);
          const result = q
            ? await searchKnowledgeWithStatus(q, 4)
            : { ok: true as const, hits: [] };
          if (!result.ok) sourceUnavailable = true;
          const hits = result.ok ? result.hits : [];
          for (const h of hits) {
            if (h?.source_url && URL_RE.test(h.source_url)) hitsByUrl.set(h.source_url, h);
          }
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: result.ok,
              hits: hits.map((h) => ({
                title: h.source_title,
                url: h.source_url,
                tier: h.source_tier,
                retrieved_at: h.fetched_at,
                similarity: Number(h.similarity.toFixed(3)),
                excerpt: h.content.slice(0, 800),
              })),
            }),
          });
        } else if (name === "replyStructured") {
          sawReply = args;
          convo.push({ role: "tool", tool_call_id: tc.id, content: "ok" });
        }
      }

      if (sawReply) {
        const modelStatus = (
          STATUSES as readonly string[]
        ).includes(sawReply.status)
          ? (sawReply.status as Status)
          : "INSUFFICIENT_EVIDENCE";
        let message =
          typeof sawReply.message === "string" ? sawReply.message.trim() : "";
        const evidence = sanitizeEvidence(sawReply.evidence, hitsByUrl);
        const looksFactual = FACTUAL_CLAIM_RE.test(message);

        // Server-side status override: model cannot lie its way to CONFIRMED.
        let status: Status = modelStatus;
        const flags: Record<string, unknown> = {
          search_attempts: searchAttempts,
          stale_evidence: evidence.some((e) => e.stale),
        };

        if (sourceUnavailable && evidence.length === 0 && looksFactual) {
          status = "SOURCE_UNAVAILABLE";
          message = lang === "en" ? SOURCE_UNAVAILABLE_EN : SOURCE_UNAVAILABLE_NL;
        } else if (looksFactual && evidence.length === 0) {
          status = "INSUFFICIENT_EVIDENCE";
          message = lang === "en" ? UNGROUNDED_FALLBACK_EN : UNGROUNDED_FALLBACK_NL;
        } else if (detectConflict(evidence)) {
          status = "MANUAL_REVIEW_REQUIRED";
          flags.conflict = true;
        } else if (looksFactual && evidence.length > 0) {
          status = "CONFIRMED";
        } else if (!looksFactual && evidence.length === 0) {
          status = "NON_FACTUAL";
        }

        if (flags.stale_evidence) {
          const note =
            lang === "en"
              ? "\n\n_Note: some sources are older than 6 months and may not reflect the latest publication._"
              : "\n\n_Let op: sommige bronnen zijn ouder dan 6 maanden en weerspiegelen mogelijk niet de laatste publicatie._";
          message += note;
        }

        const sources = evidence.map((e) => ({ title: e.dataset, url: e.url }));

        await logAudit({
          request_id: requestId,
          lang,
          question: lastUser,
          status,
          message,
          evidence,
          sources,
          flags,
        });

        return {
          message: message || "…",
          quickReplies: sanitizeQuickReplies(sawReply.quickReplies),
          collectedSlots: sanitizeSlots(sawReply.collectedSlots),
          sources,
          status,
          evidence,
          requestId,
        };
      }
    }

    const fallbackMsg = "Sorry, dat duurde te lang. Probeer het nog eens.";
    await logAudit({
      request_id: requestId,
      lang,
      question: lastUser,
      status: "SOURCE_UNAVAILABLE",
      message: fallbackMsg,
      evidence: [],
      sources: [],
      flags: { loop_exhausted: true },
    });
    return {
      message: fallbackMsg,
      quickReplies: FALLBACK_QR,
      collectedSlots: {},
      sources: [],
      status: "SOURCE_UNAVAILABLE" as Status,
      evidence: [],
      requestId,
    };
  });
