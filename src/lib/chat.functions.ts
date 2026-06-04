import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchKnowledge } from "@/lib/knowledge.server";

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

const SYSTEM_PROMPT = `Je bent "Uithoorn Online", een vriendelijke Nederlandse assistent die UITSLUITEND helpt met:
- Schiphol-geluidsoverlast in Uithoorn en omliggende postcodes
- Controle of een adres in het Uithoorn-gebied ligt (postcodes 1421-1424 = Uithoorn / De Kwakel; dit is een POSTALE controle, GEEN claim-belofte)
- Uitleg over hoe het klacht- en compensatieproces formeel werkt (procedure, instanties, formulieren)
- Het melden / loggen van geluidsoverlast
- De geluidskaart van de regio

ABSOLUTE FEITELIJKHEIDSREGELS (overtreden = fout):
A. Noem GEEN bedragen, percentages, datums, deadlines, namen van regelingen, kamerstuknummers, wetsartikelen, geluidsniveaus (dB, Lden, Lnight), aantallen vluchten, of contactgegevens — TENZIJ deze letterlijk uit een searchKnowledge-resultaat van DEZE beurt komen, met bijbehorende source-URL in 'sources'.
B. Verzin NOOIT URLs, telefoonnummers, e-mailadressen of formulier-namen.
C. Als searchKnowledge leeg is of similarity te laag, zeg EXPLICIET: "Daar heb ik geen geverifieerde bron voor. Kijk op bezoekbas.nl of schiphol.nl voor actuele cijfers." Geef GEEN getallen of regelingsnamen uit je eigen geheugen.
D. Bij vragen over "hoeveel krijg ik?" / "wanneer?" / "hoe hoog is de vergoeding?" / officiële procedures / wetgeving / nieuws: ALTIJD eerst searchKnowledge aanroepen. Antwoord pas daarna, en uitsluitend met info die in de hits staat.
E. Parafraseer kort, citeer geen lange tekst. Vermeld na een feitelijke uitspraak de bron via 'sources'.

CONVERSATIEREGELS:
1. Antwoord in het Nederlands (tenzij LANGUAGE OVERRIDE actief), warm en kort (max 3 zinnen).
2. Wijk NOOIT af van bovenstaande scope. Off-topic = vriendelijk weigeren.
3. BIED GEEN claim direct aan — leg eerst kort het proces uit (uit RAG-bronnen) en stuur de gebruiker daarna door naar het formulier via "route:/claim".
4. Verzamel slot-entiteiten conversationeel, één tegelijk: naam → adres → postcode → email → telefoon. Sla over wat al verzameld is.
5. Postcode-controle: zodra je een postcode hebt, roep DIRECT checkAddress aan. Niet aankondigen. De tool zegt alleen of de postcode bij Uithoorn hoort — NIET dat er compensatie komt.
6. Geef ALTIJD 2-4 quick-replies passend bij de context.
7. collectedSlots: alleen velden die je in DEZE beurt nieuw uit de gebruiker hebt afgeleid.

ACTIE-TYPES voor quick-replies:
- "route:/check" | "route:/claim" | "route:/log" | "route:/map"
- "ask:<vraag>"`;

const checkAddressTool = {
  type: "function" as const,
  function: {
    name: "checkAddress",
    description:
      "Controleer of een postcode in de Uithoorn-overschrijdingszone ligt. Roep DIRECT aan zodra je een postcode hebt.",
    parameters: {
      type: "object",
      properties: {
        postcode: { type: "string", description: "4-cijferige postcode, bv. 1422" },
        houseNumber: { type: "string", description: "Huisnummer, optioneel" },
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
      "Zoek in de geverifieerde kennisbank (BAS, Schiphol, ILT, Gemeente Uithoorn, recent nieuws). VERPLICHT te gebruiken voor elke feitelijke claim over organisaties, regelingen, procedures of nieuws.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Korte zoekvraag in het Nederlands." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

const replyTool = {
  type: "function" as const,
  function: {
    name: "reply",
    description:
      "Stuur het uiteindelijke antwoord. Geef sources mee wanneer je searchKnowledge-resultaten gebruikt.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string" },
        quickReplies: {
          type: "array",
          minItems: 0,
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
        sources: {
          type: "array",
          maxItems: 4,
          description: "Bronnen die je in deze beurt gebruikt hebt (van searchKnowledge).",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
            },
            required: ["title", "url"],
            additionalProperties: false,
          },
        },
      },
      required: ["message", "quickReplies"],
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

function sanitizeSources(input: unknown) {
  if (!Array.isArray(input)) return [] as { title: string; url: string }[];
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const s of input) {
    if (
      !s ||
      typeof (s as { url?: unknown }).url !== "string" ||
      typeof (s as { title?: unknown }).title !== "string"
    )
      continue;
    const url = (s as { url: string }).url.trim();
    const title = (s as { title: string }).title.trim().slice(0, 120);
    if (!URL_RE.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: title || url, url });
    if (out.length >= 4) break;
  }
  return out;
}

function executeCheckAddress(args: { postcode?: string; houseNumber?: string }) {
  const raw = String(args.postcode ?? "").trim();
  const m = raw.match(/\d{4}/);
  if (!m) return { ok: false, reason: "invalid_postcode", message: "Geen geldige postcode." };
  const num = parseInt(m[0], 10);
  const inZone = num >= 1420 && num <= 1424;
  return {
    ok: true,
    postcode: m[0],
    houseNumber: args.houseNumber ?? null,
    inZone,
    zoneRange: "1420-1424",
    estimatedCompensation: inZone ? { minEur: 150, maxEur: 2200, period: "per jaar" } : null,
    message: inZone
      ? `Postcode ${m[0]} ligt IN de Schiphol-overschrijdingszone (€150-€2.200 per jaar mogelijk).`
      : `Postcode ${m[0]} ligt BUITEN de zone (1420-1424).`,
  };
}

async function executeSearchKnowledge(args: { query?: string }) {
  const q = String(args.query ?? "").trim().slice(0, 300);
  if (!q) return { ok: false, hits: [] };
  const hits = await searchKnowledge(q, 4);
  return {
    ok: true,
    hits: hits.map((h) => ({
      title: h.source_title,
      url: h.source_url,
      type: h.source_type,
      similarity: Number(h.similarity.toFixed(3)),
      excerpt: h.content.slice(0, 800),
    })),
  };
}

export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        message: "De AI-assistent is nog niet geconfigureerd.",
        quickReplies: FALLBACK_QR,
        collectedSlots: {} as Record<string, string>,
        sources: [] as { title: string; url: string }[],
      };
    }

    const trimmed =
      data.messages.length > 20 ? [data.messages[0], ...data.messages.slice(-19)] : data.messages;

    const slotsContext =
      data.slots && Object.keys(data.slots).length
        ? `\n\nReeds verzamelde gegevens (NIET opnieuw vragen): ${JSON.stringify(data.slots)}`
        : "\n\nNog geen gegevens verzameld.";

    const lang = data.lang ?? "nl";
    const langDirective =
      lang === "en"
        ? "\n\nLANGUAGE OVERRIDE: Reply in ENGLISH. Keep the same scope, tone and rules. Quick-reply labels must also be in English."
        : "\n\nTAAL: Antwoord in het Nederlands.";

    const convo: any[] = [
      { role: "system", content: SYSTEM_PROMPT + slotsContext + langDirective },
      ...trimmed,
    ];

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
            tools: [checkAddressTool, searchKnowledgeTool, replyTool],
            tool_choice: "required",
          }),
        });
      } catch (e) {
        console.error("AI gateway fetch failed", e);
        return {
          message: "Sorry, ik kan even geen verbinding maken. Probeer het zo opnieuw.",
          quickReplies: FALLBACK_QR,
          collectedSlots: {},
          sources: [],
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
              : "Sorry, ik kan nu even niet antwoorden.";
        return { message, quickReplies: FALLBACK_QR, collectedSlots: {}, sources: [] };
      }

      const json = await res.json().catch(() => null);
      const choice = json?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls ?? [];

      if (!toolCalls.length) {
        const text = typeof choice?.content === "string" ? choice.content.trim() : "";
        return {
          message: text || "Sorry, ik begreep dat niet helemaal. Kun je het anders verwoorden?",
          quickReplies: FALLBACK_QR,
          collectedSlots: {},
          sources: [],
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
          const result = await executeSearchKnowledge(args);
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        } else if (name === "reply") {
          sawReply = args;
          convo.push({ role: "tool", tool_call_id: tc.id, content: "ok" });
        }
      }

      if (sawReply) {
        const message = typeof sawReply.message === "string" ? sawReply.message.trim() : "";
        return {
          message: message || "…",
          quickReplies: sanitizeQuickReplies(sawReply.quickReplies),
          collectedSlots: sanitizeSlots(sawReply.collectedSlots),
          sources: sanitizeSources(sawReply.sources),
        };
      }
    }

    return {
      message: "Sorry, dat duurde te lang. Probeer het nog eens.",
      quickReplies: FALLBACK_QR,
      collectedSlots: {},
      sources: [],
    };
  });
