import type { AgentState } from './state';

const SPECIALIST_INSTRUCTIONS: Record<AgentState['specialist'], string> = {
  food: 'FOOD SPECIALIST: identify cuisine and fulfilment. For ordering, move one step at a time toward pickup/delivery choice, order details, and timing. Respect provider capabilities exactly.',
  local_service: 'LOCAL SERVICE SPECIALIST: identify the service, urgency, location, and the next information needed to match a verified provider.',
  events: 'EVENT SPECIALIST: identify activity type, date/time window, location, and relevant constraints before recommending verified events.',
  local_discovery: 'LOCAL DISCOVERY SPECIALIST: find the most relevant verified local business or service and keep the user moving toward the requested outcome.',
  general: 'GENERAL LOCAL SPECIALIST: identify the resident task and ask only for information necessary to take the next useful step.',
};

export function specialistContext(state: AgentState): string {
  return SPECIALIST_INSTRUCTIONS[state.specialist];
}
