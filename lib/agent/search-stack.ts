import type { AgentState } from './state';
import type { AgentProvider } from '../supabase/agent';
import { discoverGooglePlaces } from './discovery';
import { discoverOpenStreetMap, discoverOverpass, searchProvidersPrimaryFallback } from './provider-search';

function mergeProviders(local: AgentProvider[], discovered: AgentProvider[]): AgentProvider[] {
  const result = [...local];
  const seen = new Set(local.map((provider) => provider.name.toLowerCase().trim()));
  for (const provider of discovered) {
    const key = provider.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    result.push(provider);
    seen.add(key);
    if (result.length >= 5) break;
  }
  return result;
}

export async function searchProvidersWithFallback(state: AgentState, query: string): Promise<AgentProvider[]> {
  let local: AgentProvider[] = [];
  try {
    local = await searchProvidersPrimaryFallback(query, state.location.municipality, state.location.postcode, 5);
  } catch (error) {
    console.warn('PRIMARY_PROVIDER_SEARCH_FAILED', error instanceof Error ? error.message : 'unknown_error');
  }
  if (local.length >= 5) return local;

  try {
    const osm = await discoverOpenStreetMap(query, state.location.municipality, 5 - local.length);
    local = mergeProviders(local, osm);
  } catch (error) {
    console.warn('OSM_DISCOVERY_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
  }

  if (local.length < 5) {
    try {
      const overpass = await discoverOverpass(query, state.location.municipality, 5 - local.length);
      local = mergeProviders(local, overpass);
    } catch (error) {
      console.warn('OVERPASS_DISCOVERY_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
    }
  }

  if (local.length < 5) {
    try {
      const google = await discoverGooglePlaces(query, state.location.municipality, 5 - local.length);
      local = mergeProviders(local, google);
    } catch (error) {
      console.warn('GOOGLE_DISCOVERY_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
    }
  }

  return local.slice(0, 5);
}
