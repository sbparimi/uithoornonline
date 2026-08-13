// Server-only Mollie helper. Never import from client code.
const MOLLIE_API = "https://api.mollie.com/v2";

export class PaymentConfigError extends Error {
  constructor() {
    super("Payment provider not configured yet");
    this.name = "PaymentConfigError";
  }
}

function apiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) throw new PaymentConfigError();
  return key;
}

export type MolliePayment = {
  id: string;
  status: string;
  checkoutUrl: string | null;
  metadata: Record<string, unknown> | null;
};

function parse(json: any): MolliePayment {
  return {
    id: String(json.id),
    status: String(json.status),
    checkoutUrl: json?._links?.checkout?.href ?? null,
    metadata: (json?.metadata as Record<string, unknown>) ?? null,
  };
}

/**
 * Creates a Mollie payment. `origin` must be the public site origin so Mollie
 * can redirect the user back and reach the webhook.
 */
export async function createMolliePayment(params: {
  amountEuros: number;
  description: string;
  redirectPath: string;
  origin: string;
  metadata?: Record<string, unknown>;
}): Promise<MolliePayment> {
  const key = apiKey();
  const body = {
    amount: { currency: "EUR", value: params.amountEuros.toFixed(2) },
    description: params.description.slice(0, 255),
    redirectUrl: new URL(params.redirectPath, params.origin).toString(),
    webhookUrl: new URL("/api/public/hooks/mollie-webhook", params.origin).toString(),
    metadata: params.metadata ?? {},
  };

  const res = await fetch(`${MOLLIE_API}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[mollie] create payment failed", res.status, detail.slice(0, 500));
    throw new Error("Betaling kon niet worden gestart. Probeer het later opnieuw.");
  }

  return parse(await res.json());
}

/** Verifies a payment's real status straight from Mollie. */
export async function verifyMolliePayment(paymentId: string): Promise<MolliePayment> {
  const key = apiKey();
  const res = await fetch(`${MOLLIE_API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[mollie] verify failed", res.status, detail.slice(0, 500));
    throw new Error("Betaalstatus kon niet worden opgehaald.");
  }
  return parse(await res.json());
}
