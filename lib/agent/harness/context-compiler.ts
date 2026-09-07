import type { AgentState } from '../state';

export type KnowledgeSourceId =
  | 'product'
  | 'behavior'
  | 'architecture'
  | 'capabilities';

export type CompiledAgentContext = {
  sources: KnowledgeSourceId[];
  rendered: string;
};

type KnowledgeSource = {
  id: KnowledgeSourceId;
  title: string;
  priority: number;
  keywords: string[];
  specialists?: AgentState['specialist'][];
  intents?: AgentState['intent']['primary'][];
  content: string;
};

// This registry mirrors the versioned docs/agent knowledge map. Keeping the
// runtime copy static makes context selection deploy-safe in serverless and
// avoids turning repository documentation into an unbounded prompt payload.
const KNOWLEDGE: KnowledgeSource[] = [
  {
    id: 'product',
    title: 'Product contract',
    priority: 100,
    keywords: ['uithoorn', 'kwakel', 'local', 'business', 'service', 'food', 'restaurant', 'event', 'provider', 'plumber', 'electrician', 'cleaner', 'garden', 'repair', 'catering', 'delivery'],
    content: 'Uithoorn.online is a local discovery agent for Uithoorn and De Kwakel. The agent understands the customer goal, preserves useful context, and searches for real local providers when enough information exists. Provider facts must come from tool observations; never invent provider identity, contact details, prices, ratings, opening hours, availability, or capabilities.',
  },
  {
    id: 'behavior',
    title: 'Agent behavior contract',
    priority: 90,
    keywords: ['find', 'search', 'show', 'other', 'another', 'cheaper', 'near', 'tomorrow', 'today', 'delivery', 'pickup', 'dutch', 'english', 'plumber', 'electrician', 'cleaner', 'restaurant', 'food', 'event'],
    content: 'The agent is contextual and semantic, not a keyword classifier or fixed slot-filling form. Preserve facts across turns. Short follow-ups such as "the first one", "cheaper", "show me others", or "tomorrow" modify the active task. Ask only when missing information genuinely blocks the requested outcome. Prefer action over clarification. External facts require tools and verification. Customer-facing replies are concise and only in the selected language.',
  },
  {
    id: 'capabilities',
    title: 'Capability and evidence contract',
    priority: 80,
    keywords: ['provider', 'search', 'plumber', 'electrician', 'cleaner', 'service', 'restaurant', 'food', 'event', 'business', 'contact', 'address', 'phone'],
    specialists: ['local_service', 'local_discovery', 'food', 'events'],
    intents: ['find_service', 'find_business', 'find_food', 'order_food', 'find_event'],
    content: 'Local discovery capabilities may search real providers and return provider cards. Search should run once the task is ready. Evidence must support provider identity and the relevant contact/location information before a provider is treated as verified. Contact capture is optional and must never block discovery. Never claim a provider action occurred unless the application actually executed it.',
  },
  {
    id: 'architecture',
    title: 'Runtime architecture contract',
    priority: 70,
    keywords: ['agent', 'harness', 'plan', 'tool', 'observation', 'verification', 'recovery', 'execution', 'context'],
    content: 'The runtime uses an agent-first harness: reason, plan, authorize, execute a tool, observe, verify, recover when bounded, then respond. The LLM proposes intent and actions; the harness controls tool authorization and application execution. Tool observations are authoritative external evidence. Recovery remains internal and bounded; do not expose internal architecture or failure mechanics to customers.',
  },
];

function normalize(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKC');
}

function scoreSource(source: KnowledgeSource, text: string, state: AgentState): number {
  const normalized = normalize(text);
  let score = source.priority;

  for (const keyword of source.keywords) {
    if (normalized.includes(normalize(keyword))) score += 12;
  }

  if (source.specialists?.includes(state.specialist)) score += 30;
  if (source.intents?.includes(state.intent.primary)) score += 30;
  if (state.harness.observations.length > 0 && source.id === 'capabilities') score += 20;
  if (state.harness.failures.length > 0 && source.id === 'architecture') score += 15;

  return score;
}

export function compileAgentContext(message: string, state: AgentState): CompiledAgentContext {
  const taskText = [
    message,
    state.intent.primary,
    state.specialist,
    state.entities.category || '',
    state.entities.service || '',
    state.entities.cuisine || '',
    state.entities.dish || '',
    state.planning.goal,
    state.planning.searchQuery || '',
  ].join(' ');

  const selected = KNOWLEDGE
    .map((source) => ({ source, score: scoreSource(source, taskText, state) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ source }) => source);

  const observations = state.harness.observations.slice(-3).map((observation) => ({
    capability: observation.capability,
    status: observation.status,
    summary: observation.summary,
    evidence: observation.evidence.slice(0, 4),
  }));

  const renderedSources = selected.map((source) => `## ${source.title} [${source.id}]\n${source.content}`).join('\n\n');
  const observationBlock = observations.length
    ? `\n\n## Harness observations [runtime]\n${JSON.stringify(observations)}`
    : '';

  return {
    sources: selected.map((source) => source.id),
    rendered: `${renderedSources}${observationBlock}`.slice(0, 6500),
  };
}
