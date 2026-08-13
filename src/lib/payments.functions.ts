import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OriginSchema = z
  .string()
  .url()
  .max(300)
  .refine((v) => v.startsWith("http"), "invalid origin");

const AiSessionInput = z.object({
  question: z.string().max(2000).optional(),
  origin: OriginSchema,
});

const DossierInput = z.object({
  claimId: z.string().uuid().optional(),
  origin: OriginSchema,
});

const AI_SESSION_PRICE = 5;
const DOSSIER_PRICE = 5;

type PaymentStart =
  | { ok: true; id: string; checkoutUrl: string }
  | { ok: false; error: string };

export const createAiSessionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AiSessionInput.parse(input))
  .handler(async ({ data, context }): Promise<PaymentStart> => {
    if (!process.env.MOLLIE_API_KEY) {
      return { ok: false, error: "Payment provider not configured yet" };
    }

    const { data: row, error } = await context.supabase
      .from("ai_sessions")
      .insert({ user_id: context.userId, question: data.question ?? null, paid: false })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[payments] ai_session insert failed", error);
      return { ok: false, error: "Sessie kon niet worden aangemaakt." };
    }

    try {
      const { createMolliePayment } = await import("@/lib/payments.server");
      const payment = await createMolliePayment({
        amountEuros: AI_SESSION_PRICE,
        description: "Uithoorn AI-assistent sessie",
        redirectPath: `/?session=${row.id}`,
        origin: data.origin,
        metadata: { kind: "ai_session", id: row.id },
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("ai_sessions")
        .update({ mollie_payment_id: payment.id })
        .eq("id", row.id);

      if (!payment.checkoutUrl) return { ok: false, error: "Geen betaallink ontvangen." };
      return { ok: true, id: row.id, checkoutUrl: payment.checkoutUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Betaling mislukt.";
      return { ok: false, error: msg };
    }
  });

export const createDossierExportPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DossierInput.parse(input))
  .handler(async ({ data, context }): Promise<PaymentStart> => {
    if (!process.env.MOLLIE_API_KEY) {
      return { ok: false, error: "Payment provider not configured yet" };
    }

    const { data: row, error } = await context.supabase
      .from("dossier_exports")
      .insert({ user_id: context.userId, claim_id: data.claimId ?? null, paid: false })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[payments] dossier_export insert failed", error);
      return { ok: false, error: "Export kon niet worden aangemaakt." };
    }

    try {
      const { createMolliePayment } = await import("@/lib/payments.server");
      const payment = await createMolliePayment({
        amountEuros: DOSSIER_PRICE,
        description: "Uithoorn dossier PDF-export",
        redirectPath: data.claimId
          ? `/claim/success?id=${data.claimId}&export=${row.id}`
          : `/claim/success?export=${row.id}`,
        origin: data.origin,
        metadata: { kind: "dossier_export", id: row.id },
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("dossier_exports")
        .update({ mollie_payment_id: payment.id })
        .eq("id", row.id);

      if (!payment.checkoutUrl) return { ok: false, error: "Geen betaallink ontvangen." };
      return { ok: true, id: row.id, checkoutUrl: payment.checkoutUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Betaling mislukt.";
      return { ok: false, error: msg };
    }
  });

/** Poll-friendly status read for either paid feature. */
export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: z.enum(["ai_session", "dossier_export"]), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "ai_session" ? "ai_sessions" : "dossier_exports";
    const { data: row } = await context.supabase
      .from(table)
      .select("id, paid")
      .eq("id", data.id)
      .maybeSingle();
    return { paid: !!row?.paid };
  });
