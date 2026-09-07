import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { kimiChat } from '../../../lib/kimi';
import { discoverGooglePlaces } from '../../../lib/agent/discovery';
import { searchVerifiedProviders, type AgentProvider } from '../../../lib/supabase/agent';
import { upsertAgentLead } from '../../../lib/supabase/leads';
import { loadAgentState, saveAgentState } from '../../../lib/agent/session';
import { applyOrchestratorDecision, applySpecialistResult, DEFAULT_AGENT_STATE, buildProviderQuery, stateContext, type AgentContact, type AgentState, type SemanticIntent } from '../../../lib/agent/state';
import { emergencyFromMessage } from '../../../lib/agent/planner';
import { orchestrate, type OrchestratorDecision } from '../../../lib/agent/orchestrator';
import { executeSpecialist, specialistActions, type SpecialistResult } from '../../../lib/agent/specialist-runtime';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type ContactInput = { name?: unknown; email?: unknown; phone?: unknown; address?: unknown };
const BUSINESS_INTENTS = new Set<SemanticIntent>(['find_food', 'order_food', 'find_service', 'find_business', 'find_event']);
const BACKEND_FAILURE_MESSAGE = 'Sorry, our technology is letting us down. Please call +31616270233 for immediate assistance.';

const RESPONSE_PROMPT = `You are the final customer-facing concierge for Uithoorn.online.
The orchestrator and specialist have already reasoned about the request and executed the required local discovery. Turn the verified result into a concise, natural customer response.

LANGUAGE: use state.language exclusively. Only Dutch and English are allowed.
TRUST: never invent businesses, prices, availability, opening hours, capabilities, ratings or review counts. Use only supplied provider results and execution evidence. Never call a live-discovered provider Uithoorn.online-verified.
STYLE: lead with the useful outcome; be concise; do not repeat provider-card details in prose; never mention LLMs, prompts, tools or internal architecture.
If no providers are present, explain the result honestly and give the most useful next step.`;

function backendFailureResponse(language: AgentState['language'], state: AgentState = DEFAULT_AGENT_STATE, safety = state.safety) {
  return NextResponse.json({ error: 'backend_unavailable', reply: BACKEND_FAILURE_MESSAGE, actions: [], providers: [], render_mode: 'message', state: { ...state, language }, safety }, { status: 503 });
}

function normalizeContact(value: unknown): AgentContact | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as ContactInput;
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  const email = String(input.email ?? '').trim().toLowerCase();
  const phone = String(input.phone ?? '').trim();
  const address = String(input.address ?? '').trim().replace(/\s+/g, ' ');
  const phoneDigits = phone.replace(/\D/g, '');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phoneDigits.length < 8 || address.length < 5 || !/\d/.test(address)) return null;
  return { name, email, phone, address };
}

function normalizeHistory(value: unknown, currentMessage: string): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is { role?: unknown; content?: unknown; text?: unknown } => Boolean(item && typeof item === 'object'))
    .map((item): ChatMessage => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content ?? item.text ?? '').trim() }))
    .filter((item) => item.content.length > 0);
  if (normalized.at(-1)?.role === 'user' && normalized.at(-1)?.content === currentMessage) normalized.pop();
  return normalized.slice(-16);
}

function detectLanguage(text: string): 'nl' | 'en' {
  const words = new Set(text.toLowerCase().match(/[a-zà-ÿ]+/g) || []);
  const nl = ['ik','zoek','eten','catering','restaurant','bedrijf','loodgieter','elektricien','schoonmaak','vandaag','weekend','wat','nodig','hulp','graag'].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  const en = ['i','need','food','catering','restaurant','business','plumber','electrician','cleaning','today','weekend','what','looking','help','please'].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  return en > nl ? 'en' : 'nl';
}

function detectEmergencyLanguage(text: string): 'nl' | 'en' {
  const words = new Set(text.toLowerCase().match(/[a-zà-ÿ]+/g) || []);
  const nl = ['ik','hulp','112','brand','ambulance','politie','gevaar','nood','spoed','ongeluk','bloed'].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  const en = ['i','help','112','fire','ambulance','police','danger','emergency','urgent','accident','blood'].reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  return en > nl ? 'en' : 'nl';
}

function formatProviderContext(providers: AgentProvider[]): string {
  if (!providers.length) return 'LOCAL BUSINESS RESULTS: none found.';
  return `LOCAL BUSINESS RESULTS:\n${providers.map((provider) => JSON.stringify({ id: provider.id, name: provider.name, category: provider.category, verified: provider.verified, summary: provider.agent_summary, description: provider.description, postcode: provider.postcode, service_areas: provider.service_areas, capabilities: provider.capabilities, availability: provider.availability, pricing: provider.pricing, phone: provider.phone, website: provider.website, source_url: provider.source_url, verified_at: provider.verified_at, rating_score: provider.rating_score, rating_max: provider.rating_max, rating_review_count: provider.rating_review_count, rating_source: provider.rating_source, rating_retrieved_at: provider.rating_retrieved_at, agent_metadata: provider.agent_metadata })).join('\n')}`;
}

async function renderResponse(message: string, history: ChatMessage[], state: AgentState, specialistReply: string, providers: AgentProvider[]): Promise<string> {
  const result = await kimiChat([
    { role: 'system', content: RESPONSE_PROMPT },
    { role: 'system', content: stateContext(state) },
    { role: 'system', content: `SPECIALIST EXECUTION RESULT:\n${specialistReply}\n${formatProviderContext(providers)}` },
    ...history,
    { role: 'user', content: message },
  ]);
  const reply = String(result?.choices?.[0]?.message?.content || '').trim();
  if (!reply) throw new Error('AGENT_RENDERER_EMPTY');
  return reply;
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
  const local = await searchVerifiedProviders(query, state.location.municipality, 5);
  if (state.specialist === 'events' || local.length >= 5) return local;
  return mergeProviders(local, await discoverGooglePlaces(query, state.location.municipality, 5 - local.length));
}

export async function POST(request: Request) {
  let requestMessage = '';
  try {
    const body = await request.json();
    requestMessage = String(body.message || '').trim();
    const contactDecision = body.contact_decision === 'no' ? 'no' : body.contact_decision === 'yes' ? 'yes' : null;
    if (!requestMessage || requestMessage.length > 4000) return NextResponse.json({ error: 'invalid_message' }, { status: 400 });

    const safety = emergencyFromMessage(requestMessage);
    if (safety.emergency) {
      const language = detectEmergencyLanguage(requestMessage);
      const reply = language === 'en' ? 'This sounds like an emergency. **Call 112 now** for police, fire or ambulance.' : 'Dit klinkt als een noodsituatie. **Bel direct 112** voor politie, brandweer of ambulance.';
      return NextResponse.json({ reply, state: { ...DEFAULT_AGENT_STATE, language, languageLocked: true, safety }, safety, actions: [{ label: language === 'en' ? 'Call 112' : 'Bel 112', value: '112', kind: 'emergency' }], providers: [], render_mode: 'message' });
    }

    const suppliedContact = normalizeContact(body.contact);
    const history = normalizeHistory(body.messages, requestMessage);
    const cookieStore = await cookies();
    let sessionKey = cookieStore.get('uo_agent_session')?.value;
    if (!sessionKey) {
      sessionKey = crypto.randomUUID();
      cookieStore.set('uo_agent_session', sessionKey, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    }

    let previousState = DEFAULT_AGENT_STATE;
    try { previousState = (await loadAgentState(sessionKey)) || DEFAULT_AGENT_STATE; }
    catch (error) { console.error('AGENT_SESSION_LOAD_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(detectLanguage(requestMessage), DEFAULT_AGENT_STATE, safety); }
    if (previousState.contact && previousState.contactCapture?.status !== 'accepted') previousState = { ...previousState, contactCapture: { ...previousState.contactCapture, status: 'accepted' } };

    let decision: OrchestratorDecision;
    try { decision = await orchestrate(requestMessage, history, previousState); }
    catch (error) { console.error('AGENT_ORCHESTRATOR_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(previousState.language, previousState, safety); }

    let state = applyOrchestratorDecision(decision, previousState);
    state.safety = safety;
    if (contactDecision === 'no') state.contactCapture = { status: 'declined', promptIntent: previousState.contactCapture?.promptIntent || state.intent.primary, pendingMessage: null };

    if (suppliedContact) {
      state.contact = suppliedContact;
      state.contactCapture = { status: 'accepted', promptIntent: previousState.contactCapture?.promptIntent || state.intent.primary, pendingMessage: null };
      try { await upsertAgentLead(sessionKey, suppliedContact, state.language, state.contactCapture.promptIntent || state.intent.primary); }
      catch (error) { console.error('AGENT_LEAD_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(state.language, state, safety); }
    } else if (BUSINESS_INTENTS.has(state.intent.primary) && state.intent.confidence >= 0.55 && !state.contact && state.contactCapture.status === 'unknown') {
      state.contactCapture = { status: 'offered', promptIntent: state.intent.primary, pendingMessage: requestMessage };
      try { await saveAgentState(sessionKey, state); }
      catch (error) { console.error('AGENT_SESSION_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(state.language, state, safety); }
      const en = state.language === 'en';
      return NextResponse.json({ reply: en ? 'I can find the right local options for you. To make this quicker, would you like to share your details?' : 'Ik kan direct de juiste lokale opties voor je zoeken. Wil je je gegevens delen, zodat ik je sneller kan helpen?', render_mode: 'message', contact_offer: true, pending_request: requestMessage, state, safety: state.safety, actions: en ? [{ label: 'Yes', value: '__contact_yes', kind: 'contact_yes' }, { label: 'No', value: '__contact_no', kind: 'contact_no' }] : [{ label: 'Ja', value: '__contact_yes', kind: 'contact_yes' }, { label: 'Nee', value: '__contact_no', kind: 'contact_no' }], providers: [] });
    }

    try { await saveAgentState(sessionKey, state); }
    catch (error) { console.error('AGENT_SESSION_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(state.language, state, safety); }

    let specialistResult: SpecialistResult;
    try { specialistResult = await executeSpecialist(requestMessage, history, state); }
    catch (error) { console.error('AGENT_SPECIALIST_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(state.language, state, safety); }
    state = applySpecialistResult(state, specialistResult);

    let providers: AgentProvider[] = [];
    if (specialistResult.shouldSearch && state.task.status === 'ready') {
      const providerQuery = buildProviderQuery(state);
      if (providerQuery) providers = await searchProviders(state, providerQuery);
      state.task = { ...state.task, status: 'completed' };
      if (providers.length === 1) state.activeProviderId = providers[0].id;
    }

    try { await saveAgentState(sessionKey, state); }
    catch (error) { console.error('AGENT_SESSION_SAVE_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(state.language, state, safety); }

    const actions = specialistActions(specialistResult, state);
    const hasProviderResults = providers.length > 0;
    const reply = specialistResult.status === 'collecting' ? specialistResult.reply : await renderResponse(requestMessage, history, state, specialistResult.reply, providers);
    return NextResponse.json({ reply: hasProviderResults ? '' : reply, render_mode: hasProviderResults ? 'provider_cards' : 'message', state, safety: state.safety, actions, providers: providers.map(({ id, name, category, description, postcode, phone, website, verified, rating_score, rating_max, rating_review_count, rating_source, source_url, agent_metadata }) => ({ id, name, category, description, postcode, phone, website, verified, rating_score, rating_max, rating_review_count, rating_source, source_url, external_source: agent_metadata?.discovery_source || null })) });
  } catch (error) {
    console.error('AGENT_ERROR', error instanceof Error ? error.message : 'unknown_error');
    const language = detectLanguage(requestMessage);
    return backendFailureResponse(language, { ...DEFAULT_AGENT_STATE, language }, { emergency: false, reason: null });
  }
}
