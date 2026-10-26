import 'server-only';

// Payments seam. Online checkout is intentionally OFF: Mollie (and Stripe) require a registered
// business (KvK number) before they open a merchant account. Until then plans are activated
// manually: the business contacts the owner via WhatsApp / the contact page, pays by bank
// transfer or Tikkie, and an admin sets the plan in /admin (business_subscriptions.payment_provider
// = 'manual').
//
// To add Mollie later:
//   1. npm i @mollie/api-client; set MOLLIE_API_KEY (test_… for preview, live_… for production).
//   2. Implement `MolliePaymentProvider` below: createCheckout → mollie.customers.create +
//      payments.create({ sequenceType: 'first', method: 'ideal', … }) → redirect to _links.checkout;
//      the webhook (app/api/billing/webhook) fetches the payment by id, then creates the
//      subscription and upserts business_subscriptions (payment_provider = 'mollie').
//   3. Set PAYMENTS_PROVIDER=mollie. Issue invoices with 21% BTW (or note the KOR exemption)
//      through the bookkeeping tool (e.g. Moneybird) and call notify('payment', …).

export type CheckoutRequest = { businessId: string; planKey: 'pro' | 'pro_plus'; email: string; returnUrl: string };
export interface PaymentProvider {
  readonly name: 'mollie' | 'stripe';
  createCheckout(input: CheckoutRequest): Promise<{ checkoutUrl: string }>;
  handleWebhook(request: Request): Promise<{ businessId: string; planKey: string; status: string } | null>;
}

export function getPaymentProvider(): PaymentProvider | null {
  // No provider is wired yet. Return the Mollie implementation here once it exists.
  return null;
}

export function paymentsEnabled() {
  return getPaymentProvider() !== null;
}
