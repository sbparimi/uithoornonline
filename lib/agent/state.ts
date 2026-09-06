export type AgentLanguage = 'nl' | 'en';

export type AgentState = {
  language: AgentLanguage;
  location: {
    municipality: 'Uithoorn' | 'De Kwakel';
    postcode: string | null;
    source: 'default' | 'user' | 'postcode';
  };
  intent: {
    primary: 'find_food' | 'order_food' | 'find_service' | 'find_business' | 'find_event' | 'general_local';
    confidence: number;
  };
  entities: {
    category: string | null;
    cuisine: string | null;
    service: string | null;
    fulfilment: 'pickup' | 'delivery' | 'dine_in' | null;
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
  entities: { category: null, cuisine: null, service: null, fulfilment: null },
  task: { type: 'local_help', status: 'collecting' },
  specialist: 'general',
  activeProviderId: null,
};

export function extractPostcode(text: string): string {
  return text.match(/\b\d{4}\s?[A-Z]{2}\b/i)?.[0]?.replace(/\s+/g, '').toUpperCase() || '';
}

function resolvePostcode(postcode: string): AgentState['location']['municipality'] | null {
  const prefix = postcode.slice(0, 4);
  if (['1420', '1421', '1422', '1423'].includes(prefix)) return 'Uithoorn';
  if (prefix === '1424') return 'De Kwakel';
  return null;
}

function contains(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function detectLanguage(text: string, previous: AgentLanguage): AgentLanguage {
  const value = text.toLowerCase();
  const dutch = ['ik ', 'zoek', 'nodig', 'eten', 'bestellen', 'afhalen', 'bezorgen', 'waar', 'welke', 'kan je', 'graag', 'hulp'];
  const english = ['i ', 'need', 'food', 'order', 'pickup', 'delivery', 'where', 'which', 'help', 'looking'];
  const nlScore = dutch.filter((term) => value.includes(term)).length;
  const enScore = english.filter((term) => value.includes(term)).length;
  if (nlScore === 0 && enScore === 0) return previous;
  return enScore > nlScore ? 'en' : 'nl';
}

export function deriveAgentState(message: string, previous: Partial<AgentState> = {}): AgentState {
  const text = message.trim().toLowerCase();
  const postcode = extractPostcode(message);
  const explicitUithoorn = /\buithoorn\b/i.test(message);
  const explicitDeKwakel = /\bde\s+kwakel\b/i.test(message);
  const postcodeLocation = postcode ? resolvePostcode(postcode) : null;

  const location = explicitUithoorn
    ? { municipality: 'Uithoorn' as const, postcode: postcode || previous.location?.postcode || null, source: 'user' as const }
    : explicitDeKwakel
      ? { municipality: 'De Kwakel' as const, postcode: postcode || previous.location?.postcode || null, source: 'user' as const }
      : postcodeLocation
        ? { municipality: postcodeLocation, postcode, source: 'postcode' as const }
        : previous.location?.municipality
          ? { municipality: previous.location.municipality, postcode: previous.location.postcode || null, source: previous.location.source || 'default' }
          : DEFAULT_AGENT_STATE.location;

  const cuisine = contains(text, ['indian', 'indiaas', 'indiaanse', 'dosa', 'idli', 'vada', 'biryani'])
    ? 'Indian'
    : previous.entities?.cuisine || null;

  const category = contains(text, ['food', 'eten', 'restaurant', 'takeaway', 'take away', 'catering', 'maaltijd'])
    ? 'food'
    : previous.entities?.category || null;

  const service = contains(text, ['plumber', 'loodgieter'])
    ? 'plumber'
    : contains(text, ['cleaner', 'schoonmaak'])
      ? 'cleaning'
      : previous.entities?.service || null;

  const fulfilment = contains(text, ['pickup', 'pick up', 'afhalen', 'afhaal'])
    ? 'pickup'
    : contains(text, ['delivery', 'bezorgen', 'bezorging'])
      ? 'delivery'
      : contains(text, ['dine in', 'dine-in', 'ter plaatse', 'eten daar'])
        ? 'dine_in'
        : previous.entities?.fulfilment || null;

  const orderIntent = contains(text, ['order', 'bestel', 'bestellen', 'bestelling', 'place an order']);
  const foodIntent = Boolean(cuisine || category === 'food');
  const serviceIntent = Boolean(service) || contains(text, ['service', 'hulp nodig', 'klus', 'reparatie']);
  const eventIntent = contains(text, ['event', 'evenement', 'activiteiten', 'activity', 'dit weekend', 'weekend']);

  let primary: AgentState['intent']['primary'] = previous.intent?.primary || 'general_local';
  let confidence = previous.intent?.confidence || 0.2;
  let specialist: AgentState['specialist'] = previous.specialist || 'general';
  let taskType = previous.task?.type || 'local_help';

  if (orderIntent && foodIntent) {
    primary = 'order_food';
    confidence = 0.98;
    specialist = 'food';
    taskType = 'order_food';
  } else if (foodIntent) {
    primary = 'find_food';
    confidence = 0.97;
    specialist = 'food';
    taskType = 'find_food';
  } else if (serviceIntent) {
    primary = 'find_service';
    confidence = 0.92;
    specialist = 'local_service';
    taskType = 'find_service';
  } else if (eventIntent) {
    primary = 'find_event';
    confidence = 0.92;
    specialist = 'events';
    taskType = 'find_event';
  } else if (contains(text, ['business', 'bedrijf', 'winkel', 'shop', 'restaurant'])) {
    primary = 'find_business';
    confidence = 0.85;
    specialist = 'local_discovery';
    taskType = 'find_business';
  }

  const state: AgentState = {
    language: detectLanguage(message, previous.language || DEFAULT_AGENT_STATE.language),
    location,
    intent: { primary, confidence },
    entities: { category, cuisine, service, fulfilment },
    task: {
      type: taskType,
      status: primary === 'order_food' && !fulfilment ? 'collecting' : 'ready',
    },
    specialist,
    activeProviderId: previous.activeProviderId || null,
  };

  return state;
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
