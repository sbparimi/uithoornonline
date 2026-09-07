import { kimiChat } from '../kimi';
import type { AgentAction, AgentSlot, AgentState } from './state';

export type SpecialistResult = {
  reply: string;
  captured: Partial<AgentState['entities']>;
  nextRequiredSlot: AgentSlot | null;
  missingSlots: AgentSlot[];
  status: 'collecting' | 'ready';
  shouldSearch: boolean;
  actions: AgentAction[];
};

type Graph = {
  specialist: AgentState['specialist'];
  slotOrder: AgentSlot[];
  descriptions: Record<string, string>;
};

const GRAPHS: Record<AgentState['specialist'], Graph> = {
  local_service: {
    specialist: 'local_service',
    slotOrder: ['service', 'location'],
    descriptions: {
      service: 'The concrete local service requested, e.g. plumber, electrician, cleaning, gardening.',
      location: 'Supported local municipality or postcode. Location is already defaulted to Uithoorn unless explicitly changed.',
    },
  },
  food: {
    specialist: 'food',
    slotOrder: ['category', 'cuisine', 'fulfilment', 'people'],
    descriptions: {
      category: 'Food/catering category or dish when needed.',
      cuisine: 'Cuisine preference such as Indian.',
      fulfilment: 'Pickup, delivery or dine-in when relevant.',
      people: 'Number of people when ordering or booking requires it.',
    },
  },
  events: {
    specialist: 'events',
    slotOrder: ['date', 'category', 'location'],
    descriptions: {
      date: 'Requested time window such as today, this weekend or this week.',
      category: 'Activity or event type when needed.',
      location: 'Supported local municipality or postcode.',
    },
  },
  local_discovery: {
    specialist: 'local_discovery',
    slotOrder: ['category', 'location'],
    descriptions: {
      category: 'Business/category being searched for.',
      location: 'Supported local municipality or postcode.',
    },
  },
  general: {
    specialist: 'general',
    slotOrder: [],
    descriptions: {},
  },
};

const ACTIONS: Record<string, AgentAction[]> = {
  service: [
    { label: 'Loodgieter', value: 'Loodgieter', kind: 'quick_reply' },
    { label: 'Elektricien', value: 'Elektricien', kind: 'quick_reply' },
    { label: 'Schoonmaak', value: 'Schoonmaak', kind: 'quick_reply' },
    { label: 'Tuinonderhoud', value: 'Tuinonderhoud', kind: 'quick_reply' },
    { label: 'Anders', value: 'Ik heb een andere dienst nodig', kind: 'quick_reply' },
  ],
  category_food: [
    { label: 'Eten & restaurants', value: 'Eten & restaurants', kind: 'quick_reply' },
    { label: 'Catering', value: 'Catering', kind: 'quick_reply' },
    { label: 'Indiaas eten', value: 'Indiaas eten', kind: 'quick_reply' },
  ],
  fulfilment: [
    { label: 'Afhalen', value: 'Afhalen', kind: 'quick_reply' },
    { label: 'Bezorgen', value: 'Bezorgen', kind: 'quick_reply' },
    { label: 'Ter plaatse', value: 'Ter plaatse', kind: 'quick_reply' },
  ],
  date: [
    { label: 'Vandaag', value: 'Vandaag', kind: 'quick_reply' },
    { label: 'Dit weekend', value: 'Dit weekend', kind: 'quick_reply' },
    { label: 'Deze week', value: 'Deze week', kind: 'quick_reply' },
  ],
  category_business: [
    { label: 'Restaurant', value: 'Restaurant', kind: 'quick_reply' },
    { label: 'Winkel', value: 'Winkel', kind: 'quick_reply' },
    { label: 'Dienstverlener', value: 'Dienstverlener', kind: 'quick_reply' },
    { label: 'Anders', value: 'Ik zoek iets anders', kind: 'quick_reply' },
  ],
};

const SPECIALIST_PROMPT = `You are a Uithoorn.online SPECIALIST AGENT executing a task through a fixed flow graph.
The orchestrator has already selected your specialist. You must execute the specialist workflow, not re-route the user.

Return ONLY valid JSON:
{
  "reply":string,
  "captured":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},
  "nextRequiredSlot":"service|cuisine|category|fulfilment|date|people|location|null",
  "missingSlots":[...same slot values...],
  "status":"collecting|ready",
  "shouldSearch":boolean,
  "actions":[{"label":string,"value":string,"kind":"quick_reply"}]
}

EXECUTION RULES:
1. Use the supplied graph as the workflow contract. Never invent a new step.
2. Read the active state and latest user utterance together. Short answers fill the currently pending slot.
3. Fill slots only when the user actually supplied them or the meaning is unambiguous from the utterance.
4. Never ask for a slot that is already filled.
5. Ask for ONE missing slot only, the first actionable slot in graph order.
6. If the required slot is filled, advance immediately to the next graph node; do not repeat the previous question.
7. A repeated intent such as "Service nodig" means the user still needs a service. Do not interpret it as an emergency and do not switch specialists.
8. For find_service, service is the first required slot. Do not ask urgency before the service is known. After service is known, the workflow may proceed directly to search; urgency is optional context, not a blocker unless explicitly needed by the specialist.
9. For events, "vandaag", "dit weekend", "deze week", dates and equivalent English/Dutch phrases fill date.
10. For food, cuisine/dish/category can satisfy the food type. Only request fulfilment when the task actually needs it.
11. Set shouldSearch=true only when the task has enough information to perform a meaningful local search.
12. The application will perform the search. Do not invent search results.
13. Reply in the selected language. Never mix languages. Use concise natural Dutch for Dutch.
14. The final response must reflect the workflow state, not generic chatbot small talk.`;

function extractJson(text: string): SpecialistResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const value = JSON.parse(cleaned) as SpecialistResult;
    if (!value.reply || !Array.isArray(value.missingSlots) || !Array.isArray(value.actions)) return null;
    return value;
  } catch {
    return null;
  }
}

function graphFor(specialist: AgentState['specialist']): Graph {
  return GRAPHS[specialist];
}

function sanitizeResult(result: SpecialistResult, state: AgentState): SpecialistResult {
  const graph = graphFor(state.specialist);
  const allowedSlots = new Set(graph.slotOrder);
  const missingSlots = result.missingSlots.filter((slot) => allowedSlots.has(slot));
  const nextRequiredSlot = result.nextRequiredSlot && allowedSlots.has(result.nextRequiredSlot) ? result.nextRequiredSlot : (missingSlots[0] || null);
  const actions = result.actions.filter((action) => action.kind === 'quick_reply' && action.label && action.value).slice(0, 5);
  const ready = !missingSlots.length;
  return { ...result, missingSlots, nextRequiredSlot, status: ready ? 'ready' : 'collecting', shouldSearch: ready && result.shouldSearch, actions };
}

export async function executeSpecialist(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState): Promise<SpecialistResult> {
  const graph = graphFor(state.specialist);
  const graphText = JSON.stringify(graph, null, 2);
  const result = await kimiChat([
    { role: 'system', content: SPECIALIST_PROMPT },
    { role: 'system', content: `FLOW GRAPH:\n${graphText}` },
    { role: 'system', content: `ACTIVE STATE:\n${JSON.stringify(state, null, 2)}` },
    ...history.slice(-12),
    { role: 'user', content: message },
  ]);
  const parsed = extractJson(String(result?.choices?.[0]?.message?.content || ''));
  if (!parsed) throw new Error('SPECIALIST_INVALID_RESULT');
  return sanitizeResult(parsed, state);
}

export function specialistActions(result: SpecialistResult, state: AgentState): AgentAction[] {
  if (result.actions.length) return result.actions;
  const slot = result.nextRequiredSlot;
  if (slot === 'service') return ACTIONS.service;
  if (slot === 'date') return ACTIONS.date;
  if (slot === 'fulfilment') return ACTIONS.fulfilment;
  if (slot === 'category' && (state.intent.primary === 'find_food' || state.intent.primary === 'order_food')) return ACTIONS.category_food;
  if (slot === 'category') return ACTIONS.category_business;
  return [];
}
