import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { kimiChat } from '../../../lib/kimi';
import { discoverGooglePlaces } from '../../../lib/agent/discovery';
import { searchVerifiedProviders, type AgentProvider } from '../../../lib/supabase/agent';
import { loadAgentState, saveAgentState } from '../../../lib/agent/session';
import { applyOrchestratorDecision, applySpecialistResult, DEFAULT_AGENT_STATE, buildProviderQuery, stateContext, type AgentContact, type AgentState } from '../../../lib/agent/state';
import { emergencyFromMessage } from '../../../lib/agent/planner';
import { orchestrate } from '../../../lib/agent/orchestrator';
import { executeSpecialist, specialistActions } from '../../../lib/agent/specialist-runtime';

const RESPONSE_PROMPT = `You are the response renderer for Uithoorn.online.
The ORCHESTRATOR has already understood the user's intent and selected a specialist. The SPECIALIST has already executed the applicable flow graph, filled slots and requested any required search. You must only render the result for the user.

RULES:
- Use the state language exactly; never mix Dutch and English.
- Do not reinterpret the intent or route to another task.
- Do not ask another question when specialist status is ready.
- Never invent local businesses, prices, availability, opening hours, capabilities, ratings or review counts.
- Use only supplied provider results and specialist execution data.
- Providers with verified=true are first-party Uithoorn.online verified providers. Providers with verified=false may be curated or live-discovered and must not be described as verified.
- If a live-discovered provider is present, describe it as found via Google Maps/Google Places, not as verified by Uithoorn.online.
- If providers are present, explain the useful result and let the provider cards carry contact details.
- If no providers are present, clearly say that no matching provider was found in the current local inventory and no live discovery result is available.
- If a provider has a rating, display the supplied rating, review count and source exactly.
- Be concise, concrete and action-oriented.
- Do not mention LLMs, prompts, tools, orchestration or internal architecture.`;

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ContactInput = { name?: unknown; email?: unknown; phone?: unknown; address?: unknown };

function normalizeContact(value: unknown): AgentContact | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as ContactInput;
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  const email = String(input.email ?? '').trim().toLowerCase();
  const phone = String(input.phone ?? '').trim();
  const address = String(input.address ?? '').trim().replace(/\s+/g, ' ');
  const phoneDigits = phone.replace(/\D/g, '');
  const hasHouseNumber = /\d/.test(address);
  if (name.length < 2 || email.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phoneDigits.length < 8 || address.length < 5 || !hasHouseNumber) return null;
  return { name, email, phone, address };
}

function normalizeHistory(value: unknown, currentMessage: string): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is { role?: unknown; content?: unknown; text?: unknown } => Boolean(item && typeof item === 'object'))
    .map((item): ChatMessage => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content ?? item.text ?? '').trim() }))
    .filter((item) => item.content.length > 0);
  if (normalized.length && normalized[normalized.length - 1].role === 'user' && normalized[normalized.length - 1].content === currentMessage) normalized.pop();
  return normalized.slice(-16);
}

function formatProviderContext(providers: AgentProvider[]): string {
  if (!providers.length) return 'LOCAL BUSINESS RESULTS: none found.';
  return `LOCAL BUSINESS RESULTS:\n${providers.map((provider) => JSON.stringify({
    id: provider.id, name: provider.name, category: provider.category, verified: provider.verified,
    summary: provider.agent_summary, description: provider.description, postcode: provider.postcode,
    service_areas: provider.service_areas, capabilities: provider.capabilities, availability: provider.availability,
    pricing: provider.pricing, phone: provider.phone, website: provider.website, source_url: provider.source_url,
    verified_at: provider.verified_at, rating_score: provider.rating_score, rating_max: provider.rating_max,
    rating_review_count: provider.rating_review_count, rating_source: provider.rating_source,
    rating_retrieved_at: provider.rating_retrieved_at, agent_metadata: provider.agent_metadata,
  })).join('\n')}`;
}

async function renderReadyResponse(message: string, history: ChatMessage[], state: AgentState, specialistReply: string, providers: AgentProvider[]): Promise<string> {
  const result = await kimiChat([
    { role: 'system', content: RESPONSE_PROMPT },
    { role: 'system', content: stateContext(state) },
    { role: 'system', content: `SPECIALIST EXECUTION RESULT:\n${specialistReply}\n${formatProviderContext(providers)}` },
    ...history,
    { role: 'user', content: message },
  ]);
  return String(result?.choices?.[0]?.message?.content || '').trim();
}

function mergeProviders(local: AgentProvider[], discovered: AgentProvider[]): AgentProvider[] {
  const result = [...local];
  const seen = new Set(local.map((provider) => provider.name.toLowerCase().trim()));
  for (const provider of discovered) {
    const key = provider.name.toLowerCase().trim();
    if (!seen.has(key)) { result.push(provider); seen.add(key); }
    if (result.length >= 5) break;
  }
  return result;
}

async function searchProviders(state: AgentState, query: string): Promise<AgentProvider[]> {
  let local: AgentProvider[] = [];
  try { local = await searchVerifiedProviders(query, state.location.municipality, 5); }
  catch (error) { console.error('AGENT_PROVIDER_SEARCH_ERROR', error instanceof Error ? error.message : 'unknown_error'); }

  // Events require an event-specific source; Google Places is deliberately not used as an event source.
  if (state.specialist === 'events' || local.length >= 5) return local;

  try {
    const discovered = await discoverGooglePlaces(query, state.location.municipality, 5 - local.length);
    return mergeProviders(local, discovered);
  } catch (error) {
    console.error('AGENT_DISCOVERY_ERROR', error instanceof Error ? error.message : 'unknown_error');
    return local;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || '').trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: 'invalid_message' }, { status: 400 });

    // Safety takes precedence over lead/contact collection so a genuine emergency is never delayed.
    const safety = emergencyFromMessage(message);
    if (safety.emergency) {
      return NextResponse.json({
        reply: 'Dit klinkt als een noodsituatie. Bel direct 112 voor politie, brandweer of ambulance.',
        state: { ...DEFAULT_AGENT_STATE, safety },
        safety,
        actions: [{ label: 'Bel 112', value: 'Bel 112', kind: 'emergency' }],
        providers: [],
      });
    }

    const suppliedContact = normalizeContact(body.contact);
    const history = normalizeHistory(body.messages, message);
    const cookieStore = await cookies();
    let sessionKey = cookieStore.get('uo_agent_session')?.value;
    if (!sessionKey) {
      sessionKey = crypto.randomUUID();
      cookieStore.set('uo_agent_session', sessionKey, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    }

    let previousState = DEFAULT_AGENT_STATE;
    try { previousState = (await loadAgentState(sessionKey)) || DEFAULT_AGENT_STATE; }
    catch (error) { console.error('AGENT_SESSION_LOAD_ERROR', error instanceof Error ? error.message : 'unknown_error'); }

    const contact = suppliedContact || previousState.contact;
    if (!contact) {
      return NextResponse.json({
        error: 'contact_required',
        reply: 'Vul eerst je naam, e-mail, telefoonnummer en adres met huisnummer in voordat ik je aanvraag kan verwerken.',
        contact_required: true,
      }, { status: 400 });
    }

    previousState = { ...previousState, contact };
    await saveAgentState(sessionKey, previousState).catch((error) => console.error('AGENT_CONTACT_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'));

    const decision = await orchestrate(message, history, previousState);
    let state = applyOrchestratorDecision(decision, previousState);
    state.contact = contact;
    state.safety = safety;

    const specialistResult = await executeSpecialist(message, history, state);
    state = applySpecialistResult(state, specialistResult);

    let providers: AgentProvider[] = [];
    if (specialistResult.shouldSearch && state.task.status === 'ready') {
      const providerQuery = buildProviderQuery(state);
      if (providerQuery) providers = await searchProviders(state, providerQuery);
      state.task = { ...state.task, status: 'completed' };
      if (providers.length === 1) state.activeProviderId = providers[0].id;
    }

    await saveAgentState(sessionKey, state).catch((error) => console.error('AGENT_SESSION_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'));

    const actions = specialistActions(specialistResult, state);
    const reply = specialistResult.status === 'collecting'
      ? specialistResult.reply
      : await renderReadyResponse(message, history, state, specialistResult.reply, providers);

    if (!reply) return NextResponse.json({ error: 'agent_empty_response' }, { status: 502 });

    return NextResponse.json({
      reply,
      state,
      safety: state.safety,
      actions,
      providers: providers.map(({ id, name, category, description, postcode, phone, website, verified, rating_score, rating_max, rating_review_count, rating_source, source_url, agent_metadata }) => ({ id, name, category, description, postcode, phone, website, verified, rating_score, rating_max, rating_review_count, rating_source, source_url, external_source: agent_metadata?.discovery_source || null })),
    });
  } catch (error) {
    console.error('AGENT_ERROR', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'agent_unavailable', reply: 'Ik kan je aanvraag op dit moment niet verwerken. Probeer het over een moment opnieuw.' }, { status: 503 });
  }
}
