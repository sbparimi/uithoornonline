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
4. Verzamel slot-entiteiten conversationeel, één tegelijk: naam → adres → postcode → email → telefoon. Sla over wat al verzameld is. Vraag alleen wat relevant is voor de huidige stap.
5. Postcode MOET tussen 1420 en 1424 liggen — anders meld je dat het adres buiten de zone ligt.
6. Geef ALTIJD 2-4 quick-replies passend bij de context.
7. collectedSlots: alleen velden invullen die je in DEZE beurt nieuw uit de gebruiker hebt afgeleid; laat anderen weg.

ACTIE-TYPES voor quick-replies (action veld):
- "route:/check"  → adres-check formulier
- "route:/claim"  → claim-formulier (alleen NÁ uitleg van het proces)
- "route:/log"    → geluid-melden formulier
- "route:/map"    → geluidskaart
- "ask:<vraag>"   → stuur die tekst als volgende user-vraag`;

const replyTool = {
  type: "function" as const,
  function: {
    name: "reply",
    description: "Antwoord aan de gebruiker met optionele quick-replies en verzamelde gegevens.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Nederlandse tekst voor de gebruiker (markdown toegestaan, max 3 zinnen).",
        },
        quickReplies: {
          type: "array",
          minItems: 0,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              action: {
                type: "string",
                description:
                  "Eén van: route:/check, route:/claim, route:/log, route:/map, of ask:<tekst>",
              },
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

// Validators for sloppy LLM slot extraction
const POSTCODE_RE = /\b(142[0-4])\s?[A-Z]{0,2}\b/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;

function sanitizeSlots(input: Record<string, unknown> | undefined) {
  const out: Record<string, string> = {};
  if (!input) return out;
  if (typeof input.name === "string" && input.name.trim().length >= 2)
    out.name = input.name.trim().slice(0, 120);
  if (typeof input.address === "string" && input.address.trim().length >= 4)
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

    // Trim history: always keep first user message + last 18 turns to stay under context.
    const trimmed =
      data.messages.length > 20
        ? [data.messages[0], ...data.messages.slice(-19)]
        : data.messages;

    const slotsContext =
      data.slots && Object.keys(data.slots).length
        ? `\n\nReeds verzamelde gegevens (NIET opnieuw vragen): ${JSON.stringify(data.slots)}`
        : "\n\nNog geen gegevens verzameld.";

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
          messages: [
            { role: "system", content: SYSTEM_PROMPT + slotsContext },
            ...trimmed,
          ],
          tools: [replyTool],
          tool_choice: { type: "function", function: { name: "reply" } },
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
            : "Sorry, ik kan nu even niet antwoorden. Probeer het later opnieuw.";
      return { message, quickReplies: FALLBACK_QR, collectedSlots: {} };
    }

    const json = await res.json().catch(() => null);
    const choice = json?.choices?.[0]?.message;
    const toolCall = choice?.tool_calls?.[0];
    const rawArgs = toolCall?.function?.arguments;

    let parsed: any = null;
    if (typeof rawArgs === "string") {
      try {
        parsed = JSON.parse(rawArgs);
      } catch {
        parsed = null;
      }
    } else if (rawArgs && typeof rawArgs === "object") {
      parsed = rawArgs;
    }

    // Fallback: model returned plain text instead of using the tool
    if (!parsed) {
      const text = typeof choice?.content === "string" ? choice.content.trim() : "";
      return {
        message: text || "Sorry, ik begreep dat niet helemaal. Kun je het anders verwoorden?",
        quickReplies: FALLBACK_QR,
        collectedSlots: {},
      };
    }

    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    return {
      message: message || "…",
      quickReplies: sanitizeQuickReplies(parsed.quickReplies),
      collectedSlots: sanitizeSlots(parsed.collectedSlots),
    };
  });
