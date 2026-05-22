import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  slots: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
      postcode: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `Je bent "Uithoorn Online", een vriendelijke Nederlandse assistent die uitsluitend helpt met:
- Schiphol-geluidsoverlast in Uithoorn en omliggende postcodes (1420-1424)
- Controle of een adres in de overschrijdingszone ligt
- Uitleg over compensatie en het claimproces (€150 - €2.200 per jaar)
- Het melden / loggen van geluidsoverlast
- De geluidskaart van de regio

REGELS:
1. Antwoord ALTIJD in het Nederlands, warm en kort (max 3 zinnen per bericht).
2. Wijk NOOIT af van bovenstaande onderwerpen. Bij off-topic vragen: weiger vriendelijk en stuur terug naar Schiphol-overlast.
3. BIED GEEN claim direct aan — leg eerst het claim-process uit en stuur de gebruiker door naar het formulier via de quick-reply met action "route:/claim".
4. Verzamel slot-entiteiten conversationeel (één tegelijk): naam, adres, postcode, email, telefoon. Vraag alleen wat relevant is voor de huidige stap.
5. Geef ALTIJD 2-4 quick-replies passend bij de context.

ACTIE-TYPES voor quick-replies:
- "route:/check"  → adres-check formulier
- "route:/claim"  → claim-formulier (alleen NA uitleg van het proces)
- "route:/log"    → geluid-melden formulier
- "route:/map"    → geluidskaart
- "ask:<vraag>"   → stuur die tekst als volgende user-vraag

ANTWOORD STRICT in dit JSON-formaat:
{
  "message": "tekst in het Nederlands (markdown toegestaan)",
  "quickReplies": [{ "label": "kort label", "action": "route:/check | ask:..." }],
  "collectedSlots": { "postcode": "...", "email": "...", ... }
}

collectedSlots: alleen velden toevoegen die je in deze beurt nieuw uit de gebruiker hebt gehaald.`;

export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        message: "De AI-assistent is nog niet geconfigureerd.",
        quickReplies: [
          { label: "Check mijn adres", action: "route:/check" },
          { label: "Geluid melden", action: "route:/log" },
        ],
        collectedSlots: {},
      };
    }

    const slotsContext = data.slots && Object.keys(data.slots).length
      ? `\n\nReeds verzamelde gegevens: ${JSON.stringify(data.slots)}`
      : "";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT + slotsContext },
          ...data.messages,
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      return {
        message:
          res.status === 429
            ? "Even geduld — te veel aanvragen. Probeer het zo opnieuw."
            : "Sorry, ik kan nu even niet antwoorden. Probeer het later opnieuw.",
        quickReplies: [
          { label: "Check mijn adres", action: "route:/check" },
          { label: "Geluid melden", action: "route:/log" },
        ],
        collectedSlots: {},
      };
    }

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw);
      return {
        message: String(parsed.message ?? ""),
        quickReplies: Array.isArray(parsed.quickReplies)
          ? parsed.quickReplies
              .filter((q: any) => q && typeof q.label === "string" && typeof q.action === "string")
              .slice(0, 4)
          : [],
        collectedSlots:
          parsed.collectedSlots && typeof parsed.collectedSlots === "object"
            ? parsed.collectedSlots
            : {},
      };
    } catch {
      return {
        message: raw || "…",
        quickReplies: [],
        collectedSlots: {},
      };
    }
  });
