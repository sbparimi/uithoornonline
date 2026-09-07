import type { AgentProvider } from '../../supabase/agent';
import type { AgentState } from '../state';
import type { UnifiedAgentResult } from '../agent-runtime';
import { applyOrchestratorDecision, applySpecialistResult } from '../state';
import { buildTaskContract, intentRequiresDiscovery } from './task-contract';
import { executeTool } from './tool-gateway';
import { verifyProviderResults } from './verification';

export type HarnessObservation = { id: string; capability: string; status: 'success' | 'failed'; summary: string; evidence: Array<{ source: string; detail: string }>; retryable: boolean };
export type HarnessFailure = { type: 'model_output_invalid' | 'tool_failed' | 'verification_failed' | 'policy_denied' | 'missing_context' | 'max_iterations'; message: string; iteration: number; recoverable: boolean };
export type HarnessResult = { agent: UnifiedAgentResult; state: AgentState; providers: AgentProvider[] };
export type ProviderSearch = (state: AgentState, query: string) => Promise<AgentProvider[]>;

const MAX_ITERATIONS = 3;

function applyHarnessState(state: AgentState, patch: Partial<AgentState['harness']>): AgentState {
  return { ...state, harness: { ...state.harness, ...patch } };
}

function recordFailure(state: AgentState, failure: HarnessFailure, nextAction: string): AgentState {
  return applyHarnessState(state, {
    failures: [...state.harness.failures, failure],
    nextAction,
  });
}

function observationForProviders(providers: AgentProvider[], verified: ReturnType<typeof verifyProviderResults>): HarnessObservation {
  return {
    id: crypto.randomUUID(),
    capability: 'business.search',
    status: verified.passed ? 'success' : 'failed',
    summary: verified.reason,
    evidence: verified.evidence,
    retryable: !verified.passed,
  };
}

function applyAgentToState(state: AgentState, agent: UnifiedAgentResult): AgentState {
  let next = applyOrchestratorDecision(agent.decision, state);
  next = applySpecialistResult(next, agent.specialist);
  return next;
}

export async function runHarness(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  initialState: AgentState,
  runAgent: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>, state: AgentState) => Promise<UnifiedAgentResult>,
  searchProviders: ProviderSearch,
): Promise<HarnessResult> {
  let state = applyHarnessState(initialState, {
    runId: initialState.harness?.runId || crypto.randomUUID(),
    iteration: 0,
    status: 'running',
    observations: [],
    failures: [],
    decisions: [],
    nextAction: 'reason',
  });

  let lastAgent: UnifiedAgentResult | null = null;
  let providers: AgentProvider[] = [];

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
    state = applyHarnessState(state, { iteration, nextAction: 'reason' });

    // The contract is rebuilt from the latest durable state on every reasoning cycle.
    // This means the model sees the current task, observations, failures and plan,
    // rather than a contract frozen at the start of the request.
    state = applyHarnessState(state, { contract: buildTaskContract(state, message) });

    let agent: UnifiedAgentResult;
    try {
      agent = await runAgent(message, history, state);
    } catch (error) {
      const failure: HarnessFailure = {
        type: 'model_output_invalid',
        message: error instanceof Error ? error.message : 'unknown_model_error',
        iteration,
        recoverable: iteration < MAX_ITERATIONS,
      };
      state = recordFailure(state, failure, failure.recoverable ? 'repair_reasoning' : 'escalate');
      if (failure.recoverable) continue;
      throw error;
    }

    lastAgent = agent;
    state = applyAgentToState(state, agent);
    // Recompile the contract after the LLM has understood the request. The first
    // contract is provisional; this one reflects the actual semantic task.
    state = applyHarnessState(state, {
      contract: buildTaskContract(state, message),
      decisions: [
        ...state.harness.decisions,
        {
          iteration,
          nextAction: agent.decision.plan.nextAction,
          goal: agent.decision.plan.goal,
          rationale: agent.specialist.plan.nextAction,
        },
      ],
      nextAction: agent.specialist.shouldSearch ? 'authorize_business.search' : 'respond',
    });

    if (!agent.specialist.shouldSearch || !intentRequiresDiscovery(agent.decision.intent.primary)) {
      state = applyHarnessState(state, { status: 'completed', nextAction: 'respond' });
      return { agent, state, providers };
    }

    const query = agent.specialist.plan.searchQuery || agent.decision.plan.searchQuery || '';
    if (!query) {
      state = recordFailure(state, {
        type: 'missing_context',
        message: 'Agent requested discovery without an executable search query',
        iteration,
        recoverable: false,
      }, 'respond');
      state = applyHarnessState(state, { status: 'completed' });
      return { agent, state, providers };
    }

    state = applyHarnessState(state, { nextAction: 'business.search' });
    const tool = await executeTool(state, { capability: 'business.search', query }, searchProviders);

    if (tool.status === 'failed') {
      const type: HarnessFailure['type'] = tool.error === 'capability_not_allowed_by_task_contract' || tool.error === 'capability_not_registered' ? 'policy_denied' : 'tool_failed';
      const failure: HarnessFailure = {
        type,
        message: tool.error || 'business_search_failed',
        iteration,
        recoverable: tool.retryable && iteration < MAX_ITERATIONS,
      };
      const failedObservation: HarnessObservation = {
        id: crypto.randomUUID(),
        capability: tool.capability,
        status: 'failed',
        summary: failure.message,
        evidence: [],
        retryable: tool.retryable,
      };
      state = applyHarnessState(state, {
        observations: [...state.harness.observations, failedObservation],
      });
      state = recordFailure(state, failure, failure.recoverable ? 'retry_search' : 'escalate');
      if (failure.recoverable) continue;
      throw new Error(failure.message);
    }

    providers = tool.providers;
    const verification = verifyProviderResults(providers);
    const observation = observationForProviders(providers, verification);
    state = applyHarnessState(state, {
      observations: [...state.harness.observations, observation],
      nextAction: verification.passed ? 'verify_results' : 'recover_search',
    });

    if (verification.passed) {
      // Return to the LLM with the fresh observation. The agent now decides
      // whether the verified evidence satisfies the task or whether another
      // materially different action is required.
      continue;
    }

    const failure: HarnessFailure = {
      type: 'verification_failed',
      message: verification.reason,
      iteration,
      recoverable: iteration < MAX_ITERATIONS,
    };
    state = recordFailure(state, failure, failure.recoverable ? 'recover_search' : 'escalate');
    if (!failure.recoverable) {
      state = applyHarnessState(state, { status: 'failed' });
      return { agent, state, providers };
    }
  }

  state = recordFailure(state, {
    type: 'max_iterations',
    message: 'Harness iteration budget exhausted',
    iteration: MAX_ITERATIONS,
    recoverable: false,
  }, 'escalate');
  state = applyHarnessState(state, { status: 'failed' });
  if (!lastAgent) throw new Error('AGENT_HARNESS_NO_RESULT');
  return { agent: lastAgent, state, providers };
}
