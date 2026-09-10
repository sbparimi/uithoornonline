import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    if (!business) return NextResponse.json({ error: 'business_required' }, { status: 403 });
    const { data: subscription } = await supabase.from('business_subscriptions').select('stripe_customer_id').eq('business_id', business.id).maybeSingle();
    if (!subscription?.stripe_customer_id || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'billing_not_configured' }, { status: 503 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://uithoorn.online';
    const form = new URLSearchParams({ customer: subscription.stripe_customer_id, return_url: `${siteUrl}/provider` });
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      cache: 'no-store',
    });
    const session = await response.json();
    if (!response.ok || !session.url) return NextResponse.json({ error: 'portal_failed' }, { status: 502 });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[billing] portal error', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'portal_failed' }, { status: 500 });
  }
}
