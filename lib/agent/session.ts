import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentState } from './state';

let client: SupabaseClient | null = null;

function getClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_AGENT_NOT_CONFIGURED');

  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export async function loadAgentState(sessionKey: string): Promise<AgentState | null> {
  const { data, error } = await getClient().rpc('get_agent_session', { p_session_key: sessionKey });
  if (error) throw new Error(`AGENT_SESSION_LOAD_FAILED:${error.message}`);

  const row = Array.isArray(data) ? data[0] : null;
  return row?.context?.state ? (row.context.state as AgentState) : null;
}

export async function saveAgentState(sessionKey: string, state: AgentState): Promise<void> {
  const { error } = await getClient().rpc('upsert_agent_session', {
    p_session_key: sessionKey,
    p_locale: state.language,
    p_orchestrator: 'gpt-oss-120b',
    p_current_specialist: state.specialist,
    p_context: { state },
  });

  if (error) throw new Error(`AGENT_SESSION_SAVE_FAILED:${error.message}`);
}
