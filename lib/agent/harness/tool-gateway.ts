import type { AgentState } from '../state';
import type { AgentProvider } from '../../supabase/agent';

export type ToolRequest = { capability: 'business.search' | 'business.discover'; query: string };
export type ToolObservation = { status: 'success' | 'failed'; capability: string; retryable: boolean; providers: AgentProvider[]; error?: string };
export type ToolExecutor = (state: AgentState, query: string) => Promise<AgentProvider[]>;

const ALLOWED = new Set(['business.search', 'business.discover']);

export function authorizeTool(state: AgentState, request: ToolRequest): { allowed: boolean; reason?: string } {
  if (!ALLOWED.has(request.capability)) return { allowed: false, reason: 'capability_not_registered' };
  if (!request.query.trim()) return { allowed: false, reason: 'empty_query' };
  if (!state.location.municipality) return { allowed: false, reason: 'location_missing' };
  return { allowed: true };
}

export async function executeTool(state: AgentState, request: ToolRequest, executor: ToolExecutor): Promise<ToolObservation> {
  const authorization = authorizeTool(state, request);
  if (!authorization.allowed) return { status: 'failed', capability: request.capability, retryable: false, providers: [], error: authorization.reason };
  try { return { status: 'success', capability: request.capability, retryable: true, providers: await executor(state, request.query) }; }
  catch (error) { return { status: 'failed', capability: request.capability, retryable: true, providers: [], error: error instanceof Error ? error.message : 'tool_execution_failed' }; }
}
