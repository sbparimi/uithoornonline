import type { AgentProvider } from '../../supabase/agent';

export type VerificationResult = { passed: boolean; reason: string; evidence: Array<{ source: string; detail: string }> };

export function verifyProviderResults(providers: AgentProvider[]): VerificationResult {
  if (!providers.length) return { passed: false, reason: 'no_results', evidence: [] };
  const usable = providers.filter((provider) => Boolean(provider.name && (provider.phone || provider.website || provider.address || provider.postcode)));
  const evidence = usable.slice(0, 5).map((provider) => ({ source: String(provider.rating_source || provider.agent_metadata?.discovery_source || 'provider-record'), detail: `${provider.name}${provider.postcode ? ` ${provider.postcode}` : ''}` }));
  return usable.length > 0 ? { passed: true, reason: 'provider_identity_and_contact_evidence_present', evidence } : { passed: false, reason: 'results_missing_identity_or_contact_evidence', evidence };
}
