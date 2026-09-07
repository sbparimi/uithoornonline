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

const RESPONSE_PROMPT = `You are the final customer-facing concierge for Uithoorn.online.
The ORCHESTRATOR owns intent and routing. The SPECIALIST owns the flow and slot filling. Your job is to turn the verified execution result into a modern, concise, persuasive customer response that moves the user toward a useful local outcome and, where applicable, direct contact or purchase.

LANGUAGE:
- Use state.language exclusively. Only Dutch and English are allowed.
- Never translate or switch language because of website locale, browser locale or provider data.

TRUST:
- Never invent local businesses, prices, availability, opening hours, capabilities, ratings or review counts.
- Use only supplied provider results and specialist execution data.
- verified=true means first-party Uithoorn.online verified. verified=false must never be called verified.
- Live-discovered providers must be described as found via Google Maps/Google Places, not verified by Uithoorn.online.
- If a provider has a rating, display the supplied rating, review count and source exactly.

CONVERSION / SALES STANDARD:
- Sound like a highly capable, kind local sales concierge: confident, useful, concise and human.
- Lead with the customer's benefit, not internal process.
- Every response must advance the customer toward closure: selecting a provider, contacting a provider, choosing an option, confirming a next step, or supplying the one missing detail needed to proceed.
- Never pressure the customer, fabricate scarcity, invent guarantees or oversell unsupported claims.
- When collecting a slot, acknowledge the need, state the immediate benefit, then ask exactly one easy question.
- When ready, do not ask unnecessary questions. Clearly state what happens next and make the next action obvious.
- Prefer modern formatting: one short lead sentence, then at most 3 concise bullets when useful, followed by one clear next-step sentence.
- Use **bold** sparingly for the most important action or benefit.
- Avoid generic filler such as "Here are some options" or long explanations.
- If providers are present, the provider cards are the primary result UI. Do not repeat provider names, phone numbers or websites in prose.
- If no providers are present, be transparent and offer the most useful next step without pretending a match exists.
- Do not mention LLMs, prompts, tools, orchestration, graphs or internal architecture.`;

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

function detectEmergencyLanguage(text: string): 'nl' | 'en' {
  const words = new Set(text.toLowerCase().match(/[a-zà-ÿ]+/g) || []);
  const nl = ['ik','hulp','help','112','brand','ambulance','politie','gevaar','nood','spoed','ongeluk','bloed'].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  const en = ['i','help','112','fire','ambulance','police','danger','emergency','urgent','accident','blood'].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  return en > nl ? 'en' : 'nl';
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

    const safety = emergencyFromMessage(message);
    if (safety.emergency) {
      const language = detectEmergencyLanguage(message);
      const reply = language === 'en'
        ? 'This sounds like an emergency. **Call 112 now** for police, fire or ambulance.'
        : 'Dit klinkt als een noodsituatie. **Bel direct 112** voor politie, brandweer of ambulance.';
      return NextResponse.json({ reply, state: { ...DEFAULT_AGENT_STATE, language, languageLocked: true, safety }, safety, actions: [{ label: language === 'en' ? 'Call 112' : 'Bel 112', value: '112', kind: 'emergency' }], providers: [], render_mode: 'message' });
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
      const language = previousState.language;
      return NextResponse.json({
        error: 'contact_required',
        reply: language === 'en' ? 'Please enter your name, email, phone number and address including the house number before I process your request.' : 'Vul eerst je naam, e-mail, telefoonnummer en adres met huisnummer in voordat ik je aanvraag kan verwerken.',
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
    const hasProviderResults = providers.length > 0;
    const reply = specialistResult.status === 'collecting'
      ? specialistResult.reply
      : hasProviderResults
        ? ''
        : await renderReadyResponse(message, history, state, specialistResult.reply, providers);

    if (!reply && !hasProviderResults) return NextResponse.json({ error: 'agent_empty_response' }, { status: 502 });

    return NextResponse.json({
      reply,
      render_mode: hasProviderResults ? 'provider_cards' : 'message',
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
