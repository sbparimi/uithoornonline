import type { AgentState, SemanticIntent } from '../state';

export type TaskContract = {
  version: 1;
  taskId: string;
  goal: string;
  constraints: string[];
  known: Record<string, unknown>;
  unknowns: string[];
  successCriteria: string[];
  allowedCapabilities: string[];
  stopConditions: string[];
  escalationConditions: string[];
};

export function intentRequiresDiscovery(intent: SemanticIntent): boolean {
  return ['find_food', 'order_food', 'find_service', 'find_business', 'find_event'].includes(intent);
}

function deriveUnknowns(state: AgentState): string[] {
  const unknowns: string[] = [];
  if (!state.location.municipality) unknowns.push('location');
  if (state.intent.primary === 'find_service' && !state.entities.service && !state.entities.category) unknowns.push('service');
  if (['find_business', 'find_food'].includes(state.intent.primary) && !state.entities.category && !state.entities.cuisine && !state.entities.dish) unknowns.push('category');
  if (state.intent.primary === 'order_food' && !state.entities.dish && !state.entities.cuisine && !state.entities.category) unknowns.push('food_or_cuisine');
  return unknowns;
}

function capabilitiesFor(state: AgentState): string[] {
  if (intentRequiresDiscovery(state.intent.primary)) return ['business.search', 'business.discover'];
  return ['conversation.respond'];
}

export function buildTaskContract(state: AgentState, userMessage: string): TaskContract {
  const discovery = intentRequiresDiscovery(state.intent.primary);
  const goal = state.planning.goal?.trim() || userMessage.trim();
  return {
    version: 1,
    taskId: state.harness?.runId || crypto.randomUUID(),
    goal,
    constraints: [
      `location=${state.location.municipality}`,
      `language=${state.language}`,
      'preserve explicit user constraints',
      'never invent external business facts',
      'do not repeat a verified capability unnecessarily',
    ],
    known: {
      userMessage,
      intent: state.intent.primary,
      intentConfidence: state.intent.confidence,
      entities: state.entities,
      location: state.location,
      currentPlan: state.planning,
      priorObservations: state.harness.observations.slice(-3),
    },
    unknowns: deriveUnknowns(state),
    successCriteria: discovery
      ? ['relevant local results', 'evidence-backed factual claims', 'user constraints preserved']
      : ['answer without unnecessary tool execution', 'answer in the selected language'],
    allowedCapabilities: capabilitiesFor(state),
    stopConditions: [
      'user goal satisfied',
      'required clarification identified',
      'verified evidence is sufficient for the requested answer',
      'recovery exhausted',
    ],
    escalationConditions: [
      'critical evidence conflicts',
      'required capability unavailable',
      'iteration budget exhausted',
    ],
  };
}
