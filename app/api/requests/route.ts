import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

function money(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function validPostcode(value: string) { return /^\d{4}\s?[A-Z]{2}$/i.test(value); }

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'customer') return NextResponse.json({ error: 'customer_required' }, { status: 403 });

    const body = await request.json();
    const category = String(body.category || '').trim(); const description = String(body.description || '').trim();
    const postcode = String(body.postcode || '').trim().toUpperCase(); const preferredTiming = String(body.preferredTiming || '').trim();
    const urgency = String(body.urgency || '').trim(); const budgetMin = money(body.budgetMin); const budgetMax = money(body.budgetMax);
    if (!category || description.length < 10 || !validPostcode(postcode) || !preferredTiming || !urgency || (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin)) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const { data, error } = await supabase.from('service_requests').insert({ customer_id: user.id, category, description, postcode, preferred_timing: preferredTiming, urgency, budget_min: budgetMin, budget_max: budgetMax }).select('id').single();
    if (error || !data) {
      console.error('[requests] insert failed', { code: error?.code, message: error?.message });
      return NextResponse.json({ error: 'request_save_failed' }, { status: 500 });
    }

    const { data: matched, error: matchError } = await supabase.rpc('match_service_request', { p_request_id: data.id });
    if (matchError) {
      // The customer's request is already saved. Do not report a false failure because matching can be retried later.
      console.error('[requests] matching failed after save', { requestId: data.id, code: matchError.code, message: matchError.message });
      return NextResponse.json({ id: data.id, matched: 0, status: 'open' }, { status: 201 });
    }
    return NextResponse.json({ id: data.id, matched: matched ?? 0, status: matched ? 'matched' : 'open' }, { status: 201 });
  } catch (error) {
    console.error('[requests] request failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'request_save_failed' }, { status: 500 });
  }
}
