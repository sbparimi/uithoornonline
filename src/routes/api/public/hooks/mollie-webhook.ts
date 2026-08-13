import { createFileRoute } from "@tanstack/react-router";

/**
 * Mollie payment webhook. Mollie POSTs `id=tr_xxx` (form encoded) and never
 * sends the status itself — we must verify by calling Mollie's API.
 */
export const Route = createFileRoute("/api/public/hooks/mollie-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let paymentId = "";
        try {
          const body = await request.text();
          paymentId = new URLSearchParams(body).get("id") ?? "";
        } catch {
          paymentId = "";
        }
        if (!paymentId || !/^tr_[A-Za-z0-9]+$/.test(paymentId)) {
          return new Response("bad request", { status: 400 });
        }

        try {
          const { verifyMolliePayment } = await import("@/lib/payments.server");
          const payment = await verifyMolliePayment(paymentId);
          if (payment.status !== "paid") return new Response("ok");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const kind = payment.metadata?.["kind"];
          const table =
            kind === "dossier_export"
              ? "dossier_exports"
              : kind === "ai_session"
                ? "ai_sessions"
                : null;

          if (table) {
            await supabaseAdmin.from(table).update({ paid: true }).eq("mollie_payment_id", payment.id);
          } else {
            // metadata missing: try both tables by payment id
            await supabaseAdmin
              .from("ai_sessions")
              .update({ paid: true })
              .eq("mollie_payment_id", payment.id);
            await supabaseAdmin
              .from("dossier_exports")
              .update({ paid: true })
              .eq("mollie_payment_id", payment.id);
          }
          return new Response("ok");
        } catch (e) {
          console.error("[mollie-webhook] failed", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
