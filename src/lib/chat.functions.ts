import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
});

const ALLOWED_ROUTES = ["/check", "/claim", "/log", "/map"] as const;

const SYSTEM_PROMPT = `Je bent "Uithoorn Online", een vriendelijke Nederlandse assistent die UITSLUITEND helpt met:
- Schiphol-geluidsoverlast in Uithoorn en omliggende postcodes (1420-1424)
- Controle of een adres in de overschrijdingszone ligt
- Uitleg over compensatie en het claimproces (€150 - €2.200 per jaar)
- Het melden / loggen van geluidsoverlast
- De geluidskaart van de regio

REGELS:
1. Antwoord ALTIJD in het Nederlands, warm en kort (max 3 zinnen per bericht).
2. Wijk NOOIT af van bovenstaande onderwerpen. Bij off-topic vragen: weiger vriendelijk en stuur terug naar Schiphol-overlast.
3. BIED GEEN claim direct aan — leg eerst het claimproces uit (kort) en stuur de gebruiker pas DAARNA door naar het formulier met de quick-reply "route:/claim".
4. Verzamel slot-entiteiten conversationeel, één tegelijk: naam → adres → postcode → email → telefoon. Sla over wat al verzameld is.
5. ZEG NOOIT "ik controleer..." of "ik ga kijken..." zonder direct de checkAddress-tool aan te roepen. Als je een postcode hebt, ROEP de checkAddress-tool aan en geef daarna pas via 'reply' het resultaat. Combineer dus tool-aanroep + reply in dezelfde beurt.
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
      "Controleer of een postcode (en optioneel huisnummer) in de Uithoorn-overschrijdingszone ligt. Roep deze tool DIRECT aan zodra je een postcode hebt — niet aankondigen, gewoon doen.",
    parameters: {
      type: "object",
      properties: {
        postcode: { type: "string", description: "4-cijferige Nederlandse postcode, bv. 1422" },
        houseNumber: { type: "string", description: "Huisnummer, optioneel" },
      },
      required: ["postcode"],
      additionalProperties: false,
    },
  },
};

const replyTool = {
  type: "function" as const,
  function: {
    name: "reply",
    description: "Stuur het uiteindelijke antwoord aan de gebruiker met quick-replies.",
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
            properties: {
              label: { type: "string" },
              action: { type: "string" },
            },
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

function executeCheckAddress(args: { postcode?: string; houseNumber?: string }) {
  const raw = String(args.postcode ?? "").trim();
  const m = raw.match(/\d{4}/);
  if (!m) {
    return { ok: false, reason: "invalid_postcode", message: "Geen geldige 4-cijferige postcode." };
  }
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
      ? `Postcode ${m[0]} ligt IN de Schiphol-overschrijdingszone. De bewoner heeft mogelijk recht op €150-€2.200 per jaar compensatie.`
      : `Postcode ${m[0]} ligt BUITEN de overschrijdingszone (zone is 1420-1424). Geen directe compensatie-aanspraak.`,
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
      };
    }

    const trimmed =
      data.messages.length > 20 ? [data.messages[0], ...data.messages.slice(-19)] : data.messages;

    const slotsContext =
      data.slots && Object.keys(data.slots).length
        ? `\n\nReeds verzamelde gegevens (NIET opnieuw vragen): ${JSON.stringify(data.slots)}`
        : "\n\nNog geen gegevens verzameld.";

    // Multi-step tool loop: model may call checkAddress, then must call reply.
    const convo: any[] = [
      { role: "system", content: SYSTEM_PROMPT + slotsContext },
      ...trimmed,
    ];

    for (let step = 0; step < 3; step++) {
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
            tools: [checkAddressTool, replyTool],
            tool_choice: "required",
          }),
        });
      } catch (e) {
        console.error("AI gateway fetch failed", e);
        return {
          message: "Sorry, ik kan even geen verbinding maken. Probeer het zo opnieuw.",
          quickReplies: FALLBACK_QR,
          collectedSlots: {},
        };
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("AI gateway error", res.status, text);
        const message =
          res.status === 429
            ? "Even geduld — te veel aanvragen. Probeer het zo opnieuw."
            : res.status === 402
              ? "De assistent heeft tijdelijk geen credits. Probeer het later opnieuw."
              : "Sorry, ik kan nu even niet antwoorden.";
        return { message, quickReplies: FALLBACK_QR, collectedSlots: {} };
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
        };
      }

      // Push assistant turn with tool_calls into convo
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
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } else if (name === "reply") {
          sawReply = args;
          convo.push({
            role: "tool",
            tool_call_id: tc.id,
            content: "ok",
          });
        }
      }

      if (sawReply) {
        const message =
          typeof sawReply.message === "string" ? sawReply.message.trim() : "";
        return {
          message: message || "…",
          quickReplies: sanitizeQuickReplies(sawReply.quickReplies),
          collectedSlots: sanitizeSlots(sawReply.collectedSlots),
        };
      }
      // else: only checkAddress was called → loop again so the model can reply
    }

    return {
      message: "Sorry, dat duurde te lang. Probeer het nog eens.",
      quickReplies: FALLBACK_QR,
      collectedSlots: {},
    };
  });
