import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

const priceEnv: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  pro_plus: process.env.STRIPE_PRO_PLUS_PRICE_ID,
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });

    const body = await request.json();
    const plan = String(body.plan || '');
    if (!['pro', 'pro_plus'].includes(plan)) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });

    const { data: business } = await supabase.from('businesses').select('id,name').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!business) return NextResponse.json({ error: 'business_required' }, { status: 403 });

    const secret = process.env.STRIPE_SECRET_KEY;
    const priceId = priceEnv[plan];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online';
    if (!secret || !priceId) return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 });

    const form = new URLSearchParams();
    form.set('mode', 'subscription');
    form.set('line_items[0][price]', priceId);
    form.set('line_items[0][quantity]', '1');
    form.set('success_url', `${siteUrl}/provider?billing=success`);
    form.set('cancel_url', `${siteUrl}/voor-bedrijven?billing=cancelled`);
    form.set('client_reference_id', business.id);
    form.set('customer_email', user.email || '');
    form.set('subscription_data[metadata][business_id]', business.id);
    form.set('subscription_data[metadata][plan_key]', plan);
    form.set('metadata[business_id]', business.id);
    form.set('metadata[plan_key]', plan);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      cache: 'no-store',
    });
    const session = await response.json();
    if (!response.ok || !session.url) {
      console.error('[billing] checkout creation failed', session?.error?.message || response.status);
      return NextResponse.json({ error: 'checkout_failed' }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing] checkout error', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'checkout_failed' }, { status: 500 });
  }
}
