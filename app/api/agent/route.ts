import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

const specialists = [
  { key: 'cleaning', name: 'Cleaner Agent', label: 'Schoonmaak specialist', terms: ['schoon', 'poets', 'clean', 'huishoud'] },
  { key: 'garden', name: 'Garden Agent', label: 'Tuin specialist', terms: ['tuin', 'gras', 'heg', 'bestrating', 'plant'] },
  { key: 'transport', name: 'Transport Agent', label: 'Transport specialist', terms: ['verhuis', 'transport', 'bezorg', 'vervoer', 'meubel'] },
  { key: 'home', name: 'Home Agent', label: 'Wonen & klus specialist', terms: ['loodgieter', 'elektr', 'schilder', 'klus', 'repar', 'renovat', 'dak', 'install'] },
  { key: 'food', name: 'Food Agent', label: 'Food specialist', terms: ['eten', 'food', 'catering', 'biryani', 'dosa', 'restaurant', 'maaltijd'] },
] as const;

function resolveSpecialist(message: string) {
  const value = message.toLowerCase();
  return specialists.find((specialist) => specialist.terms.some((term) => value.includes(term))) ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || '').trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: 'invalid_message' }, { status: 400 });

    const specialist = resolveSpecialist(message);
    if (!specialist) {
      return NextResponse.json({
        intent: null,
        specialist: null,
        providers: [],
        reply: 'Ik wil dit voor je regelen. Vertel kort wat er moet gebeuren en in welke plaats of postcode.',
      });
    }

    const supabase = await createClient();
    const { data: providers, error } = await supabase
      .from('businesses')
      .select('id,name,category,description,postcode,phone,website,verified')
      .eq('active', true)
      .eq('verified', true)
      .ilike('category', `%${specialist.key === 'cleaning' ? 'clean' : specialist.key}%`)
      .limit(5);

    if (error) return NextResponse.json({ error: 'business_lookup_failed' }, { status: 500 });

    return NextResponse.json({
      intent: specialist.key,
      specialist: { name: specialist.name, label: specialist.label },
      providers: providers ?? [],
      reply: providers?.length
        ? `${specialist.name} is actief. Ik heb ${providers.length} geverifieerde lokale aanbieder${providers.length === 1 ? '' : 's'} gevonden. Ik heb nog je locatie en gewenste moment nodig om de aanvraag gericht verder te brengen.`
        : `${specialist.name} is actief. Ik heb op dit moment nog geen geverifieerde aanbieder in deze categorie gevonden. Ik kan eerst je locatie en gewenste moment vastleggen.`,
    });
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}
