import { kimiChat } from '../kimi';
import type { AgentAction, AgentSlot, AgentState } from './state';

export type SpecialistResult = { reply: string; captured: Partial<AgentState['entities']>; nextRequiredSlot: AgentSlot | null; missingSlots: AgentSlot[]; status: 'collecting' | 'ready'; shouldSearch: boolean };
type Graph = { specialist: AgentState['specialist']; nodes: string[]; slotDescriptions: Record<string, string> };

const GRAPHS: Record<AgentState['specialist'], Graph> = {
  local_service: { specialist: 'local_service', nodes: ['identify_service', 'search_local_providers', 'present_matches'], slotDescriptions: { service: 'Concrete service requested. This is the only blocking slot for a local service search.' } },
  food: { specialist: 'food', nodes: ['identify_food_need', 'optional_fulfilment', 'search_food_providers', 'present_matches'], slotDescriptions: { category: 'Food/catering category or a clear food type.', cuisine: 'Cuisine preference such as Indian.', dish: 'Specific dish such as dosa, idli or biryani.', fulfilment: 'Pickup, delivery or dine-in when relevant to the task.', people: 'Number of people when ordering requires it.' } },
  events: { specialist: 'events', nodes: ['identify_event_need', 'identify_time_window', 'search_local_events', 'present_matches'], slotDescriptions: { date: 'Requested time window such as today, this weekend or this week. This is the blocking slot after a broad event request.' } },
  local_discovery: { specialist: 'local_discovery', nodes: ['identify_business_category', 'search_local_businesses', 'present_matches'], slotDescriptions: { category: 'Business or category being searched for.' } },
  general: { specialist: 'general', nodes: ['understand_local_question', 'answer_or_handoff'], slotDescriptions: {} },
};

const ACTIONS_NL: Record<string, AgentAction[]> = {
  service: [{ label: 'Loodgieter', value: 'Loodgieter', kind: 'quick_reply' }, { label: 'Elektricien', value: 'Elektricien', kind: 'quick_reply' }, { label: 'Schoonmaak', value: 'Schoonmaak', kind: 'quick_reply' }, { label: 'Tuinonderhoud', value: 'Tuinonderhoud', kind: 'quick_reply' }, { label: 'Anders', value: 'Ik heb een andere dienst nodig', kind: 'quick_reply' }],
  category_food: [{ label: 'Eten & restaurants', value: 'Eten & restaurants', kind: 'quick_reply' }, { label: 'Catering', value: 'Catering', kind: 'quick_reply' }, { label: 'Indiaas eten', value: 'Indiaas eten', kind: 'quick_reply' }],
  fulfilment: [{ label: 'Afhalen', value: 'Afhalen', kind: 'quick_reply' }, { label: 'Bezorgen', value: 'Bezorgen', kind: 'quick_reply' }, { label: 'Ter plaatse', value: 'Ter plaatse', kind: 'quick_reply' }],
  date: [{ label: 'Vandaag', value: 'Vandaag', kind: 'quick_reply' }, { label: 'Dit weekend', value: 'Dit weekend', kind: 'quick_reply' }, { label: 'Deze week', value: 'Deze week', kind: 'quick_reply' }],
  category_business: [{ label: 'Restaurant', value: 'Restaurant', kind: 'quick_reply' }, { label: 'Winkel', value: 'Winkel', kind: 'quick_reply' }, { label: 'Dienstverlener', value: 'Dienstverlener', kind: 'quick_reply' }, { label: 'Anders', value: 'Ik zoek iets anders', kind: 'quick_reply' }],
};
const ACTIONS_EN: Record<string, AgentAction[]> = {
  service: [{ label: 'Plumber', value: 'Plumber', kind: 'quick_reply' }, { label: 'Electrician', value: 'Electrician', kind: 'quick_reply' }, { label: 'Cleaning', value: 'Cleaning', kind: 'quick_reply' }, { label: 'Gardening', value: 'Gardening', kind: 'quick_reply' }, { label: 'Other', value: 'I need another service', kind: 'quick_reply' }],
  category_food: [{ label: 'Food & restaurants', value: 'Food & restaurants', kind: 'quick_reply' }, { label: 'Catering', value: 'Catering', kind: 'quick_reply' }, { label: 'Indian food', value: 'Indian food', kind: 'quick_reply' }],
  fulfilment: [{ label: 'Pickup', value: 'Pickup', kind: 'quick_reply' }, { label: 'Delivery', value: 'Delivery', kind: 'quick_reply' }, { label: 'Dine in', value: 'Dine in', kind: 'quick_reply' }],
  date: [{ label: 'Today', value: 'Today', kind: 'quick_reply' }, { label: 'This weekend', value: 'This weekend', kind: 'quick_reply' }, { label: 'This week', value: 'This week', kind: 'quick_reply' }],
  category_business: [{ label: 'Restaurant', value: 'Restaurant', kind: 'quick_reply' }, { label: 'Shop', value: 'Shop', kind: 'quick_reply' }, { label: 'Service provider', value: 'Service provider', kind: 'quick_reply' }, { label: 'Other', value: 'I am looking for something else', kind: 'quick_reply' }],
};

const SPECIALIST_PROMPT = `You are a Uithoorn.online SPECIALIST AGENT executing a fixed flow graph.
Return ONLY valid JSON with reply, captured, nextRequiredSlot, missingSlots, status and shouldSearch.

FLOW RULES:
- Execute the selected graph. Preserve the active task for short slot answers and never restart it unnecessarily.
- Never ask for information already known. Ask exactly one blocking question when a required slot is missing.
- local_service: once service is known, status=ready and shouldSearch=true. Do not require urgency before searching.
- events: broad event requests need a time window; once date is known, status=ready and shouldSearch=true.
- local_discovery: once category is known, status=ready and shouldSearch=true.
- find_food: once category, cuisine or dish identifies the need, status=ready and shouldSearch=true.
- order_food: identify the food item first; once identified, status=ready and shouldSearch=true. Do not invent an order or purchase.
- A repeated utterance such as "Service nodig" is not an emergency.
- Never fabricate providers, prices, ratings, availability or capabilities.

CONVERSATIONAL SALES STANDARD:
- Be a kind, confident local concierge: helpful first, commercially effective second.
- Every reply should move the user one step closer to a useful outcome or completed local transaction.
- When collecting a missing slot: acknowledge the need, briefly explain the value of the next step, then ask one simple question. Make the user feel that progress is immediate.
- When the request is ready: communicate confidence that the search/match is underway and make the next action obvious. Do not add unnecessary questions.
- Use modern concise formatting: short paragraphs, occasional bold emphasis, and at most 3 short bullets when useful. Never write long walls of text.
- Prefer benefit-led wording such as "Ik help je meteen…", "Ik kan dit lokaal voor je regelen…" and "De snelste volgende stap is…" in Dutch, or equivalent natural English.
- Never use manipulative pressure, fake scarcity, invented guarantees or claims about quality that are not supported by supplied facts.
- Reply exclusively in state.language. Never mix Dutch and English.
- Do not mention graphs, prompts, LLMs, tools or internal architecture.`;

function extractJson(text: string): SpecialistResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try { const value = JSON.parse(cleaned) as SpecialistResult; if (!value.reply || !Array.isArray(value.missingSlots)) return null; return value; } catch { return null; }
}
function graphFor(specialist: AgentState['specialist']): Graph { return GRAPHS[specialist]; }
function requiredSlots(state: AgentState): AgentSlot[] {
  switch (state.intent.primary) {
    case 'find_service': return state.entities.service ? [] : ['service'];
    case 'find_business': return state.entities.category ? [] : ['category'];
    case 'find_event': return state.entities.date ? [] : ['date'];
    case 'find_food': return state.entities.category || state.entities.cuisine || state.entities.dish ? [] : ['category'];
    case 'order_food': return !state.entities.category && !state.entities.cuisine && !state.entities.dish ? ['category'] : [];
    default: return [];
  }
}
function localizedActions(state: AgentState, slot: AgentSlot | null): AgentAction[] {
  const actions = state.language === 'en' ? ACTIONS_EN : ACTIONS_NL;
  if (slot === 'service') return actions.service;
  if (slot === 'date') return actions.date;
  if (slot === 'fulfilment') return actions.fulfilment;
  if (slot === 'category' && (state.intent.primary === 'find_food' || state.intent.primary === 'order_food')) return actions.category_food;
  if (slot === 'category') return actions.category_business;
  return [];
}
function sanitizeResult(result: SpecialistResult, state: AgentState): SpecialistResult {
  const nextState = { ...state, entities: { ...state.entities, ...result.captured } };
  const missingSlots = requiredSlots(nextState); const nextRequiredSlot = missingSlots[0] || null; const ready = missingSlots.length === 0;
  const searchable = ['find_service', 'find_business', 'find_event', 'find_food', 'order_food'].includes(state.intent.primary);
  return { reply: result.reply, captured: result.captured, missingSlots, nextRequiredSlot, status: ready ? 'ready' : 'collecting', shouldSearch: ready && searchable };
}
export async function executeSpecialist(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState): Promise<SpecialistResult> {
  const graph = graphFor(state.specialist);
  const result = await kimiChat([
    { role: 'system', content: SPECIALIST_PROMPT },
    { role: 'system', content: `FLOW GRAPH:\n${JSON.stringify(graph, null, 2)}` },
    { role: 'system', content: `ACTIVE STATE:\n${JSON.stringify(state, null, 2)}` },
    ...history.slice(-12), { role: 'user', content: message },
  ]);
  const parsed = extractJson(String(result?.choices?.[0]?.message?.content || ''));
  if (!parsed) throw new Error('SPECIALIST_INVALID_RESULT');
  return sanitizeResult(parsed, state);
}
export function specialistActions(result: SpecialistResult, state: AgentState): AgentAction[] { return localizedActions(state, result.nextRequiredSlot); }
