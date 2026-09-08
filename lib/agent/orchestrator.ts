import Ajv from 'ajv';
import { kimiChat } from '../kimi';
import type { AgentLanguage, AgentPlan, AgentSlot, AgentState, SemanticIntent } from './state';

export type OrchestratorDecision = {
  language: AgentLanguage;
  location: AgentState['location'];
  intent: { primary: SemanticIntent; confidence: number };
  entities: AgentState['entities'];
  specialist: AgentState['specialist'];
  task: { type: string };
  plan: AgentPlan;
  handoff: { specialist: AgentState['specialist']; reason: string };
  focusSlot: AgentSlot | null;
};

const ORCHESTRATOR_SCHEMA = {
  type: 'object',
  properties: {
    language: { type: 'string', enum: ['nl', 'en'] },
    location: { type: 'object', additionalProperties: true },
    intent: { type: 'object', properties: { primary: { type: 'string', enum: ['find_food', 'order_food', 'find_service', 'find_business', 'find_event', 'general_local'] }, confidence: { type: 'number' } }, required: ['primary', 'confidence'], additionalProperties: true },
    entities: { type: 'object', additionalProperties: true },
    specialist: { type: 'string', enum: ['food', 'local_discovery', 'local_service', 'events', 'general'] },
    task: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'], additionalProperties: true },
    plan: { type: 'object', properties: { goal: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, nextAction: { type: 'string' }, searchQuery: { type: ['string', 'null'] } }, required: ['goal', 'steps', 'nextAction', 'searchQuery'], additionalProperties: true },
    handoff: { type: 'object', properties: { specialist: { type: 'string', enum: ['food', 'local_discovery', 'local_service', 'events', 'general'] }, reason: { type: 'string' } }, required: ['specialist', 'reason'], additionalProperties: true },
    focusSlot: { type: ['string', 'null'] },
  },
  required: ['language', 'location', 'intent', 'entities', 'specialist', 'task', 'plan', 'handoff', 'focusSlot'],
  additionalProperties: true,
} as const;
const ajv = new Ajv({ strict: false });
const validate = ajv.compile(ORCHESTRATOR_SCHEMA);

const ORCHESTRATOR_PROMPT = `You are the Uithoorn.online ORCHESTRATOR. You are an autonomous reasoning agent, not a keyword classifier and not a deterministic workflow engine.

Your responsibility is to understand the customer's actual goal, preserve conversational context, decide what must happen next, create a minimal plan, and delegate domain execution to exactly one specialist. The plan must be generated from the current context and may change on every turn. Never follow a predefined flow or assume that every request needs the same slots.

Return ONLY valid JSON matching the supplied JSON Schema.

LANGUAGE CONTRACT:
- Only Dutch (nl) and English (en) are allowed.
- Detect language from the customer's actual wording.
- If ACTIVE STATE says languageLocked=true, preserve that language.
- Never switch language because of browser, website locale or provider data.

REASONING RULES:
1. Reconstruct the user's goal from the entire recent conversation plus ACTIVE STATE.
2. Preserve useful context. A short answer such as "the first one", "not that one", "tomorrow", "cheaper", "delivery", or "show me others" is a contextual instruction, not a new generic request.
3. Extract all useful facts in one pass. Do not force one-slot-at-a-time collection.
4. Decide whether the current goal can already be executed. Missing information is only a blocker when it is genuinely required to achieve the user's goal.
5. Create a short plan of concrete reasoning/execution steps. The plan is not a fixed graph and must not mention implementation nodes.
6. Choose the specialist that best matches the goal. The specialist receives the complete state and plan and may refine the plan.
7. For search-oriented tasks, produce a natural-language searchQuery that captures the user's actual constraints, exclusions and context. Do not merely echo one entity.
8. If the user asks for alternatives, infer that already-present providers should be excluded from the next search when that context is available.
9. If the user asks about an existing result, preserve the active provider context and plan an attribute lookup or comparison rather than restarting discovery.
10. If the customer clearly changes the task, start a new plan while retaining unrelated durable context such as location and language.
11. Never invent provider facts, prices, ratings, availability, opening hours or capabilities.
12. Never claim an external action occurred unless a real application tool performs it.
13. Safety routing is handled separately. Do not create emergency decisions here.

INTENT GUIDANCE:
- find_service -> local_service for plumbers, electricians, cleaners, gardeners, repairs, installation, maintenance and similar local services.
- find_food/order_food -> food for restaurants, food, catering, cuisine, dishes, pickup, delivery or ordering intent.
- find_business -> local_discovery for general business/category discovery not primarily about food or services.
- find_event -> events for activities, events and things to do.
- general_local -> general for local questions that do not require a specialist search.

QUALITY RULES:
- Prefer semantic meaning over exact wording, including Dutch/English variations, paraphrases and spelling mistakes.
- Never erase useful entities with null values unless the user explicitly clears them.
- Keep the plan short, concrete and executable.
- The most important rule: make the next customer turn productive without making the customer repeat information already known.`;

function extractJson(text: string): OrchestratorDecision | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const value = JSON.parse(cleaned) as OrchestratorDecision;
    if (!validate(value)) return null;
    if (!value.intent?.primary || !value.specialist || !value.handoff?.specialist || !value.plan?.goal || !Array.isArray(value.plan.steps)) return null;
    return value;
  } catch { return null; }
}

export async function orchestrate(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState): Promise<OrchestratorDecision> {
  const result = await kimiChat([
    { role: 'system', content: ORCHESTRATOR_PROMPT },
    { role: 'system', content: `RESPONSE JSON SCHEMA:\n${JSON.stringify(ORCHESTRATOR_SCHEMA)}` },
    { role: 'system', content: `ACTIVE STATE:\n${JSON.stringify(state, null, 2)}` },
    { role: 'system', content: `CURRENT PLAN:\n${JSON.stringify(state.planning, null, 2)}` },
    { role: 'system', content: `ACTIVE PROVIDER: ${state.activeProviderId || 'none'}` },
    ...history.slice(-16),
    { role: 'user', content: message },
  ], { responseSchema: ORCHESTRATOR_SCHEMA, maxCompletionTokens: 800 });
  const raw = String(result?.choices?.[0]?.message?.content || '');
  const decision = extractJson(raw);
  if (!decision) throw new Error('ORCHESTRATOR_INVALID_DECISION');
  return decision;
}
