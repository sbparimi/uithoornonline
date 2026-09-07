import type { AgentState } from '../state';
import type { AgentProvider } from '../../supabase/agent';

export type ToolRequest = { capability: 'business.search' | 'business.discover'; query: string };
export type ToolObservation = { status: 'success' | 'failed'; capability: string; retryable: boolean; providers: AgentProvider[]; error?: string };
export type ToolExecutor = (state: AgentState, query: string) => Promise<AgentProvider[]>;

const REGISTERED = new Set(['business.search', 'business.discover']);
const TOOL_TIMEOUT_MS = 12_000;

export function authorizeTool(state: AgentState, request: ToolRequest): { allowed: boolean; reason?: string } {
  if (!REGISTERED.has(request.capability)) return { allowed: false, reason: 'capability_not_registered' };
  if (!state.harness.contract?.allowedCapabilities.includes(request.capability)) return { allowed: false, reason: 'capability_not_allowed_by_task_contract' };
  if (!request.query.trim()) return { allowed: false, reason: 'empty_query' };
  if (!state.location.municipality) return { allowed: false, reason: 'location_missing' };
  return { allowed: true };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('tool_timeout')), timeoutMs);
      }),
    ]);
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
