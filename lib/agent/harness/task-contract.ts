import type { AgentState, SemanticIntent } from '../state';

export type TaskContract = {
  taskId: string;
  goal: string;
  constraints: string[];
  known: Record<string, unknown>;
  unknowns: string[];
  successCriteria: string[];
  allowedCapabilities: string[];
  stopConditions: string[];
};

export function intentRequiresDiscovery(intent: SemanticIntent): boolean {
  return ['find_food', 'order_food', 'find_service', 'find_business', 'find_event'].includes(intent);
}

export function buildTaskContract(state: AgentState, userMessage: string): TaskContract {
  const discovery = intentRequiresDiscovery(state.intent.primary);
  const unknowns: string[] = [];
  if (!state.entities.service && state.intent.primary === 'find_service') unknowns.push('service');
  if (!state.entities.category && ['find_business', 'find_food'].includes(state.intent.primary)) unknowns.push('category');

  return {
    taskId: state.harness?.runId || crypto.randomUUID(),
    goal: state.planning.goal || userMessage,
    constraints: [`location=${state.location.municipality}`, `language=${state.language}`, 'never invent external business facts'],
    known: { userMessage, intent: state.intent.primary, entities: state.entities, location: state.location },
    unknowns,
    successCriteria: discovery ? ['relevant local results', 'evidence-backed factual claims'] : ['answer without unnecessary tool execution'],
    allowedCapabilities: discovery ? ['business.search', 'business.discover'] : ['conversation.respond'],
    stopConditions: ['user goal satisfied', 'required clarification identified', 'recovery exhausted'],
  };
}
