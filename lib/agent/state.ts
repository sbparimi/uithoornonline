export type AgentLanguage = 'nl' | 'en';

export type SemanticIntent =
  | 'find_food'
  | 'order_food'
  | 'find_service'
  | 'find_business'
  | 'find_event'
  | 'general_local';

export type AgentState = {
  language: AgentLanguage;
  location: {
    municipality: 'Uithoorn' | 'De Kwakel';
    postcode: string | null;
    source: 'default' | 'user' | 'postcode';
  };
  intent: { primary: SemanticIntent; confidence: number };
  entities: {
    category: string | null;
    cuisine: string | null;
    service: string | null;
    fulfilment: 'pickup' | 'delivery' | 'dine_in' | null;
    dish: string | null;
    people: number | null;
    date: string | null;
  };
  task: {
    type: string;
    status: 'collecting' | 'ready' | 'executing' | 'completed';
  };
  specialist: 'food' | 'local_discovery' | 'local_service' | 'events' | 'general';
  activeProviderId: string | null;
};

export const DEFAULT_AGENT_STATE: AgentState = {
  language: 'nl',
  location: { municipality: 'Uithoorn', postcode: null, source: 'default' },
  intent: { primary: 'general_local', confidence: 0 },
  entities: { category: null, cuisine: null, service: null, fulfilment: null, dish: null, people: null, date: null },
  task: { type: 'local_help', status: 'collecting' },
  specialist: 'general',
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

export function applySemanticInterpretation(
  interpretation: Partial<AgentState> | null,
  previous: AgentState = DEFAULT_AGENT_STATE,
): AgentState {
  const i = interpretation || {};
  return {
    ...previous,
    language: i.language || previous.language,
    location: i.location?.municipality
      ? { ...previous.location, ...i.location }
      : previous.location,
    intent: i.intent?.primary
      ? { primary: i.intent.primary, confidence: Number(i.intent.confidence ?? 0.8) }
      : previous.intent,
    entities: { ...previous.entities, ...(i.entities || {}) },
    task: i.task?.type
      ? { type: i.task.type, status: i.task.status || previous.task.status }
      : previous.task,
    specialist: i.specialist || previous.specialist,
    activeProviderId: previous.activeProviderId,
  };
}

export function buildProviderQuery(state: AgentState): string {
  if (state.entities.cuisine && state.entities.category === 'food') return `${state.entities.cuisine} food`;
  if (state.entities.service) return state.entities.service;
  if (state.entities.cuisine) return state.entities.cuisine;
  if (state.entities.category) return state.entities.category;
  return state.intent.primary === 'find_event' ? 'event' : '';
}

export function stateContext(state: AgentState): string {
  return `STRUCTURED AGENT STATE:\n${JSON.stringify(state, null, 2)}\n\nRULE: treat this state as authoritative conversation context. Do not ask for information already represented here.`;
}
