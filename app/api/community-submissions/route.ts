import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

const kinds = new Set(['business', 'event', 'tip']);
function text(value: unknown, max = 2000) { return String(value ?? '').trim().slice(0, max); }

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const kind = text(body.kind, 20); const name = text(body.name, 120); const email = text(body.email, 180).toLowerCase();
    const title = text(body.title, 180); const description = text(body.description, 3000); const phone = text(body.phone, 40) || null;
    const category = text(body.category, 120) || null; const postcode = text(body.postcode, 20).toUpperCase() || null; const website = text(body.website, 500) || null; const eventDate = text(body.eventDate, 20) || null;
    if (!kinds.has(kind) || name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || title.length < 3 || description.length < 15) return NextResponse.json({ error: 'invalid_submission' }, { status: 400 });
    if (kind === 'event' && eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return NextResponse.json({ error: 'invalid_event_date' }, { status: 400 });
    const id = crypto.randomUUID();
    const supabase = await createClient();
    const { error } = await supabase.from('community_submissions').insert({ id, kind, name, email, phone, title, description, category, postcode, website, event_date: eventDate, status: 'pending' });
    if (error) return NextResponse.json({ error: 'submission_failed' }, { status: 500 });
    return NextResponse.json({ id, status: 'pending' }, { status: 201 });
  } catch { return NextResponse.json({ error: 'invalid_request' }, { status: 400 }); }
}
