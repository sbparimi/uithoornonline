import type { AgentProvider } from '../../supabase/agent';
import type { AgentState } from '../state';
import type { UnifiedAgentResult } from '../agent-runtime';
import { applyOrchestratorDecision, applySpecialistResult } from '../state';
import { buildTaskContract, intentRequiresDiscovery } from './task-contract';
import { executeTool } from './tool-gateway';
import { verifyProviderResults } from './verification';

export type HarnessObservation = { id: string; capability: string; status: 'success' | 'failed'; summary: string; evidence: Array<{ source: string; detail: string }>; retryable: boolean };
export type HarnessFailure = { type: 'model_output_invalid' | 'tool_failed' | 'verification_failed' | 'max_iterations'; message: string; iteration: number; recoverable: boolean };
export type HarnessResult = { agent: UnifiedAgentResult; state: AgentState; providers: AgentProvider[] };
export type ProviderSearch = (state: AgentState, query: string) => Promise<AgentProvider[]>;

function applyHarnessState(state: AgentState, patch: Partial<AgentState['harness']>): AgentState { return { ...state, harness: { ...state.harness, ...patch } }; }
function observationForProviders(providers: AgentProvider[], verified: ReturnType<typeof verifyProviderResults>): HarnessObservation { return { id: crypto.randomUUID(), capability: 'business.search', status: verified.passed ? 'success' : 'failed', summary: verified.reason, evidence: verified.evidence, retryable: !verified.passed }; }

export async function runHarness(message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, initialState: AgentState, runAgent: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState) => Promise<UnifiedAgentResult>, searchProviders: ProviderSearch): Promise<HarnessResult> {
  let state = applyHarnessState(initialState, { runId: initialState.harness?.runId || crypto.randomUUID(), iteration: 0, status: 'running', observations: [], failures: [], decisions: [], nextAction: 'reason' });
  state = applyHarnessState(state, { contract: buildTaskContract(state, message) });
  let lastAgent: UnifiedAgentResult | null = null; let providers: AgentProvider[] = [];

  for (let iteration = 1; iteration <= 3; iteration += 1) {
    state = applyHarnessState(state, { iteration, nextAction: 'reason' });
    let agent: UnifiedAgentResult;
    try { agent = await runAgent(message, history, state); }
    catch (error) {
      const failure: HarnessFailure = { type: 'model_output_invalid', message: error instanceof Error ? error.message : 'unknown_model_error', iteration, recoverable: iteration < 3 };
      state = applyHarnessState(state, { failures: [...state.harness.failures, failure], nextAction: failure.recoverable ? 'repair_reasoning' : 'escalate' });
      if (failure.recoverable) continue; throw error;
    }
    lastAgent = agent; state = applyOrchestratorDecision(agent.decision, state); state = applySpecialistResult(state, agent.specialist);
    state = applyHarnessState(state, { decisions: [...state.harness.decisions, { iteration, nextAction: agent.decision.plan.nextAction, goal: agent.decision.plan.goal }], nextAction: agent.specialist.shouldSearch ? 'business.search' : 'respond' });
    if (!agent.specialist.shouldSearch || !intentRequiresDiscovery(agent.decision.intent.primary)) { state = applyHarnessState(state, { status: 'completed', nextAction: 'respond' }); return { agent, state, providers }; }

    const query = agent.specialist.plan.searchQuery || agent.decision.plan.searchQuery || '';
    if (!query) { state = applyHarnessState(state, { status: 'completed', nextAction: 'respond' }); return { agent, state, providers }; }
    const tool = await executeTool(state, { capability: 'business.search', query }, searchProviders);
    if (tool.status === 'failed') {
      const failure: HarnessFailure = { type: 'tool_failed', message: tool.error || 'business_search_failed', iteration, recoverable: tool.retryable && iteration < 3 };
      state = applyHarnessState(state, { failures: [...state.harness.failures, failure], nextAction: failure.recoverable ? 'retry_search' : 'escalate' });
      if (!failure.recoverable) throw new Error(failure.message); continue;
    }

    providers = tool.providers;
    const verification = verifyProviderResults(providers);
    state = applyHarnessState(state, { observations: [...state.harness.observations, observationForProviders(providers, verification)], nextAction: verification.passed ? 'verify_results' : 'recover_empty_or_weak_search' });
    if (verification.passed) {
      if (iteration >= 2) { state = applyHarnessState(state, { status: 'completed', nextAction: 'respond' }); return { agent, state, providers }; }
      continue;
    }
  }

  state = applyHarnessState(state, { status: 'failed', nextAction: 'escalate', failures: [...state.harness.failures, { type: 'max_iterations', message: 'Harness iteration budget exhausted', iteration: 3, recoverable: false }] });
  if (!lastAgent) throw new Error('AGENT_HARNESS_NO_RESULT'); return { agent: lastAgent, state, providers };
}
