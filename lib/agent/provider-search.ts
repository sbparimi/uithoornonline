import type { AgentProvider } from '../supabase/agent';
import { searchVerifiedProviders } from '../supabase/agent';

const MEILI_URL = process.env.MEILISEARCH_URL || '';
const MEILI_KEY = process.env.MEILISEARCH_API_KEY || '';
const MEILI_INDEX = process.env.MEILISEARCH_INDEX || 'providers';
const NOMINATIM_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = process.env.OVERPASS_URL || '';

let lastNominatimRequestAt = 0;

function meiliHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(MEILI_KEY ? { Authorization: `Bearer ${MEILI_KEY}` } : {}),
  };
}

function asProvider(value: unknown): AgentProvider | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const id = String(item.id ?? '').trim();
  const name = String(item.name ?? '').trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    category: String(item.category ?? 'Local business'),
    description: String(item.description ?? ''),
    postcode: typeof item.postcode === 'string' ? item.postcode : null,
    website: typeof item.website === 'string' ? item.website : null,
    phone: typeof item.phone === 'string' ? item.phone : null,
    service_areas: Array.isArray(item.service_areas) ? item.service_areas.filter((x): x is string => typeof x === 'string') : [],
    capabilities: item.capabilities && typeof item.capabilities === 'object' ? item.capabilities as Record<string, unknown> : {},
    availability: item.availability && typeof item.availability === 'object' ? item.availability as Record<string, unknown> : {},
    pricing: item.pricing && typeof item.pricing === 'object' ? item.pricing as Record<string, unknown> : {},
    source_url: typeof item.source_url === 'string' ? item.source_url : null,
    verified_at: typeof item.verified_at === 'string' ? item.verified_at : null,
    agent_summary: String(item.agent_summary ?? item.description ?? ''),
    agent_metadata: item.agent_metadata && typeof item.agent_metadata === 'object' ? item.agent_metadata as Record<string, unknown> : {},
    verified: item.verified === true,
    rating_score: typeof item.rating_score === 'number' ? item.rating_score : null,
    rating_max: typeof item.rating_max === 'number' ? item.rating_max : null,
    rating_review_count: typeof item.rating_review_count === 'number' ? item.rating_review_count : null,
    rating_source: typeof item.rating_source === 'string' ? item.rating_source : null,
    rating_retrieved_at: typeof item.rating_retrieved_at === 'string' ? item.rating_retrieved_at : null,
  };
}

export function meilisearchConfigured(): boolean {
  return Boolean(MEILI_URL && MEILI_KEY);
}

export async function searchMeilisearchProviders(query: string, municipality: string, limit = 5): Promise<AgentProvider[]> {
  if (!meilisearchConfigured() || !query.trim()) return [];
  const response = await fetch(`${MEILI_URL.replace(/\/$/, '')}/indexes/${encodeURIComponent(MEILI_INDEX)}/search`, {
    method: 'POST',
    headers: meiliHeaders(),
    body: JSON.stringify({ q: `${query.trim()} ${municipality}`.trim(), limit: Math.min(Math.max(limit, 1), 20) }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`MEILISEARCH_PROVIDER_SEARCH_FAILED:${response.status}`);
  const payload = await response.json() as { hits?: unknown[] };
  return (payload.hits || []).map(asProvider).filter((item): item is AgentProvider => Boolean(item && item.verified)).slice(0, limit);
}

async function indexMeilisearchProviders(providers: AgentProvider[]): Promise<void> {
  if (!meilisearchConfigured() || providers.length === 0) return;
  try {
    await fetch(`${MEILI_URL.replace(/\/$/, '')}/indexes/${encodeURIComponent(MEILI_INDEX)}/documents?primaryKey=id`, {
      method: 'POST',
      headers: meiliHeaders(),
      body: JSON.stringify(providers),
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('MEILISEARCH_PROVIDER_INDEX_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
  }
}

export async function searchProvidersPrimaryFallback(query: string, municipality: string, postcode: string | null, limit = 5): Promise<AgentProvider[]> {
  if (meilisearchConfigured()) {
    try {
      const primary = await searchMeilisearchProviders(query, municipality, limit);
      if (primary.length > 0) return primary;
    } catch (error) {
      console.warn('MEILISEARCH_PROVIDER_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
    }
  }

  const fallback = await searchVerifiedProviders(query, postcode || '', limit);
  void indexMeilisearchProviders(fallback);
  return fallback;
}

async function rateLimitNominatim(): Promise<void> {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1000) await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  lastNominatimRequestAt = Date.now();
}

function osmProvider(result: Record<string, unknown>): AgentProvider | null {
  const name = typeof result.name === 'string' ? result.name.trim() : '';
  const displayName = typeof result.display_name === 'string' ? result.display_name : '';
  const extratags = result.extratags && typeof result.extratags === 'object' ? result.extratags as Record<string, unknown> : {};
  const address = result.address && typeof result.address === 'object' ? result.address as Record<string, unknown> : {};
  if (!name) return null;
  const category = String(extratags.amenity || extratags.shop || extratags.craft || result.type || 'Local business');
  const postcode = typeof address.postcode === 'string' ? address.postcode : null;
  const website = typeof extratags.website === 'string' ? extratags.website : typeof extratags['contact:website'] === 'string' ? extratags['contact:website'] : null;
  const phone = typeof extratags.phone === 'string' ? extratags.phone : typeof extratags['contact:phone'] === 'string' ? extratags['contact:phone'] : null;
  return {
    id: `osm:${String(result.osm_type || 'place')}:${String(result.osm_id || name)}`,
    name,
    category,
    description: displayName,
    postcode,
    website,
    phone,
    service_areas: [],
    capabilities: {},
    availability: {},
    pricing: {},
    source_url: typeof result.osm_id === 'string' || typeof result.osm_id === 'number' ? `https://www.openstreetmap.org/${String(result.osm_type || 'node')}/${String(result.osm_id)}` : null,
    verified_at: null,
    agent_summary: displayName,
    agent_metadata: { discovery_source: 'OpenStreetMap', osm_type: result.osm_type || null, osm_id: result.osm_id || null, lat: result.lat || null, lon: result.lon || null },
    verified: false,
    rating_score: null,
    rating_max: null,
    rating_review_count: null,
    rating_source: null,
    rating_retrieved_at: null,
  };
}

export async function discoverOpenStreetMap(query: string, municipality: string, limit = 5): Promise<AgentProvider[]> {
  if (!query.trim()) return [];
  await rateLimitNominatim();
  const url = new URL('/search', NOMINATIM_URL);
  url.searchParams.set('q', `${query.trim()}, ${municipality}, Netherlands`);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 10)));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('namedetails', '1');
  const response = await fetch(url, {
    headers: { 'User-Agent': 'UithoornOnline/1.0 (https://uithoorn.online)' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`NOMINATIM_DISCOVERY_FAILED:${response.status}`);
  const payload = await response.json() as unknown[];
  return payload.map((item) => osmProvider(item as Record<string, unknown>)).filter((item): item is AgentProvider => Boolean(item)).slice(0, limit);
}

export async function discoverOverpass(query: string, municipality: string, limit = 5): Promise<AgentProvider[]> {
  if (!OVERPASS_URL || !query.trim()) return [];
  const overpassQuery = `[out:json][timeout:10];area["name"="${municipality}"]["boundary"="administrative"]->.searchArea;(nwr["name"~"${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}",i](area.searchArea););out center tags ${Math.min(Math.max(limit, 1), 10)};`;
  const response = await fetch(OVERPASS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: overpassQuery, cache: 'no-store' });
  if (!response.ok) throw new Error(`OVERPASS_DISCOVERY_FAILED:${response.status}`);
  const payload = await response.json() as { elements?: Array<Record<string, unknown>> };
  return (payload.elements || []).map((item) => {
    const tags = item.tags && typeof item.tags === 'object' ? item.tags as Record<string, unknown> : {};
    return osmProvider({ ...item, name: tags.name, type: tags.amenity || tags.shop || tags.craft || 'place', extratags: tags });
  }).filter((item): item is AgentProvider => Boolean(item)).slice(0, limit);
}
