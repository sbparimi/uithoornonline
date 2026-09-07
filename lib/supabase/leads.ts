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
  const { error } = await getLeadClient()
    .schema('agent_private')
    .from('agent_leads')
    .upsert({
      session_key: sessionKey,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      address: contact.address,
      consent_status: 'accepted',
      source: 'uithoorn_ai',
      first_intent: firstIntent,
      language,
    }, { onConflict: 'session_key' });

  if (error) throw new Error(`AGENT_LEAD_SAVE_FAILED:${error.message}`);
}
