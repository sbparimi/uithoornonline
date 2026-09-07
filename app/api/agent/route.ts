import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { kimiChat } from '../../../lib/kimi';
import { discoverGooglePlaces } from '../../../lib/agent/discovery';
import { searchVerifiedProviders, type AgentProvider } from '../../../lib/supabase/agent';
import { upsertAgentLead } from '../../../lib/supabase/leads';
import { loadAgentState, saveAgentState } from '../../../lib/agent/session';
import { applyOrchestratorDecision, applySpecialistResult, DEFAULT_AGENT_STATE, buildProviderQuery, stateContext, type AgentContact, type AgentState, type SemanticIntent, type AgentSlot } from '../../../lib/agent/state';
import { emergencyFromMessage } from '../../../lib/agent/planner';
import { orchestrate, type OrchestratorDecision } from '../../../lib/agent/orchestrator';
import { executeSpecialist, specialistActions, type SpecialistResult } from '../../../lib/agent/specialist-runtime';

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
const BUSINESS_INTENTS = new Set<SemanticIntent>(['find_food', 'order_food', 'find_service', 'find_business', 'find_event']);
const BACKEND_FAILURE_MESSAGE = 'Sorry, our technology is letting us down. Please call +31616270233 for immediate assistance.';

function isBusinessIntent(intent: SemanticIntent, confidence: number) { return BUSINESS_INTENTS.has(intent) && confidence >= 0.55; }

function backendFailureResponse(language: AgentState['language'], state: AgentState = DEFAULT_AGENT_STATE, safety = state.safety) {
  return NextResponse.json({
    error: 'backend_unavailable',
    reply: BACKEND_FAILURE_MESSAGE,
    actions: [],
    providers: [],
    render_mode: 'message',
    state: { ...state, language },
    safety,
  }, { status: 503 });
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
  if (normalized.length && normalized[normalized.length - 1].role === 'user' && normalized[normalized.length - 1].content === currentMessage) normalized.pop();
  return normalized.slice(-16);
}

function detectLanguage(text: string, locked: AgentState['language']): 'nl' | 'en' {
  if (locked) return locked;
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

function fallbackDecision(message: string, previous: AgentState): OrchestratorDecision {
  const text = message.toLowerCase().trim();
  const language = detectLanguage(message, previous.languageLocked ? previous.language : null);
  const has = (...values: string[]) => values.some((value) => text.includes(value));
  let intent: SemanticIntent = previous.intent.primary !== 'general_local' && previous.planning.nextRequiredSlot ? previous.intent.primary : 'general_local';
  let specialist: AgentState['specialist'] = previous.specialist !== 'general' && intent !== 'general_local' ? previous.specialist : 'general';
  const entities: AgentState['entities'] = { ...previous.entities };

  if (has('wat is er te doen','iets leuks doen','activiteiten','evenement','events','event','things to do','what is there to do')) {
    intent = 'find_event'; specialist = 'events';
  } else if (has('loodgieter','plumber','elektricien','electrician','schoonmaak','cleaning','tuinonderhoud','gardening','klus','service nodig','dienst nodig','service')) {
    intent = 'find_service'; specialist = 'local_service';
    const serviceMap: Array<[string, string]> = [['loodgieter','loodgieter'],['plumber','plumber'],['elektricien','elektricien'],['electrician','electrician'],['schoonmaak','schoonmaak'],['cleaning','cleaning'],['tuinonderhoud','tuinonderhoud'],['gardening','gardening']];
    const match = serviceMap.find(([key]) => text.includes(key)); if (match) entities.service = match[1];
  } else if (has('eten','food','catering','restaurant','restaurants','maaltijd','lunch','diner','takeaway','take away','bezorgen','delivery')) {
    intent = has('bestel','order','bestellen') ? 'order_food' : 'find_food'; specialist = 'food';
    if (has('catering')) entities.category = 'catering';
    else if (has('restaurant','restaurants')) entities.category = 'restaurant';
    else if (!entities.category && !entities.cuisine && !entities.dish) entities.category = language === 'en' ? 'food' : 'eten';
  } else if (has('zoek een bedrijf','find a business','business','bedrijf','winkel','shop','store')) {
    intent = 'find_business'; specialist = 'local_discovery';
    if (has('restaurant')) entities.category = 'restaurant';
    else if (has('winkel','shop','store')) entities.category = language === 'en' ? 'shop' : 'winkel';
  }

  if (previous.planning.nextRequiredSlot === 'date' && !entities.date && /\b(vandaag|today|morgen|tomorrow|weekend|week|zaterdag|zondag|saturday|sunday)\b/i.test(text)) entities.date = message.trim();
  if (previous.planning.nextRequiredSlot === 'category' && intent === previous.intent.primary && text.length < 80 && !['zoek een bedrijf','find a business'].includes(text)) entities.category = message.trim();
  if (previous.planning.nextRequiredSlot === 'service' && intent === previous.intent.primary && text.length < 80) entities.service = message.trim();

  const confidence = intent === 'general_local' ? 0.35 : 0.92;
  return {
    language,
    location: previous.location,
    intent: { primary: intent, confidence },
    entities,
    specialist,
    task: { type: intent === 'general_local' ? 'local_help' : intent },
    handoff: { specialist, reason: 'fallback_semantic_route' },
    focusSlot: previous.planning.nextRequiredSlot || null,
  };
}

function requiredFallbackSlots(state: AgentState): AgentSlot[] {
  switch (state.intent.primary) {
    case 'find_service': return state.entities.service ? [] : ['service'];
    case 'find_business': return state.entities.category ? [] : ['category'];
    case 'find_event': return state.entities.date ? [] : ['date'];
    case 'find_food': return state.entities.category || state.entities.cuisine || state.entities.dish ? [] : ['category'];
    case 'order_food': return state.entities.category || state.entities.cuisine || state.entities.dish ? [] : ['category'];
    default: return [];
  }
}

function fallbackSpecialist(message: string, state: AgentState): SpecialistResult {
  const entities = { ...state.entities };
  const text = message.toLowerCase().trim();
  if (state.intent.primary === 'find_service' && !entities.service && text.length < 100) entities.service = message.trim();
  if ((state.intent.primary === 'find_food' || state.intent.primary === 'order_food') && !entities.category && !entities.cuisine && !entities.dish && text.length < 100) entities.category = message.trim();
  if (state.intent.primary === 'find_business' && !entities.category && text.length < 80 && !text.includes('zoek een bedrijf') && !text.includes('find a business')) entities.category = message.trim();
  if (state.intent.primary === 'find_event' && !entities.date && /\b(vandaag|today|morgen|tomorrow|weekend|week|zaterdag|zondag|saturday|sunday)\b/i.test(text)) entities.date = message.trim();
  const nextState = { ...state, entities };
  const missingSlots = requiredFallbackSlots(nextState);
  const nextRequiredSlot = missingSlots[0] || null;
  const ready = missingSlots.length === 0 && state.intent.primary !== 'general_local';
  const en = state.language === 'en';
  let reply = '';
  if (!ready) {
    if (nextRequiredSlot === 'service') reply = en ? 'I can find the right local service for you. **Which service do you need?**' : 'Ik help je direct met een passende lokale dienst. **Welke dienst heb je nodig?**';
    else if (nextRequiredSlot === 'category') reply = en ? 'I can narrow that down quickly. **What type of business or food are you looking for?**' : 'Ik kan dit snel voor je verfijnen. **Welk type bedrijf of eten zoek je?**';
    else if (nextRequiredSlot === 'date') reply = en ? 'I can find the best local options. **When would you like to go?**' : 'Ik kan de beste lokale opties voor je zoeken. **Wanneer wil je gaan?**';
    else reply = en ? 'Tell me what you need locally and I will take it from there.' : 'Vertel wat je lokaal nodig hebt, dan pak ik het voor je op.';
  } else {
    reply = en ? 'I have what I need. I’ll find the most relevant local options for you now.' : 'Ik heb genoeg informatie. Ik zoek nu de meest passende lokale opties voor je.';
  }
  return { reply, captured: entities, nextRequiredSlot, missingSlots, status: ready ? 'ready' : 'collecting', shouldSearch: ready };
}

function formatProviderContext(providers: AgentProvider[]): string {
  if (!providers.length) return 'LOCAL BUSINESS RESULTS: none found.';
  return `LOCAL BUSINESS RESULTS:\n${providers.map((provider) => JSON.stringify({ id: provider.id, name: provider.name, category: provider.category, verified: provider.verified, summary: provider.agent_summary, description: provider.description, postcode: provider.postcode, service_areas: provider.service_areas, capabilities: provider.capabilities, availability: provider.availability, pricing: provider.pricing, phone: provider.phone, website: provider.website, source_url: provider.source_url, verified_at: provider.verified_at, rating_score: provider.rating_score, rating_max: provider.rating_max, rating_review_count: provider.rating_review_count, rating_source: provider.rating_source, rating_retrieved_at: provider.rating_retrieved_at, agent_metadata: provider.agent_metadata, })).join('\n')}`;
}

async function renderReadyResponse(message: string, history: ChatMessage[], state: AgentState, specialistReply: string, providers: AgentProvider[]): Promise<string> {
  const result = await kimiChat([{ role: 'system', content: RESPONSE_PROMPT }, { role: 'system', content: stateContext(state) }, { role: 'system', content: `SPECIALIST EXECUTION RESULT:\n${specialistReply}\n${formatProviderContext(providers)}` }, ...history, { role: 'user', content: message }]);
  const reply = String(result?.choices?.[0]?.message?.content || '').trim();
  if (!reply) throw new Error('AGENT_RENDERER_EMPTY');
  return reply;
}

function mergeProviders(local: AgentProvider[], discovered: AgentProvider[]): AgentProvider[] {
  const result = [...local];
  const seen = new Set(local.map((provider) => provider.name.toLowerCase().trim()));
  for (const provider of discovered) { const key = provider.name.toLowerCase().trim(); if (!seen.has(key)) { result.push(provider); seen.add(key); } if (result.length >= 5) break; }
  return result;
}

async function searchProviders(state: AgentState, query: string): Promise<AgentProvider[]> {
  const local = await searchVerifiedProviders(query, state.location.municipality, 5);
  if (state.specialist === 'events' || local.length >= 5) return local;
  const discovered = await discoverGooglePlaces(query, state.location.municipality, 5 - local.length);
  return mergeProviders(local, discovered);
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
    if (!sessionKey) { sessionKey = crypto.randomUUID(); cookieStore.set('uo_agent_session', sessionKey, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 }); }

    let previousState = DEFAULT_AGENT_STATE;
    try { previousState = (await loadAgentState(sessionKey)) || DEFAULT_AGENT_STATE; }
    catch (error) { console.error('AGENT_SESSION_LOAD_ERROR', error instanceof Error ? error.message : 'unknown_error'); return backendFailureResponse(detectLanguage(requestMessage, null), DEFAULT_AGENT_STATE, safety); }
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
    } else if (isBusinessIntent(state.intent.primary, state.intent.confidence) && !state.contact && state.contactCapture.status === 'unknown') {
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
    const reply = specialistResult.status === 'collecting' ? specialistResult.reply : hasProviderResults ? '' : await renderReadyResponse(requestMessage, history, state, specialistResult.reply, providers);

    return NextResponse.json({ reply: hasProviderResults ? '' : reply, render_mode: hasProviderResults ? 'provider_cards' : 'message', state, safety: state.safety, actions, providers: providers.map(({ id, name, category, description, postcode, phone, website, verified, rating_score, rating_max, rating_review_count, rating_source, source_url, agent_metadata }) => ({ id, name, category, description, postcode, phone, website, verified, rating_score, rating_max, rating_review_count, rating_source, source_url, external_source: agent_metadata?.discovery_source || null })) });
  } catch (error) {
    console.error('AGENT_ERROR', error instanceof Error ? error.message : 'unknown_error');
    const language = detectLanguage(requestMessage, null);
    return backendFailureResponse(language, { ...DEFAULT_AGENT_STATE, language }, { emergency: false, reason: null });
  }
}
