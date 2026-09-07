import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentContact, AgentLanguage, SemanticIntent } from '../agent/state';

let client: SupabaseClient | null = null;

function getLeadClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_AGENT_NOT_CONFIGURED');

  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export async function upsertAgentLead(
  sessionKey: string,
  contact: AgentContact,
  language: AgentLanguage,
  firstIntent: SemanticIntent,
): Promise<void> {
  const { error } = await getLeadClient().rpc('upsert_agent_lead', {
    p_session_key: sessionKey,
    p_name: contact.name,
    p_email: contact.email,
    p_phone: contact.phone,
    p_address: contact.address,
    p_language: language,
    p_first_intent: firstIntent,
  });

  if (error) throw new Error(`AGENT_LEAD_SAVE_FAILED:${error.message}`);
}
