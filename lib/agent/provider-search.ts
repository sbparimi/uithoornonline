import type { AgentProvider } from '../supabase/agent';
import { searchVerifiedProviders } from '../supabase/agent';

const TYPESENSE_URL = process.env.TYPESENSE_URL || '';
const TYPESENSE_KEY = process.env.TYPESENSE_API_KEY || '';
const TYPESENSE_COLLECTION = process.env.TYPESENSE_COLLECTION || 'providers';
const NOMINATIM_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const OVERPASS_URL = process.env.OVERPASS_URL || '';

let lastNominatimRequestAt = 0;

function typesenseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(TYPESENSE_KEY ? { 'X-TYPESENSE-API-KEY': TYPESENSE_KEY } : {}),
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

export function typesenseConfigured(): boolean {
  return Boolean(TYPESENSE_URL && TYPESENSE_KEY);
}

function typesenseCollectionUrl(): string {
  return `${TYPESENSE_URL.replace(/\/$/, '')}/collections/${encodeURIComponent(TYPESENSE_COLLECTION)}`;
}

async function ensureTypesenseCollection(): Promise<void> {
  if (!typesenseConfigured()) return;
  const response = await fetch(typesenseCollectionUrl(), {
    headers: typesenseHeaders(),
    cache: 'no-store',
  });
  if (response.ok) return;
  if (response.status !== 404) throw new Error(`TYPESENSE_COLLECTION_CHECK_FAILED:${response.status}`);

  const schema = {
    name: TYPESENSE_COLLECTION,
    fields: [
      { name: 'name', type: 'string' },
      { name: 'category', type: 'string', optional: true },
      { name: 'description', type: 'string', optional: true },
      { name: 'postcode', type: 'string', optional: true },
      { name: 'website', type: 'string', optional: true },
      { name: 'phone', type: 'string', optional: true },
      { name: 'service_areas', type: 'string[]', optional: true },
      { name: 'source_url', type: 'string', optional: true },
      { name: 'verified_at', type: 'string', optional: true },
      { name: 'agent_summary', type: 'string', optional: true },
      { name: 'verified', type: 'bool', facet: true },
      { name: 'rating_score', type: 'float', optional: true, sort: true },
      { name: 'rating_max', type: 'float', optional: true },
      { name: 'rating_review_count', type: 'int32', optional: true, sort: true },
      { name: 'rating_source', type: 'string', optional: true },
      { name: 'rating_retrieved_at', type: 'string', optional: true },
      { name: 'capabilities_json', type: 'string', optional: true },
      { name: 'availability_json', type: 'string', optional: true },
      { name: 'pricing_json', type: 'string', optional: true },
      { name: 'agent_metadata_json', type: 'string', optional: true },
    ],
  };

  const createResponse = await fetch(`${TYPESENSE_URL.replace(/\/$/, '')}/collections`, {
    method: 'POST',
    headers: typesenseHeaders(),
    body: JSON.stringify(schema),
    cache: 'no-store',
  });
  if (!createResponse.ok && createResponse.status !== 409) {
    throw new Error(`TYPESENSE_COLLECTION_CREATE_FAILED:${createResponse.status}`);
  }
}

function toTypesenseDocument(provider: AgentProvider): Record<string, unknown> {
  return {
    ...provider,
    capabilities_json: JSON.stringify(provider.capabilities || {}),
    availability_json: JSON.stringify(provider.availability || {}),
    pricing_json: JSON.stringify(provider.pricing || {}),
    agent_metadata_json: JSON.stringify(provider.agent_metadata || {}),
  };
}

export async function searchTypesenseProviders(query: string, municipality: string, postcode: string | null, limit = 5): Promise<AgentProvider[]> {
  if (!typesenseConfigured() || !query.trim()) return [];
  await ensureTypesenseCollection();
  const locationTerms = [municipality, postcode || ''].filter(Boolean).join(' ');
  const url = new URL(`${typesenseCollectionUrl()}/documents/search`);
  url.searchParams.set('q', `${query.trim()} ${locationTerms}`.trim());
  url.searchParams.set('query_by', 'name,category,description,postcode,service_areas,agent_summary');
  url.searchParams.set('query_by_weights', '8,5,3,4,2,3');
  url.searchParams.set('filter_by', 'verified:=true');
  url.searchParams.set('per_page', String(Math.min(Math.max(limit, 1), 20)));
  url.searchParams.set('prioritize_exact_match', 'true');

  const response = await fetch(url, {
    headers: typesenseHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`TYPESENSE_PROVIDER_SEARCH_FAILED:${response.status}`);
  const payload = await response.json() as { hits?: Array<{ document?: unknown }> };
  return (payload.hits || [])
    .map((hit) => asProvider(hit.document))
    .filter((item): item is AgentProvider => Boolean(item && item.verified))
    .slice(0, limit);
}

async function indexTypesenseProviders(providers: AgentProvider[]): Promise<void> {
  if (!typesenseConfigured() || providers.length === 0) return;
  try {
    await ensureTypesenseCollection();
    await fetch(`${typesenseCollectionUrl()}/documents/import?action=upsert`, {
      method: 'POST',
      headers: typesenseHeaders(),
      body: providers.map((provider) => JSON.stringify(toTypesenseDocument(provider))).join('\n'),
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('TYPESENSE_PROVIDER_INDEX_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
  }
}

async function rateLimitNominatim(): Promise<void> {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1000) await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
  lastNominatimRequestAt = Date.now();
}

async function normalizePostcodeWithOsm(postcode: string | null, municipality: string): Promise<string> {
  if (!postcode) return '';
  try {
    await rateLimitNominatim();
    const url = new URL('/search', NOMINATIM_URL);
    url.searchParams.set('q', `${postcode}, ${municipality}, Netherlands`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    const response = await fetch(url, { headers: { 'User-Agent': 'UithoornOnline/1.0 (https://uithoorn.online)' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`NOMINATIM_LOCATION_FAILED:${response.status}`);
    const payload = await response.json() as Array<{ address?: { postcode?: string; town?: string; village?: string; city?: string } }>;
    const normalized = payload[0]?.address?.postcode?.replace(/\s+/g, '').toUpperCase();
    return normalized || postcode.replace(/\s+/g, '').toUpperCase();
  } catch (error) {
    console.warn('OSM_LOCATION_NORMALIZATION_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
    return postcode.replace(/\s+/g, '').toUpperCase();
  }
}

export async function searchProvidersPrimaryFallback(query: string, municipality: string, postcode: string | null, limit = 5): Promise<AgentProvider[]> {
  const normalizedPostcode = await normalizePostcodeWithOsm(postcode, municipality);
  if (typesenseConfigured()) {
    try {
      const primary = await searchTypesenseProviders(query, municipality, normalizedPostcode || null, limit);
      if (primary.length > 0) return primary;
    } catch (error) {
      console.warn('TYPESENSE_PROVIDER_FALLBACK', error instanceof Error ? error.message : 'unknown_error');
    }
  }

  const fallback = await searchVerifiedProviders(query, normalizedPostcode, limit);
  void indexTypesenseProviders(fallback);
  return fallback;
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
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const overpassQuery = `[out:json][timeout:10];area["name"="${municipality}"]["boundary"="administrative"]->.searchArea;(nwr["name"~"${escaped}",i](area.searchArea););out center tags;`;
  const response = await fetch(OVERPASS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: overpassQuery, cache: 'no-store' });
  if (!response.ok) throw new Error(`OVERPASS_DISCOVERY_FAILED:${response.status}`);
  const payload = await response.json() as { elements?: Array<Record<string, unknown>> };
  return (payload.elements || []).map((item) => {
    const tags = item.tags && typeof item.tags === 'object' ? item.tags as Record<string, unknown> : {};
    return osmProvider({ ...item, name: tags.name, type: tags.amenity || tags.shop || tags.craft || 'place', extratags: tags });
  }).filter((item): item is AgentProvider => Boolean(item)).slice(0, limit);
}
