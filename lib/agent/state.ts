export type AgentLanguage = 'nl' | 'en';

export type SemanticIntent = 'find_food' | 'order_food' | 'find_service' | 'find_business' | 'find_event' | 'general_local';
export type AgentSlot = 'service' | 'cuisine' | 'category' | 'fulfilment' | 'date' | 'people' | 'location';
export type AgentAction = { label: string; value: string; kind: 'quick_reply' | 'emergency' };
export type AgentContact = { name: string; email: string; phone: string; address: string };

export type AgentState = {
  language: AgentLanguage;
  contact: AgentContact | null;
  location: { municipality: 'Uithoorn' | 'De Kwakel'; postcode: string | null; source: 'default' | 'user' | 'postcode' };
  intent: { primary: SemanticIntent; confidence: number };
  entities: { category: string | null; cuisine: string | null; service: string | null; fulfilment: 'pickup' | 'delivery' | 'dine_in' | null; dish: string | null; people: number | null; date: string | null };
  task: { type: string; status: 'collecting' | 'ready' | 'executing' | 'completed' };
  specialist: 'food' | 'local_discovery' | 'local_service' | 'events' | 'general';
  planning: { missingSlots: AgentSlot[]; nextRequiredSlot: AgentSlot | null; repeatedIntentCount: number };
  safety: { emergency: boolean; reason: string | null };
  activeProviderId: string | null;
};

export const DEFAULT_AGENT_STATE: AgentState = {
  language: 'nl',
  contact: null,
  location: { municipality: 'Uithoorn', postcode: null, source: 'default' },
  intent: { primary: 'general_local', confidence: 0 },
  entities: { category: null, cuisine: null, service: null, fulfilment: null, dish: null, people: null, date: null },
  task: { type: 'local_help', status: 'collecting' },
  specialist: 'general',
  planning: { missingSlots: [], nextRequiredSlot: null, repeatedIntentCount: 0 },
  safety: { emergency: false, reason: null },
  activeProviderId: null,
};

export function extractPostcode(text: string): string {
  return text.match(/\b\d{4}\s?[A-Z]{2}\b/i)?.[0]?.replace(/\s+/g, '').toUpperCase() || '';
}

export function resolvePostcode(postcode: string): AgentState['location']['municipality'] | null {
  const prefix = postcode.slice(0, 4);
  if (['1420', '1421', '1422', '1423'].includes(prefix)) return 'Uithoorn';
  if (prefix === '1424') return 'De Kwakel';
  return null;
}

function mergeEntities(previous: AgentState['entities'], incoming: Partial<AgentState['entities']> | undefined) {
  const merged = { ...previous };
  if (!incoming) return merged;
  (Object.keys(merged) as Array<keyof AgentState['entities']>).forEach((key) => {
    const value = incoming[key];
    if (value !== undefined && value !== null && value !== '') merged[key] = value as never;
  });
  return merged;
}

function mergeLocation(previous: AgentState['location'], incoming: AgentState['location'] | undefined) {
  if (!incoming) return previous;
  const explicit = incoming.source === 'user' || incoming.source === 'postcode';
  if (!explicit && previous.source !== 'default') return previous;
  return {
    municipality: incoming.municipality || previous.municipality,
    postcode: incoming.postcode || previous.postcode,
    source: incoming.source || previous.source,
  };
}

export function applyOrchestratorDecision(decision: {
  language: AgentLanguage;
  location: AgentState['location'];
  intent: AgentState['intent'];
  entities: Partial<AgentState['entities']>;
  specialist: AgentState['specialist'];
  task: { type: string };
}, previous: AgentState): AgentState {
  const sameIntent = previous.intent.primary === decision.intent.primary;
  const sameSpecialist = previous.specialist === decision.specialist;
  const merged: AgentState = {
    ...DEFAULT_AGENT_STATE,
    ...previous,
    contact: previous.contact || null,
    language: decision.language || previous.language,
    location: mergeLocation(previous.location, decision.location),
    intent: decision.intent?.primary ? { primary: decision.intent.primary, confidence: Number(decision.intent.confidence ?? 0.8) } : previous.intent,
    entities: mergeEntities(previous.entities, decision.entities),
    task: { type: decision.task?.type || previous.task.type, status: previous.task.status },
    specialist: decision.specialist || previous.specialist,
    planning: previous.planning || DEFAULT_AGENT_STATE.planning,
    safety: { emergency: false, reason: null },
    activeProviderId: null,
  };

  if (!sameIntent || !sameSpecialist) {
    merged.planning = { missingSlots: [], nextRequiredSlot: null, repeatedIntentCount: 0 };
  } else {
    merged.planning = { ...merged.planning, repeatedIntentCount: merged.planning.repeatedIntentCount + 1 };
  }
  return merged;
}

export function applySpecialistResult(
  state: AgentState,
  result: { captured: Partial<AgentState['entities']>; nextRequiredSlot: AgentSlot | null; missingSlots: AgentSlot[]; status: 'collecting' | 'ready' },
): AgentState {
  const entities = mergeEntities(state.entities, result.captured);
  const missingSlots = result.missingSlots.filter((slot) => slot !== 'location' || Boolean(state.location.municipality));
  return {
    ...state,
    entities,
    planning: { ...state.planning, missingSlots, nextRequiredSlot: result.nextRequiredSlot || missingSlots[0] || null },
    task: { ...state.task, status: result.status },
  };
}

export function buildProviderQuery(state: AgentState): string {
  if (state.entities.service) return state.entities.service;
  if (state.entities.dish) return state.entities.dish;
  if (state.entities.cuisine) return `${state.entities.cuisine} food`;
  if (state.entities.category) return state.entities.category;
  return state.intent.primary === 'find_event' ? 'event' : '';
}

export function stateContext(state: AgentState): string {
  return `STRUCTURED AGENT STATE:\n${JSON.stringify(state, null, 2)}\n\nRULES: treat this state as authoritative conversation context. The orchestrator owns routing; the specialist owns the flow and slot filling. Do not ask for information already represented here. Ask for at most one missing slot at a time.`;
}
