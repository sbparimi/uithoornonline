// Pricing switch.
//
// Uithoorn.online is free for everyone for now: the owner asked on Oct 29, 2026 to remove all pricing
// "until we get good traction". With the switch off (the default):
//   - no plan cards, prices, upgrade buttons or plan badges are shown anywhere;
//   - every business gets unlimited leads (no monthly cap, nothing is locked, no credits are used).
// The plan / subscription / credit tables and the admin payments ledger stay in place, dormant.
//
// To bring pricing back: set NEXT_PUBLIC_PRICING_ENABLED=true in Vercel (Production + Preview) and
// redeploy. NEXT_PUBLIC_ values are baked in at build time, so a rebuild is needed. Also review the
// pricing clauses in lib/legal/content.ts (users must be told in advance, see the terms).
export const PRICING_ENABLED = process.env.NEXT_PUBLIC_PRICING_ENABLED === 'true';

/** Anchor of the offer section on /voor-bedrijven: the plans (pricing on) or the free card (pricing off). */
export const BUSINESS_OFFER_ANCHOR = PRICING_ENABLED ? '#prijzen' : '#gratis';
