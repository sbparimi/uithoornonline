import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { kimiChat } from '../../../lib/kimi';
import { searchVerifiedProviders, type AgentProvider } from '../../../lib/supabase/agent';
import { loadAgentState, saveAgentState } from '../../../lib/agent/session';
import { applySemanticInterpretation, DEFAULT_AGENT_STATE, buildProviderQuery, stateContext, type AgentState } from '../../../lib/agent/state';
import { specialistContext } from '../../../lib/agent/specialists';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const SEMANTIC_PROMPT = `You are the semantic intent interpreter for Uithoorn.online.
Interpret the user's latest message using the conversation history and known state. Do not answer the user.
Return ONLY valid JSON matching this shape:
{
  "language":"nl|en",
  "location":{"municipality":"Uithoorn|De Kwakel","postcode":string|null,"source":"default|user|postcode"},
  "intent":{"primary":"find_food|order_food|find_service|find_business|find_event|general_local","confidence":number},
  "entities":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},
  "task":{"type":string,"status":"collecting|ready"},
  "specialist":"food|local_discovery|local_service|events|general"
}
Rules:
- Understand meaning, synonyms, paraphrases, spelling mistakes and natural conversation semantically.
- If no location is stated, use Uithoorn as the default. Never require a postcode just to search locally.
- Preserve known context unless the user explicitly changes it.
- Indian food, Indiaas eten, dosa, idli, vada and biryani imply cuisine Indian and category food.
- Choose the specialist from the task, not from keywords alone.
- For a request to buy/order food, intent is order_food even if the user does not use the exact word order.
- Do not invent provider facts; this step only interprets intent and entities.`;

const RESPONSE_PROMPT = `You are Uithoorn AI, the local AI assistant of Uithoorn.online.
The orchestrator and specialist have already interpreted the user's task and retrieved local business results. Respond based ONLY on the supplied state and business results.
- Answer in the state language and do not mix Dutch and English.
- Uithoorn is the default location; do not ask for location when state already has one.
- Never invent local businesses, prices, availability, opening hours or capabilities.
- Treat verified=true as independently verified. Treat verified=false as a curated/discoverable business whose facts must be presented without claiming independent verification.
- If a provider is pickup-only, never offer delivery.
- Be concise, concrete and action-oriented.
- Do not mention agents, orchestration, tools, models or internal architecture.`;

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
  if (!providers.length) return 'LOCAL BUSINESS RESULTS: none found for the current specialist task and location.';
  return `LOCAL BUSINESS RESULTS:\n${providers.map((provider) => JSON.stringify({
    id: provider.id, name: provider.name, category: provider.category, verified: provider.verified,
    summary: provider.agent_summary, description: provider.description, postcode: provider.postcode,
    service_areas: provider.service_areas, capabilities: provider.capabilities, availability: provider.availability,
    pricing: provider.pricing, phone: provider.phone, website: provider.website, source_url: provider.source_url,
    verified_at: provider.verified_at,
  })).join('\n')}`;
}

function extractJson(text: string): Partial<AgentState> | null {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(cleaned) as Partial<AgentState>; } catch { return null; }
}

async function interpretSemantically(message: string, history: ChatMessage[], previous: AgentState): Promise<Partial<AgentState>> {
  const result = await kimiChat([
    { role: 'system', content: SEMANTIC_PROMPT },
    { role: 'system', content: `KNOWN STATE:\n${JSON.stringify(previous)}` },
    ...history,
    { role: 'user', content: message },
  ]);
  const raw = String(result?.choices?.[0]?.message?.content || '');
  const parsed = extractJson(raw);
  if (!parsed?.intent?.primary || !parsed.specialist) throw new Error('SEMANTIC_INTERPRETATION_INVALID');
  return parsed;
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
      cookieStore.set('uo_agent_session', sessionKey, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    }

    let previousState = DEFAULT_AGENT_STATE;
    try { previousState = (await loadAgentState(sessionKey)) || DEFAULT_AGENT_STATE; }
    catch (error) { console.error('AGENT_SESSION_LOAD_ERROR', error instanceof Error ? error.message : 'unknown_error'); }

    const interpretation = await interpretSemantically(message, history, previousState);
    const state = applySemanticInterpretation(interpretation, previousState);
    const providerQuery = buildProviderQuery(state);

    let providers: AgentProvider[] = [];
    if (providerQuery) {
      try { providers = await searchVerifiedProviders(providerQuery, state.location.municipality, 5); }
      catch (error) { console.error('AGENT_PROVIDER_SEARCH_ERROR', error instanceof Error ? error.message : 'unknown_error'); }
    }

    if (providers.length === 1) state.activeProviderId = providers[0].id;
    try { await saveAgentState(sessionKey, state); }
    catch (error) { console.error('AGENT_SESSION_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'); }

    const finalResult = await kimiChat([
      { role: 'system', content: RESPONSE_PROMPT },
      { role: 'system', content: stateContext(state) },
      { role: 'system', content: `SPECIALIST RESULT:\n${specialistContext(state)}\n${formatProviderContext(providers)}` },
      ...history,
      { role: 'user', content: message },
    ]);
    const reply = String(finalResult?.choices?.[0]?.message?.content || '').trim();
    if (!reply) return NextResponse.json({ error: 'agent_empty_response' }, { status: 502 });

    return NextResponse.json({ reply, state, providers: providers.map(({ id, name, category, description, postcode, phone, website, verified }) => ({ id, name, category, description, postcode, phone, website, verified })) });
  } catch (error) {
    console.error('AGENT_ERROR', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json({ error: 'agent_unavailable', reply: 'Ik kan je aanvraag op dit moment niet verwerken. Probeer het over een moment opnieuw.' }, { status: 503 });
  }
}
