import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { kimiChat } from '../../../lib/kimi';
import { searchVerifiedProviders, type AgentProvider } from '../../../lib/supabase/agent';
import { loadAgentState, saveAgentState } from '../../../lib/agent/session';
import { buildProviderQuery, DEFAULT_AGENT_STATE, deriveAgentState, stateContext, type AgentState } from '../../../lib/agent/state';
import { specialistContext } from '../../../lib/agent/specialists';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SYSTEM_PROMPT = `Je bent Uithoorn AI, de lokale AI-assistent van Uithoorn.online voor inwoners van Uithoorn en De Kwakel.

De gestructureerde agent state is de bron van waarheid voor bekende context. Werk taakgericht en neem context mee over meerdere beurten.

REGELS:
- Uithoorn is de standaardlocatie als de gebruiker geen andere locatie noemt.
- Vraag NIET opnieuw naar locatie of postcode als de state al een locatie bevat.
- Een postcode is een geografische aanwijzing, geen vereiste exacte match met het postcodeveld van een provider.
- Behoud intent, voorkeuren, locatie en taakcontext over meerdere beurten.
- Indian food, Indiaas eten, dosa, idli, vada en biryani betekenen Indian food.
- Gebruik uitsluitend meegeleverde geverifieerde providergegevens voor actuele lokale bedrijfsfeiten. Verzin nooit bedrijven, prijzen, openingstijden of beschikbaarheid.
- Als een provider alleen afhalen aanbiedt, bied geen bezorging aan alsof dat beschikbaar is.
- Bij een bestelintentie: werk naar uitvoering en vraag alleen het eerstvolgende noodzakelijke gegeven.
- Antwoord in dezelfde taal als de gebruiker. Meng Nederlands en Engels niet.
- Noem nooit interne architectuur, agents, tools, routing of modellen.
- Houd antwoorden kort, concreet en actiegericht.`;

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { role?: unknown; content?: unknown; text?: unknown } => Boolean(item && typeof item === 'object'))
    .map((item): ChatMessage => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content ?? item.text ?? '').trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-16);
}

function formatProviderContext(providers: AgentProvider[]): string {
  if (!providers.length) return 'GEVERIFIEERDE PROVIDERS: geen passende provider gevonden voor de huidige taak en locatie.';
  return `GEVERIFIEERDE PROVIDERS:\n${providers.map((provider) => JSON.stringify({
    id: provider.id,
    name: provider.name,
    category: provider.category,
    summary: provider.agent_summary,
    description: provider.description,
    postcode: provider.postcode,
    service_areas: provider.service_areas,
    capabilities: provider.capabilities,
    availability: provider.availability,
    pricing: provider.pricing,
    phone: provider.phone,
    website: provider.website,
    source_url: provider.source_url,
    verified_at: provider.verified_at,
  })).join('\n')}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || '').trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: 'invalid_message' }, { status: 400 });

    const history = normalizeHistory(body.messages);
    const cookieStore = await cookies();
    let sessionKey = cookieStore.get('uo_agent_session')?.value;
    if (!sessionKey) {
      sessionKey = crypto.randomUUID();
      cookieStore.set('uo_agent_session', sessionKey, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    let previousState: AgentState | null = null;
    try {
      previousState = await loadAgentState(sessionKey);
    } catch (error) {
      console.error('AGENT_SESSION_LOAD_ERROR', error instanceof Error ? error.message : 'unknown_error');
    }

    const state = deriveAgentState(message, previousState || DEFAULT_AGENT_STATE);
    const providerQuery = buildProviderQuery(state);
    let providers: AgentProvider[] = [];

    if (providerQuery) {
      try {
        providers = await searchVerifiedProviders(providerQuery, state.location.municipality, 5);
      } catch (error) {
        console.error('AGENT_PROVIDER_SEARCH_ERROR', error instanceof Error ? error.message : 'unknown_error');
      }
    }

    if (providers.length === 1) state.activeProviderId = providers[0].id;

    try {
      await saveAgentState(sessionKey, state);
    } catch (error) {
      console.error('AGENT_SESSION_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error');
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: stateContext(state) },
      { role: 'system', content: `SPECIALIST WORKFLOW:\n${specialistContext(state)}` },
      { role: 'system', content: formatProviderContext(providers) },
      ...history,
      { role: 'user', content: message },
    ];

    const result = await kimiChat(messages);
    const reply = String(result?.choices?.[0]?.message?.content || '').trim();
    if (!reply) return NextResponse.json({ error: 'agent_empty_response' }, { status: 502 });

    return NextResponse.json({
      reply,
      state,
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        category: provider.category,
        description: provider.description,
        postcode: provider.postcode,
        phone: provider.phone,
        website: provider.website,
      })),
    });
  } catch (error) {
    console.error('AGENT_ERROR', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'agent_unavailable', reply: 'Ik kan je aanvraag op dit moment niet verwerken. Probeer het over een moment opnieuw.' }, { status: 503 });
  }
}
