import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runAgentGraph } from "@/lib/agent-graph.server";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  slots: z.object({
    name: z.string().max(120).optional(),
    address: z.string().max(200).optional(),
    postcode: z.string().max(10).optional(),
    email: z.string().max(160).optional(),
    phone: z.string().max(40).optional(),
  }).optional(),
  lang: z.enum(["nl", "en"]).optional(),
});

/**
 * Last-mile language guard for the public launch. It prevents the UI from
 * accidentally presenting an internal dossier as an official submission or
 * Uithoorn Online as the authority deciding entitlement.
 */
function applyLaunchSafety(message: string, lang: "nl" | "en"): string {
  let out = message;
  if (lang === "nl") {
    out = out
      .replace(/claim ingediend/gi, "dossier opgeslagen")
      .replace(/claim is ingediend/gi, "dossier is opgeslagen")
      .replace(/uw claim is ingediend/gi, "uw dossier is opgeslagen")
      .replace(/je claim is ingediend/gi, "je dossier is opgeslagen")
      .replace(/claim indienen/gi, "dossier voorbereiden")
      .replace(/claim starten/gi, "dossier voorbereiden")
      .replace(/u heeft recht op compensatie/gi, "uw recht op compensatie is hier niet vastgesteld")
      .replace(/je hebt recht op compensatie/gi, "je recht op compensatie is hier niet vastgesteld")
      .replace(/u komt in aanmerking voor compensatie/gi, "of u in aanmerking komt voor compensatie is hier niet vastgesteld")
      .replace(/je komt in aanmerking voor compensatie/gi, "of je in aanmerking komt voor compensatie is hier niet vastgesteld");
  } else {
    out = out
      .replace(/claim submitted/gi, "dossier saved")
      .replace(/file a compensation claim/gi, "prepare a dossier")
      .replace(/filing a compensation claim/gi, "preparing a dossier")
      .replace(/you are entitled to compensation/gi, "your entitlement to compensation has not been determined here")
      .replace(/you qualify for compensation/gi, "whether you qualify for compensation has not been determined here");
  }
  return out;
}

export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const lang = data.lang ?? "nl";
    const result = await runAgentGraph({
      messages: data.messages,
      slots: data.slots ?? {},
      lang,
    });
    return { ...result, message: applyLaunchSafety(result.message, lang) };
  });
