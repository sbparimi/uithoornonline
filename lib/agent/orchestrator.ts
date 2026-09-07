import { kimiChat } from '../kimi';
import type { AgentLanguage, AgentSlot, AgentState, SemanticIntent } from './state';

export type OrchestratorDecision = {
  language: AgentLanguage;
  location: AgentState['location'];
  intent: { primary: SemanticIntent; confidence: number };
  entities: AgentState['entities'];
  specialist: AgentState['specialist'];
  task: { type: string };
  handoff: { specialist: AgentState['specialist']; reason: string };
  focusSlot: AgentSlot | null;
};

const ORCHESTRATOR_PROMPT = `You are the Uithoorn.online ORCHESTRATOR. You understand intent, preserve context and route to exactly one specialist.

LANGUAGE CONTRACT:
- Only two user-facing languages are allowed: Dutch (nl) and English (en).
- Detect the language of the user's latest meaningful intent/message from its actual wording, not from the website locale, browser locale or contact details.
- If ACTIVE STATE says languageLocked=true, return that same language. Do not switch language because of a short slot answer, website setting or mixed UI.
- If languageLocked=false, the first meaningful user intent establishes the conversation language. Return that detected language.
- Never return any language other than nl or en.

Return ONLY valid JSON with this exact shape:
{
  "language":"nl|en",
  "location":{"municipality":"Uithoorn|De Kwakel","postcode":string|null,"source":"default|user|postcode"},
  "intent":{"primary":"find_food|order_food|find_service|find_business|find_event|general_local","confidence":0.0},
  "entities":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},
  "specialist":"food|local_discovery|local_service|events|general",
  "task":{"type":string},
  "handoff":{"specialist":"food|local_discovery|local_service|events|general","reason":string},
  "focusSlot":"service|cuisine|category|fulfilment|date|people|location|null"
}

ORCHESTRATION RULES:
1. Understand meaning, not keywords. Interpret synonyms, paraphrases, incomplete replies, spelling mistakes and short slot answers in context.
2. The latest user utterance is authoritative for a new request, but a short answer must attach to the active task when it clearly answers its pending slot.
3. "Wat is er te doen?", "iets leuks doen", "activiteiten", "evenementen" -> find_event -> events.
4. "Service nodig", "ik zoek iemand voor een klus", "loodgieter", "elektricien", "schoonmaak" -> find_service -> local_service.
5. Food discovery -> find_food -> food. Ordering/buying food -> order_food -> food.
6. Business/category discovery without a service task -> find_business -> local_discovery.
7. Preserve the active intent for slot answers.
8. Do not invent facts, providers, prices, ratings, availability or capabilities.
9. Default location is Uithoorn unless the user explicitly provides another supported local location or postcode maps to De Kwakel.
10. Never route to an emergency specialist. Safety is handled separately and deterministically.
11. Choose focusSlot only when the latest message supplies, changes or clearly targets that slot. Otherwise null.
12. The specialist executes the workflow. The orchestrator only understands, routes and hands off.`;

function extractJson(text: string): OrchestratorDecision | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const value = JSON.parse(cleaned) as OrchestratorDecision;
    if (!value.intent?.primary || !value.specialist || !value.handoff?.specialist) return null;
    return value;
  } catch { return null; }
}

export async function orchestrate(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState): Promise<OrchestratorDecision> {
  const result = await kimiChat([
    { role: 'system', content: ORCHESTRATOR_PROMPT },
    { role: 'system', content: `ACTIVE STATE:\n${JSON.stringify(state, null, 2)}` },
    { role: 'system', content: `ACTIVE NEXT SLOT: ${state.planning.nextRequiredSlot || 'none'}` },
    ...history.slice(-16),
    { role: 'user', content: message },
  ]);
  const raw = String(result?.choices?.[0]?.message?.content || '');
  const decision = extractJson(raw);
  if (!decision) throw new Error('ORCHESTRATOR_INVALID_DECISION');
  return decision;
}
