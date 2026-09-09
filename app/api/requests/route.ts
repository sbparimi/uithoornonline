import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

function money(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'customer') return NextResponse.json({ error: 'customer_required' }, { status: 403 });
  const body = await request.json();
  const category = String(body.category || '').trim(); const description = String(body.description || '').trim();
  const postcode = String(body.postcode || '').trim().toUpperCase(); const preferredTiming = String(body.preferredTiming || '').trim();
  const urgency = String(body.urgency || '').trim(); const budgetMin = money(body.budgetMin); const budgetMax = money(body.budgetMax);
  if (!category || description.length < 10 || !postcode || !preferredTiming || !urgency || (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin)) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const { data, error } = await supabase.from('service_requests').insert({ customer_id: user.id, category, description, postcode, preferred_timing: preferredTiming, urgency, budget_min: budgetMin, budget_max: budgetMax }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { data: matched, error: matchError } = await supabase.rpc('match_service_request', { p_request_id: data.id });
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });
  return NextResponse.json({ id: data.id, matched: matched ?? 0, status: matched ? 'matched' : 'open' }, { status: 201 });
}
