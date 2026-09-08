import type { AgentProvider } from '../../supabase/agent';
import type { AgentState } from '../state';
import type { UnifiedAgentResult } from '../agent-runtime';
import { applyOrchestratorDecision, applySpecialistResult } from '../state';
import { buildTaskContract } from './task-contract';
import { executeTool, hasSuccessfulAction, normalizeActionKey, type ToolRequest, type ToolExecutor } from './tool-gateway';
import { verifyProviderResults } from './verification';

export type HarnessObservation = { id: string; capability: string; status: 'success' | 'failed'; summary: string; evidence: Array<{ source: string; detail: string }>; retryable: boolean };
export type HarnessFailure = { type: 'model_output_invalid' | 'tool_failed' | 'verification_failed' | 'policy_denied' | 'missing_context' | 'max_iterations'; message: string; iteration: number; recoverable: boolean };
export type HarnessResult = { agent: UnifiedAgentResult; state: AgentState; providers: AgentProvider[] };

const MAX_ITERATIONS = 3;
function applyHarnessState(state: AgentState, patch: Partial<AgentState['harness']>): AgentState { return { ...state, harness: { ...state.harness, ...patch } }; }
function recordFailure(state: AgentState, failure: HarnessFailure, nextAction: string): AgentState { return applyHarnessState(state, { failures: [...state.harness.failures, failure], nextAction }); }
function observationForProviders(capability: string, actionKey: string, providers: AgentProvider[], verified: ReturnType<typeof verifyProviderResults>): HarnessObservation { return { id: crypto.randomUUID(), capability, status: verified.passed ? 'success' : 'failed', summary: `ACTION_KEY=${actionKey}; ${verified.reason}`, evidence: verified.evidence, retryable: !verified.passed }; }
function applyAgentToState(state: AgentState, agent: UnifiedAgentResult): AgentState { let next=applyOrchestratorDecision(agent.decision,state); next=applySpecialistResult(next,agent.specialist); return next; }

export async function runHarness(message:string,history:Array<{role:'user'|'assistant';content:string}>,initialState:AgentState,runAgent:(message:string,history:Array<{role:'user'|'assistant';content:string}>,state:AgentState)=>Promise<UnifiedAgentResult>,toolExecutor:ToolExecutor):Promise<HarnessResult>{
  let state=applyHarnessState(initialState,{runId:initialState.harness?.runId||crypto.randomUUID(),iteration:0,status:'running',observations:[],failures:[],decisions:[],nextAction:'reason'});
  let lastAgent:UnifiedAgentResult|null=null; let providers:AgentProvider[]=[];
  for(let iteration=1;iteration<=MAX_ITERATIONS;iteration+=1){
    state=applyHarnessState(state,{iteration,nextAction:'reason',contract:buildTaskContract(state,message)});
    let agent:UnifiedAgentResult;
    try{agent=await runAgent(message,history,state);}catch(error){const failure:HarnessFailure={type:'model_output_invalid',message:error instanceof Error?error.message:'unknown_model_error',iteration,recoverable:iteration<MAX_ITERATIONS};state=recordFailure(state,failure,failure.recoverable?'repair_reasoning':'escalate');if(failure.recoverable)continue;throw error;}
    lastAgent=agent;
    state=applyAgentToState(state,agent);
    state=applyHarnessState(state,{contract:buildTaskContract(state,message),decisions:[...state.harness.decisions,{iteration,nextAction:agent.action.kind,goal:agent.decision.plan.goal,rationale:agent.action.rationale}],nextAction:agent.action.kind});

    if(agent.action.kind==='respond'||agent.action.kind==='clarify'||agent.action.kind==='complete'){
      return {agent,state:applyHarnessState(state,{status:'completed',nextAction:agent.action.kind}),providers};
    }

    if(agent.action.kind!=='tool'||!agent.action.capability){
      state=recordFailure(state,{type:'model_output_invalid',message:'Tool action did not include an executable capability',iteration,recoverable:false},'escalate');
      return {agent,state:applyHarnessState(state,{status:'failed'}),providers};
    }

    const query=agent.action.arguments.query?.trim();
    if(!query){
      state=recordFailure(state,{type:'missing_context',message:`Agent selected ${agent.action.capability} without an executable query`,iteration,recoverable:false},'respond');
      return {agent,state:applyHarnessState(state,{status:'completed'}),providers};
    }

    const request:ToolRequest={capability:agent.action.capability,query};
    const actionKey=normalizeActionKey(request);
    if(hasSuccessfulAction(state,request)){
      state=applyHarnessState(state,{observations:[...state.harness.observations,{id:crypto.randomUUID(),capability:request.capability,status:'success',summary:`ACTION_KEY=${actionKey}; Duplicate action suppressed; prior observation remains authoritative.`,evidence:[],retryable:false}],nextAction:'use_existing_observation'});
      return {agent,state:applyHarnessState(state,{status:'completed',nextAction:'respond'}),providers};
    }

    state=applyHarnessState(state,{nextAction:`execute:${request.capability}`});
    const tool=await executeTool(state,request,toolExecutor);
    if(tool.status==='failed'){
      const type:HarnessFailure['type']=tool.error==='capability_not_allowed_by_task_contract'||tool.error==='capability_not_registered'?'policy_denied':'tool_failed';
      const failure:HarnessFailure={type,message:tool.error||'tool_execution_failed',iteration,recoverable:tool.retryable&&iteration<MAX_ITERATIONS};
      state=applyHarnessState(state,{observations:[...state.harness.observations,{id:crypto.randomUUID(),capability:tool.capability,status:'failed',summary:`ACTION_KEY=${actionKey}; ${failure.message}`,evidence:[],retryable:tool.retryable}]});
      state=recordFailure(state,failure,failure.recoverable?'repair_action':'escalate');
      if(failure.recoverable)continue;throw new Error(failure.message);
    }

    providers=tool.providers;
    const verification=verifyProviderResults(providers);
    state=applyHarnessState(state,{observations:[...state.harness.observations,observationForProviders(tool.capability,actionKey,providers,verification)],nextAction:verification.passed?'verify_results':'recover_search'});
    if(verification.passed)continue;
    const failure:HarnessFailure={type:'verification_failed',message:verification.reason,iteration,recoverable:iteration<MAX_ITERATIONS};
    state=recordFailure(state,failure,failure.recoverable?'recover_search':'escalate');
    if(!failure.recoverable)return {agent,state:applyHarnessState(state,{status:'failed'}),providers};
  }
  state=recordFailure(state,{type:'max_iterations',message:'Harness iteration budget exhausted',iteration:MAX_ITERATIONS,recoverable:false},'escalate');
  state=applyHarnessState(state,{status:'failed'});
  if(!lastAgent)throw new Error('AGENT_HARNESS_NO_RESULT');
  return {agent:lastAgent,state,providers};
}
