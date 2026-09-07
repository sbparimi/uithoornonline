export type AgentLanguage = 'nl' | 'en';

export type SemanticIntent = 'find_food' | 'order_food' | 'find_service' | 'find_business' | 'find_event' | 'general_local';
export type AgentSlot = 'service' | 'cuisine' | 'category' | 'fulfilment' | 'date' | 'people' | 'location';
export type AgentAction = { label: string; value: string; kind: 'quick_reply' | 'emergency' };

export type AgentState = {
  language: AgentLanguage;
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

function deriveMissingSlots(state: AgentState): AgentSlot[] {
  switch (state.intent.primary) {
    case 'find_service': return state.entities.service ? [] : ['service'];
    case 'find_food':
      if (!state.entities.category && !state.entities.cuisine && !state.entities.dish) return ['category'];
      return state.entities.fulfilment ? [] : ['fulfilment'];
    case 'order_food':
      if (!state.entities.category && !state.entities.cuisine && !state.entities.dish) return ['category'];
      return state.entities.fulfilment ? [] : ['fulfilment'];
    case 'find_event': return state.entities.date ? [] : ['date'];
    case 'find_business': return state.entities.category ? [] : ['category'];
    default: return [];
  }
}

export function planState(state: AgentState, previous: AgentState = DEFAULT_AGENT_STATE): AgentState {
  const missingSlots = deriveMissingSlots(state);
  const previousPlanning = previous.planning || DEFAULT_AGENT_STATE.planning;
  const repeatedIntentCount = state.intent.primary === previous.intent.primary ? previousPlanning.repeatedIntentCount + 1 : 0;
  return {
    ...state,
    planning: { missingSlots, nextRequiredSlot: missingSlots[0] || null, repeatedIntentCount },
    task: { ...state.task, status: missingSlots.length ? 'collecting' : 'ready' },
  };
}

export function applySemanticInterpretation(interpretation: Partial<AgentState> | null, previous: AgentState = DEFAULT_AGENT_STATE): AgentState {
  const i = interpretation || {};
  const previousPlanning = previous.planning || DEFAULT_AGENT_STATE.planning;
  const previousSafety = previous.safety || DEFAULT_AGENT_STATE.safety;
  const merged: AgentState = {
    ...DEFAULT_AGENT_STATE,
    ...previous,
    language: i.language || previous.language,
    location: i.location?.municipality ? { ...previous.location, ...i.location } : previous.location,
    intent: i.intent?.primary ? { primary: i.intent.primary, confidence: Number(i.intent.confidence ?? 0.8) } : previous.intent,
    entities: { ...DEFAULT_AGENT_STATE.entities, ...previous.entities, ...(i.entities || {}) },
    task: i.task?.type ? { type: i.task.type, status: i.task.status || previous.task.status } : previous.task,
    specialist: i.specialist || previous.specialist,
    planning: previousPlanning,
    safety: previousSafety,
    activeProviderId: null,
  };
  if (i.safety?.emergency === true) merged.safety = { emergency: true, reason: i.safety.reason || 'explicit emergency signal' };
  return planState(merged, previous);
}

export function buildProviderQuery(state: AgentState): string {
  if (state.entities.cuisine && state.entities.category === 'food') return `${state.entities.cuisine} food`;
  if (state.entities.service) return state.entities.service;
  if (state.entities.cuisine) return state.entities.cuisine;
  if (state.entities.category) return state.entities.category;
  return state.intent.primary === 'find_event' ? 'event' : '';
}

export function stateContext(state: AgentState): string {
  return `STRUCTURED AGENT STATE:\n${JSON.stringify(state, null, 2)}\n\nRULES: treat this state as authoritative conversation context. Do not ask for information already represented here. Ask for at most one missing slot at a time. If nextRequiredSlot is present, that is the only slot to ask for before proceeding.`;
}
