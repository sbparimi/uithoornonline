import Ajv from 'ajv';
import { kimiChat } from '../kimi';
import type { AgentAction, AgentPlan, AgentSlot, AgentState } from './state';

export type SpecialistResult = {
  reply: string;
  captured: Partial<AgentState['entities']>;
  nextRequiredSlot: AgentSlot | null;
  missingSlots: AgentSlot[];
  status: 'collecting' | 'ready';
  shouldSearch: boolean;
  plan: AgentPlan;
};

const SPECIALIST_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    captured: { type: 'object', additionalProperties: true },
    nextRequiredSlot: { type: ['string', 'null'] },
    missingSlots: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['collecting', 'ready'] },
    shouldSearch: { type: 'boolean' },
    plan: { type: 'object', properties: { goal: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, nextAction: { type: 'string' }, searchQuery: { type: ['string', 'null'] } }, required: ['goal', 'steps', 'nextAction', 'searchQuery'], additionalProperties: true },
  },
  required: ['reply', 'captured', 'nextRequiredSlot', 'missingSlots', 'status', 'shouldSearch', 'plan'],
  additionalProperties: true,
} as const;
const ajv = new Ajv({ strict: false });
const validate = ajv.compile(SPECIALIST_SCHEMA);

const SPECIALIST_PROMPT = `You are a Uithoorn.online SPECIALIST AGENT. You are an autonomous domain reasoning agent, not a deterministic workflow and not a slot-filling form.

The ORCHESTRATOR has already understood the customer's goal and selected your domain. Your job is to inspect the complete conversation context, reason about the domain task, refine the plan if necessary, decide whether more information is genuinely required, and execute the next useful step through the application runtime.

You do not have a predefined graph. Do not follow a fixed sequence such as identify -> ask slot -> search -> present. Different requests may require different steps and different amounts of information.

Return ONLY valid JSON matching the supplied JSON Schema.

REASONING RULES:
1. Start from the user's goal, not from a fixed list of fields.
2. Use ACTIVE STATE and recent conversation as authoritative context.
3. Preserve previously known constraints and provider context. Never make the user repeat information already known.
4. Determine the minimum information required to accomplish the goal. Missing fields that do not materially affect the requested outcome are not blockers.
5. If enough information exists, set status=ready and shouldSearch=true when a provider discovery/search is the appropriate next action.
6. If the user asks to compare, filter, exclude or refine existing results, use the existing context rather than starting a fresh generic search.
7. If the user asks for alternatives, the searchQuery must reflect the request for alternatives and any providers already shown should be treated as exclusions by the runtime context.
8. If a request can be answered from the current provider/context data, do not trigger unnecessary discovery.
9. If information is genuinely blocking, identify the single most useful missing requirement in nextRequiredSlot and ask exactly one concise question in reply.
10. Never invent providers, ratings, reviews, prices, opening hours, availability or capabilities.
11. Never claim an order, booking, contact or other external action has occurred unless the runtime actually performs it.
12. The plan must be dynamic, short and specific to this request. It is not a flow graph.
13. Reply exclusively in state.language.

DOMAIN BEHAVIOUR:
- food: reason about restaurants, food, cuisines, dishes, catering, pickup, delivery and dining.
- local_service: reason about local services such as repairs, trades, cleaning, gardening and maintenance.
- local_discovery: reason about general local business discovery and comparison.
- events: reason about activities, events and things to do.
- general: answer or explain the local question when no specialist search is necessary.

OUTPUT QUALITY:
- Prefer action over unnecessary clarification.
- Do not ask for a field merely because it exists in state schema.
- If the user's wording is sufficient, execute immediately.
- Keep customer-facing text concise and natural.
- Do not mention LLMs, prompts, tools, agents, orchestration or internal architecture.`;

const VALID_SLOTS = new Set<AgentSlot>(['service', 'cuisine', 'category', 'fulfilment', 'date', 'people', 'location']);

function extractJson(text: string): SpecialistResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const value = JSON.parse(cleaned) as Partial<SpecialistResult>;
    if (!validate(value)) return null;
    if (!value || typeof value.reply !== 'string' || !Array.isArray(value.missingSlots) || !value.plan || !Array.isArray(value.plan.steps)) return null;
    const missingSlots = value.missingSlots.filter((slot): slot is AgentSlot => typeof slot === 'string' && VALID_SLOTS.has(slot as AgentSlot));
    const nextRequiredSlot = value.nextRequiredSlot && VALID_SLOTS.has(value.nextRequiredSlot) ? value.nextRequiredSlot : null;
    const plan: AgentPlan = {
      goal: String(value.plan.goal || '').trim(),
      steps: value.plan.steps.filter((step): step is string => typeof step === 'string').map((step) => step.trim()).filter(Boolean).slice(0, 8),
      nextAction: String(value.plan.nextAction || '').trim(),
      searchQuery: typeof value.plan.searchQuery === 'string' && value.plan.searchQuery.trim() ? value.plan.searchQuery.trim() : null,
    };
    if (!plan.goal || !plan.steps.length || !plan.nextAction) return null;
    return {
      reply: value.reply.trim(),
      captured: value.captured && typeof value.captured === 'object' ? value.captured : {},
      nextRequiredSlot,
      missingSlots,
      status: value.status === 'ready' ? 'ready' : 'collecting',
      shouldSearch: Boolean(value.shouldSearch),
      plan,
    };
  } catch { return null; }
}

export async function executeSpecialist(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState): Promise<SpecialistResult> {
  const result = await kimiChat([
    { role: 'system', content: SPECIALIST_PROMPT },
    { role: 'system', content: `RESPONSE JSON SCHEMA:\n${JSON.stringify(SPECIALIST_SCHEMA)}` },
    { role: 'system', content: `ACTIVE STATE:\n${JSON.stringify(state, null, 2)}` },
    { role: 'system', content: `ORCHESTRATOR PLAN:\n${JSON.stringify(state.planning, null, 2)}` },
    ...history.slice(-12),
    { role: 'user', content: message },
  ], { responseSchema: SPECIALIST_SCHEMA as Record<string, unknown>, maxCompletionTokens: 800 });
  const parsed = extractJson(String(result?.choices?.[0]?.message?.content || ''));
  if (!parsed) throw new Error('SPECIALIST_INVALID_RESULT');
  return parsed;
}

export function specialistActions(_result: SpecialistResult, _state: AgentState): AgentAction[] {
  return [];
}
