import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

function verifySignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(',').map(part => part.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  if (!verifySignature(payload, signature, secret)) return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });

  try {
    const event = JSON.parse(payload);
    const object = event.data?.object || {};
    const metadata = object.metadata || {};
    const businessId = metadata.business_id;
    if (!businessId) return NextResponse.json({ received: true });

    const supabase = await createClient();
    const planKey = metadata.plan_key || (object.items?.data?.[0]?.price?.metadata?.plan_key ?? 'pro');
    const statusMap: Record<string, string> = {
      active: 'active', trialing: 'trialing', past_due: 'past_due', incomplete: 'incomplete', canceled: 'cancelled', unpaid: 'past_due',
    };

    if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
      await supabase.from('business_subscriptions').upsert({
        business_id: businessId,
        plan_key: ['free','pro','pro_plus'].includes(planKey) ? planKey : 'pro',
        status: statusMap[object.status] || 'active',
        stripe_customer_id: object.customer || null,
        stripe_subscription_id: object.subscription || object.id || null,
        current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id' });
    }

    if (event.type === 'customer.subscription.deleted') {
      await supabase.from('business_subscriptions').update({ plan_key: 'free', status: 'cancelled', current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null, updated_at: new Date().toISOString() }).eq('business_id', businessId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[billing] webhook error', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'webhook_failed' }, { status: 500 });
  }
}
