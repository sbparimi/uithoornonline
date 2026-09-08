import type { AgentState } from '../state';
import type { AgentProvider } from '../../supabase/agent';

export type ToolCapability = 'business.search' | 'business.discover';
export type ActionKind = 'tool' | 'respond' | 'clarify' | 'complete';
export type ToolRequest = { capability: ToolCapability; query: string };
export type ToolObservation = { status: 'success' | 'failed'; capability: ToolCapability; retryable: boolean; providers: AgentProvider[]; error?: string };
export type ToolExecutor = (state: AgentState, query: string) => Promise<AgentProvider[]>;

export type CapabilityDefinition = {
  capability: ToolCapability;
  kind: 'tool';
  description: string;
  input: { query: string; required: true };
  sideEffect: 'read';
};

export const CAPABILITIES: CapabilityDefinition[] = [
  { capability: 'business.search', kind: 'tool', description: 'Search verified local provider records for the current Uithoorn/De Kwakel task.', input: { query: 'Concise executable search request preserving explicit constraints.', required: true }, sideEffect: 'read' },
  { capability: 'business.discover', kind: 'tool', description: 'Broaden local provider discovery when verified records are insufficient for the current task.', input: { query: 'Concise executable discovery request preserving explicit constraints.', required: true }, sideEffect: 'read' },
];

const REGISTERED = new Set<ToolCapability>(CAPABILITIES.map((item) => item.capability));
const TOOL_TIMEOUT_MS = 12_000;

export function getCapabilityCatalog(): string {
  return [
    'ACTION KINDS:',
    '- tool: execute one authorized read capability through the harness gateway.',
    '- respond: answer the customer from current context/evidence without a tool.',
    '- clarify: ask for information genuinely required to advance the task.',
    '- complete: explicitly mark the task satisfied; do not invent missing evidence.',
    '',
    'AVAILABLE TOOL CAPABILITIES:',
    ...CAPABILITIES.map((item) => `${item.capability} [kind=${item.kind}, sideEffect=${item.sideEffect}]: ${item.description} Input=query (required).`),
  ].join('\n');
}

export function normalizeActionKey(request: ToolRequest): string {
  return `${request.capability}:${request.query.trim().toLocaleLowerCase().normalize('NFKC').replace(/\s+/g, ' ')}`;
}

export function authorizeTool(state: AgentState, request: ToolRequest): { allowed: boolean; reason?: string } {
  if (!REGISTERED.has(request.capability)) return { allowed: false, reason: 'capability_not_registered' };
  if (!state.harness.contract?.allowedCapabilities.includes(request.capability)) return { allowed: false, reason: 'capability_not_allowed_by_task_contract' };
  if (!request.query.trim()) return { allowed: false, reason: 'empty_query' };
  if (!state.location.municipality) return { allowed: false, reason: 'location_missing' };
  return { allowed: true };
}

export function hasSuccessfulAction(state: AgentState, request: ToolRequest): boolean {
  const key = normalizeActionKey(request);
  return state.harness.observations.some((observation) => observation.status === 'success' && observation.summary.startsWith(`ACTION_KEY=${key};`));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('tool_timeout')), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function executeTool(state: AgentState, request: ToolRequest, executor: ToolExecutor): Promise<ToolObservation> {
  const authorization = authorizeTool(state, request);
  if (!authorization.allowed) return { status: 'failed', capability: request.capability, retryable: false, providers: [], error: authorization.reason };
  try {
    const providers = await withTimeout(executor(state, request.query), TOOL_TIMEOUT_MS);
    return { status: 'success', capability: request.capability, retryable: true, providers };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'tool_execution_failed';
    return { status: 'failed', capability: request.capability, retryable: message === 'tool_timeout' || message.includes('fetch'), providers: [], error: message };
  }
}
