import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

function getAgentClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_AGENT_NOT_CONFIGURED');
  }

  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}

export type AgentProvider = {
  id: string;
  name: string;
  category: string;
  description: string;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  service_areas: string[];
  capabilities: Record<string, unknown>;
  availability: Record<string, unknown>;
  pricing: Record<string, unknown>;
  source_url: string | null;
  verified_at: string | null;
  agent_summary: string;
  agent_metadata: Record<string, unknown>;
};

export async function searchVerifiedProviders(query: string, postcode = '', limit = 5): Promise<AgentProvider[]> {
  const { data, error } = await getAgentClient().schema('agent_private').rpc('search_verified_providers', {
    p_query: query.slice(0, 500),
    p_postcode: postcode.slice(0, 20),
    p_limit: Math.min(Math.max(limit, 1), 20),
  });

  if (error) throw new Error(`AGENT_PROVIDER_SEARCH_FAILED:${error.message}`);
  return (data ?? []) as AgentProvider[];
}
