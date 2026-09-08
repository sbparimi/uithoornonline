import { kimiChat } from '../kimi';
import type { AgentLanguage, AgentPlan, AgentSlot, AgentState, SemanticIntent } from './state';
import { compileAgentContext } from './harness/context-compiler';
import { getCapabilityCatalog } from './harness/tool-gateway';
import type { ActionKind } from './harness/tool-gateway';

export type AgentAction = {
  kind: ActionKind;
  capability: 'business.search' | 'business.discover' | null;
  arguments: { query?: string };
  rationale: string;
};

export type UnifiedAgentResult = {
  decision: { language: AgentLanguage; location: AgentState['location']; intent: AgentState['intent']; entities: Partial<AgentState['entities']>; specialist: AgentState['specialist']; task: { type: string }; plan: AgentPlan };
  action: AgentAction;
  specialist: { reply: string; captured: Partial<AgentState['entities']>; nextRequiredSlot: AgentSlot | null; missingSlots: AgentSlot[]; status: 'collecting' | 'ready'; shouldSearch: boolean; plan: AgentPlan };
};

const PROMPT = `You are the autonomous Uithoorn.online customer agent. Combine semantic understanding, domain reasoning, planning and action selection in ONE reasoning turn. You are not a keyword classifier, fixed workflow, slot-filling form, or deterministic routing engine.

Return ONLY valid JSON with exactly this top-level shape:
{"decision":{"language":"nl|en","location":{"municipality":"Uithoorn|De Kwakel","postcode":string|null,"source":"default|user|postcode"},"intent":{"primary":"find_food|order_food|find_service|find_business|find_event|general_local","confidence":0.0},"entities":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},"specialist":"food|local_discovery|local_service|events|general","task":{"type":string},"plan":{"goal":string,"steps":[string],"nextAction":string,"searchQuery":string|null}},"action":{"kind":"tool|respond|clarify|complete","capability":"business.search|business.discover|null","arguments":{"query":string|null},"rationale":string},"specialist":{"reply":string,"captured":{"category":string|null,"cuisine":string|null,"service":string|null,"fulfilment":"pickup|delivery|dine_in"|null,"dish":string|null,"people":number|null,"date":string|null},"nextRequiredSlot":"service|cuisine|category|fulfilment|date|people|location|null","missingSlots":["service|cuisine|category|fulfilment|date|people|location"],"status":"collecting|ready","shouldSearch":true|false,"plan":{"goal":string,"steps":[string],"nextAction":string,"searchQuery":string|null}}}

ACTION RULES:
- Select an action based on the current goal, state and observations; do not mechanically choose from keywords.
- kind=tool requires a non-null capability and executable arguments.query. The harness authorizes and executes it.
- kind=respond means answer now from available context/evidence; capability must be null.
- kind=clarify means ask one concise question only when required information is genuinely missing; capability must be null.
- kind=complete means the current verified evidence already satisfies the goal; capability must be null.
- business.search searches verified local provider records. business.discover performs broader external local discovery when verified records may be insufficient.
- Never claim a tool executed merely because you selected it.
- Do not select the same successful capability/query again unless the user explicitly changed the task or a new observation makes a materially different action necessary.

REASONING RULES:
- Detect Dutch/English from the customer message; preserve languageLocked state.
- Use ACTIVE STATE, TASK CONTRACT, HARNESS OBSERVATIONS and relevant knowledge as authoritative context.
- Preserve useful facts across turns. Short follow-ups such as "plumber", "the first one", "tomorrow", "cheaper", "delivery", "not that one" and "show me others" are contextual instructions.
- Extract useful facts in one pass. Do not force one-slot-at-a-time collection.
- Missing information blocks only when genuinely required.
- If enough information exists, status=ready and select an executable tool action.
- If verified observations already answer the request, prefer complete or respond over another tool call.
- If the user changes the task, replan while retaining durable context.
- Never invent provider facts, prices, ratings, availability, opening hours or capabilities.
- Keep plans short and executable. Prefer action over unnecessary clarification.
- Customer-facing reply must be concise and exclusively in the selected language; it may be empty for tool/complete actions.

INTENT: find_service covers trades/repairs; find_food/order_food covers restaurants/food/catering; find_business covers general business discovery; find_event covers activities/events; general_local covers local questions without discovery.
SPECIALIST: food, local_discovery, local_service, events, or general respectively.
QUALITY: semantic meaning beats exact wording; understand Dutch/English variations, paraphrases and spelling mistakes; never erase known entities unless explicitly cleared; never mention internal architecture.`;

const VALID_SLOTS = new Set<AgentSlot>(['service','cuisine','category','fulfilment','date','people','location']);
const VALID_INTENTS = new Set<SemanticIntent>(['find_food','order_food','find_service','find_business','find_event','general_local']);
const VALID_SPECIALISTS = new Set<AgentState['specialist']>(['food','local_discovery','local_service','events','general']);
const VALID_KINDS = new Set<ActionKind>(['tool','respond','clarify','complete']);
const VALID_CAPABILITIES = new Set<NonNullable<AgentAction['capability']>>(['business.search','business.discover']);

function extractJson(text: string): UnifiedAgentResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/i,'').trim();
  const candidates = [cleaned]; const firstBrace = cleaned.indexOf('{'); const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace && cleaned.slice(firstBrace,lastBrace+1) !== cleaned) candidates.push(cleaned.slice(firstBrace,lastBrace+1));
  for (const candidate of candidates) try {
    const value = JSON.parse(candidate) as Partial<UnifiedAgentResult>; const decision=value.decision; const action=value.action; const specialist=value.specialist;
    if (!decision || !action || !specialist || !decision.intent || !decision.plan || !specialist.plan) continue;
    if (!VALID_INTENTS.has(decision.intent.primary) || !VALID_SPECIALISTS.has(decision.specialist)) continue;
    if (!Array.isArray(decision.plan.steps) || !decision.plan.goal || !decision.plan.nextAction) continue;
    if (!Array.isArray(specialist.missingSlots) || !Array.isArray(specialist.plan.steps) || !specialist.plan.goal || !specialist.plan.nextAction) continue;
    if (!VALID_KINDS.has(action.kind)) continue;
    if (action.kind === 'tool') {
      if (!action.capability || !VALID_CAPABILITIES.has(action.capability) || !String(action.arguments?.query || '').trim()) continue;
    } else if (action.capability !== null && action.capability !== undefined) continue;
    const normalizePlan=(plan:AgentPlan):AgentPlan=>({goal:String(plan.goal).trim(),steps:plan.steps.filter((s):s is string=>typeof s==='string').map(s=>s.trim()).filter(Boolean).slice(0,8),nextAction:String(plan.nextAction).trim(),searchQuery:typeof plan.searchQuery==='string'&&plan.searchQuery.trim()?plan.searchQuery.trim():null});
    const missingSlots=specialist.missingSlots.filter((s):s is AgentSlot=>typeof s==='string'&&VALID_SLOTS.has(s as AgentSlot));
    const nextRequiredSlot=specialist.nextRequiredSlot&&VALID_SLOTS.has(specialist.nextRequiredSlot)?specialist.nextRequiredSlot:null;
    return {decision:{language:decision.language==='en'?'en':'nl',location:decision.location||{municipality:'Uithoorn',postcode:null,source:'default'},intent:{primary:decision.intent.primary,confidence:Number(decision.intent.confidence??0.8)},entities:decision.entities||{},specialist:decision.specialist,task:{type:String(decision.task?.type||'local_help')},plan:normalizePlan(decision.plan)},action:{kind:action.kind,capability:action.capability??null,arguments:{query:typeof action.arguments?.query==='string'&&action.arguments.query.trim()?action.arguments.query.trim():undefined},rationale:String(action.rationale||'').trim().slice(0,500)},specialist:{reply:String(specialist.reply||'').trim(),captured:specialist.captured&&typeof specialist.captured==='object'?specialist.captured:{},nextRequiredSlot,missingSlots,status:specialist.status==='ready'?'ready':'collecting',shouldSearch:Boolean(specialist.shouldSearch),plan:normalizePlan(specialist.plan)}};
  } catch { /* try next candidate */ }
  console.error('AGENT_INVALID_DECISION_RAW',{raw:cleaned.slice(0,2000)}); return null;
}

export async function runAgent(message:string,history:Array<{role:'user'|'assistant';content:string}>,state:AgentState):Promise<UnifiedAgentResult>{
  const context=compileAgentContext(message,state);
  const result=await kimiChat([
    {role:'system',content:PROMPT},
    {role:'system',content:`AVAILABLE CAPABILITIES:\n${getCapabilityCatalog()}`},
    {role:'system',content:`TASK CONTRACT:\n${JSON.stringify(state.harness.contract)}`},
    {role:'system',content:`RELEVANT KNOWLEDGE:\n${context.rendered}\n\nKNOWLEDGE SOURCES: ${context.sources.join(', ')}`},
    {role:'system',content:`ACTIVE STATE:\n${JSON.stringify(state)}`},
    {role:'system',content:`CURRENT PLAN:\n${JSON.stringify(state.planning)}`},
    {role:'system',content:`HARNESS OBSERVATIONS:\n${JSON.stringify(state.harness.observations.slice(-3))}`},
    {role:'system',content:`HARNESS FAILURES:\n${JSON.stringify(state.harness.failures.slice(-3))}`},
    ...history.slice(-8),{role:'user',content:message}
  ],{maxCompletionTokens:1600,temperature:0.1,reasoningEffort:'low'});
  const parsed=extractJson(String(result?.choices?.[0]?.message?.content||''));
  if(!parsed) throw new Error('AGENT_INVALID_DECISION'); return parsed;
}
