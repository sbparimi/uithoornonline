import type { AgentProvider } from '../supabase/agent';

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: string;
};

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
}

export function googleDiscoveryConfigured() {
  return Boolean(apiKey());
}

export async function discoverGooglePlaces(query: string, municipality: string, limit = 5): Promise<AgentProvider[]> {
  const key = apiKey();
  if (!key || !query) return [];

  const response = await fetch(GOOGLE_PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.primaryTypeDisplayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: `${query} in ${municipality}, Netherlands`,
      languageCode: 'nl',
      regionCode: 'NL',
      pageSize: Math.min(Math.max(limit, 1), 10),
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`GOOGLE_PLACES_SEARCH_FAILED:${response.status}`);
  const payload = await response.json() as { places?: GooglePlace[] };

  return (payload.places || [])
    .filter((place) => place.id && place.displayName?.text && place.businessStatus !== 'CLOSED_PERMANENTLY')
    .map((place): AgentProvider => ({
      id: `google:${place.id}`,
      name: place.displayName?.text || 'Unknown business',
      category: place.primaryTypeDisplayName?.text || 'Local business',
      description: place.formattedAddress || '',
      postcode: null,
      website: place.websiteUri || null,
      phone: place.nationalPhoneNumber || null,
      service_areas: [],
      capabilities: {},
      availability: {},
      pricing: {},
      source_url: place.googleMapsUri || null,
      verified_at: null,
      agent_summary: place.formattedAddress || '',
      agent_metadata: {
        discovery_source: 'Google Places',
        place_id: place.id,
        google_maps_uri: place.googleMapsUri || null,
      },
      verified: false,
      rating_score: typeof place.rating === 'number' ? place.rating : null,
      rating_max: typeof place.rating === 'number' ? 5 : null,
      rating_review_count: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      rating_source: typeof place.rating === 'number' ? 'Google' : null,
      rating_retrieved_at: new Date().toISOString(),
    }));
}
