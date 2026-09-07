import { kimiChat } from '../kimi';
import type { AgentLanguage, AgentPlan, AgentSlot, AgentState, SemanticIntent } from './state';

export type UnifiedAgentResult = {
  decision: {
    language: AgentLanguage;
    location: AgentState['location'];
    intent: AgentState['intent'];
    entities: Partial<AgentState['entities']>;
    specialist: AgentState['specialist'];
    task: { type: string };
    plan: AgentPlan;
  };
  specialist: {
    reply: string;
    captured: Partial<AgentState['entities']>;
    nextRequiredSlot: AgentSlot | null;
    missingSlots: AgentSlot[];
    status: 'collecting' | 'ready';
    shouldSearch: boolean;
    plan: AgentPlan;
  };
};

const PROMPT = `You are the autonomous Uithoorn.online customer agent. You combine orchestration, domain reasoning, planning and execution planning in ONE reasoning turn. You are not a keyword classifier, fixed workflow, slot-filling form, or deterministic routing engine.

Your job is to understand the customer's actual goal using the current state and recent conversation, decide what should happen next, capture useful facts, determine whether the request can be executed now, and produce the customer-facing response if clarification is genuinely required.

Return ONLY valid JSON with exactly this top-level shape:
{
  "decision": {
    "language":"nl|en",
    "location":{"municipality":"Uithoorn|De Kwakel","postcode":string|null,"source":"default|user|postcode"},
    "intent":{"primary":"find_food|order_food|find_service|find_business|find_event|general_local","confidence":0.0},
    "entities":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},
    "specialist":"food|local_discovery|local_service|events|general",
    "task":{"type":string},
    "plan":{"goal":string,"steps":[string],"nextAction":string,"searchQuery":string|null}
  },
  "specialist": {
    "reply":string,
    "captured":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},
    "nextRequiredSlot":"service|cuisine|category|fulfilment|date|people|location|null",
    "missingSlots":["service|cuisine|category|fulfilment|date|people|location"],
    "status":"collecting|ready",
    "shouldSearch":true|false,
    "plan":{"goal":string,"steps":[string],"nextAction":string,"searchQuery":string|null}
  }
}

LANGUAGE:
- Only Dutch or English.
- Detect the customer's language from the actual message and conversation.
- If ACTIVE STATE has languageLocked=true, preserve that language.
- Never switch language because of provider data or website locale.

CONTEXT AND REASONING:
1. Treat ACTIVE STATE and recent conversation as authoritative context.
2. Preserve useful facts. Short messages such as "plumber", "the first one", "tomorrow", "cheaper", "delivery", "not that one" or "show me others" are contextual instructions.
3. Extract all useful facts in one pass. Do not force one-slot-at-a-time collection.
4. Missing information is a blocker only when it is genuinely required for the requested outcome.
5. If enough information exists, set status=ready and shouldSearch=true when local discovery is the appropriate execution step.
6. If the request can be answered from known context, do not search unnecessarily.
7. If the user asks for alternatives, preserve the current task and create a search query representing alternatives/exclusions.
8. If the user changes the task, replan while retaining durable context such as language and location.
9. Never invent provider facts, prices, ratings, availability, opening hours or capabilities.
10. Never claim an external action happened. The application performs real searches, lead writes and other tools after this response.
11. Keep plans short and executable. Do not output implementation nodes or internal architecture.
12. Prefer action over clarification.
13. The customer-facing reply must be concise and exclusively in the selected language. When ready for search, reply may be empty because the application will render provider cards.

INTENT:
- find_service: plumbers, electricians, cleaners, gardeners, repairs, installation, maintenance and similar services.
- find_food/order_food: restaurants, food, catering, cuisine, dishes, pickup, delivery and ordering.
- find_business: general business/category discovery.
- find_event: activities, events and things to do.
- general_local: local questions that do not require specialist discovery.

SPECIALIST:
- food for food/restaurants/catering.
- local_service for local services/trades.
- local_discovery for general businesses.
- events for activities/events.
- general for local questions that need no discovery.

QUALITY:
- Semantic meaning beats exact wording; understand Dutch/English variations, paraphrases and spelling mistakes.
- Never erase known entities with null unless the customer explicitly clears them.
- Do not ask for information merely because the state schema contains that field.
- If the customer's wording is sufficient, execute immediately.
- Never mention LLMs, prompts, tools, orchestration, specialists or internal architecture.`;

const VALID_SLOTS = new Set<AgentSlot>(['service', 'cuisine', 'category', 'fulfilment', 'date', 'people', 'location']);
const VALID_INTENTS = new Set<SemanticIntent>(['find_food', 'order_food', 'find_service', 'find_business', 'find_event', 'general_local']);
const VALID_SPECIALISTS = new Set<AgentState['specialist']>(['food', 'local_discovery', 'local_service', 'events', 'general']);

function extractJson(text: string): UnifiedAgentResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace && cleaned.slice(firstBrace, lastBrace + 1) !== cleaned) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as Partial<UnifiedAgentResult>;
      const decision = value.decision;
      const specialist = value.specialist;
      if (!decision || !specialist || !decision.intent || !decision.plan || !specialist.plan) continue;
      if (!VALID_INTENTS.has(decision.intent.primary) || !VALID_SPECIALISTS.has(decision.specialist)) continue;
      if (!Array.isArray(decision.plan.steps) || !decision.plan.goal || !decision.plan.nextAction) continue;
      if (!Array.isArray(specialist.missingSlots) || !Array.isArray(specialist.plan.steps) || !specialist.plan.goal || !specialist.plan.nextAction) continue;

      const normalizePlan = (plan: AgentPlan): AgentPlan => ({
        goal: String(plan.goal).trim(),
        steps: plan.steps.filter((step): step is string => typeof step === 'string').map((step) => step.trim()).filter(Boolean).slice(0, 8),
        nextAction: String(plan.nextAction).trim(),
        searchQuery: typeof plan.searchQuery === 'string' && plan.searchQuery.trim() ? plan.searchQuery.trim() : null,
      });

      const missingSlots = specialist.missingSlots.filter((slot): slot is AgentSlot => typeof slot === 'string' && VALID_SLOTS.has(slot as AgentSlot));
      const nextRequiredSlot = specialist.nextRequiredSlot && VALID_SLOTS.has(specialist.nextRequiredSlot) ? specialist.nextRequiredSlot : null;
      const status = specialist.status === 'ready' ? 'ready' : 'collecting';

      return {
        decision: {
          language: decision.language === 'en' ? 'en' : 'nl',
          location: decision.location || { municipality: 'Uithoorn', postcode: null, source: 'default' },
          intent: { primary: decision.intent.primary, confidence: Number(decision.intent.confidence ?? 0.8) },
          entities: decision.entities || {},
          specialist: decision.specialist,
          task: { type: String(decision.task?.type || 'local_help') },
          plan: normalizePlan(decision.plan),
        },
        specialist: {
          reply: String(specialist.reply || '').trim(),
          captured: specialist.captured && typeof specialist.captured === 'object' ? specialist.captured : {},
          nextRequiredSlot,
          missingSlots,
          status,
          shouldSearch: Boolean(specialist.shouldSearch),
          plan: normalizePlan(specialist.plan),
        },
      };
    } catch {
      // Try the extracted JSON candidate if the model wrapped it in prose/markdown.
    }
  }

  console.error('AGENT_INVALID_DECISION_RAW', { raw: cleaned.slice(0, 2000) });
  return null;
}

export async function runAgent(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  state: AgentState,
): Promise<UnifiedAgentResult> {
  const result = await kimiChat([
    { role: 'system', content: PROMPT },
    { role: 'system', content: `ACTIVE STATE:\n${JSON.stringify(state)}` },
    { role: 'system', content: `CURRENT PLAN:\n${JSON.stringify(state.planning)}` },
    { role: 'system', content: `ACTIVE PROVIDER: ${state.activeProviderId || 'none'}` },
    ...history.slice(-8),
    { role: 'user', content: message },
  ], { maxCompletionTokens: 1600, temperature: 0.1, reasoningEffort: 'low' });

  const raw = String(result?.choices?.[0]?.message?.content || '');
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('AGENT_INVALID_DECISION');
  return parsed;
}
