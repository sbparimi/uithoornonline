// Live authoritative data sources. No API keys: these are public Dutch
// government services. Every call is wrapped to return a typed
// { ok, ... } result so the chat agent can downgrade to SOURCE_UNAVAILABLE
// cleanly when an upstream is down.

const PDOK_LOC = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

// Schiphol Luchthavenindelingbesluit (LIB) — restriction zones / noise.
// Public PDOK WFS. Layer naming follows PDOK conventions; if the layer is
// renamed upstream the call surfaces a clear error which the agent reports
// as SOURCE_UNAVAILABLE. See https://www.pdok.nl/.
const LIB_WFS = "https://service.pdok.nl/ienw/luchtvaart/lib/wfs/v1_0";

export type AddressLookup =
  | {
      ok: true;
      bag_id: string;
      type: string;
      label: string;
      street: string;
      house: string;
      postcode: string;
      city: string;
      municipality: string;
      lon: number;
      lat: number;
      source_url: string;
      retrieved_at: string;
    }
  | { ok: false; reason: "not_found" | "unavailable"; message: string };

export async function pdokLookupAddress(
  postcode: string,
  houseNumber: string,
): Promise<AddressLookup> {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const hn = houseNumber.trim();
  if (!/^\d{4}[A-Z]{2}$|^\d{4}$/.test(pc) || !hn) {
    return { ok: false, reason: "not_found", message: "Postcode of huisnummer ongeldig." };
  }
  const q = encodeURIComponent(`${pc} ${hn}`);
  const url = `${PDOK_LOC}/free?q=${q}&fq=type:adres&rows=1`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { ok: false, reason: "unavailable", message: `PDOK ${res.status}` };
    }
    const json = (await res.json()) as {
      response?: {
        docs?: Array<{
          id: string;
          type: string;
          weergavenaam: string;
          straatnaam?: string;
          huis_nlt?: string;
          postcode?: string;
          woonplaatsnaam?: string;
          gemeentenaam?: string;
          centroide_ll?: string; // "POINT(lon lat)"
        }>;
      };
    };
    const doc = json.response?.docs?.[0];
    if (!doc) {
      return { ok: false, reason: "not_found", message: "Adres niet gevonden in BAG." };
    }
    // PDOK /free is a fuzzy search: it always returns a "best" match, also for
    // addresses that do not exist. Only accept an exact postcode + huisnummer
    // match, otherwise we would present someone else's address as fact.
    const docPc = (doc.postcode ?? "").replace(/\s+/g, "").toUpperCase();
    const docHn = (doc.huis_nlt ?? "").replace(/\s+/g, "").toUpperCase();
    const wantHn = hn.replace(/\s+/g, "").toUpperCase();
    const pcMatches = pc.length === 4 ? docPc.startsWith(pc) : docPc === pc;
    if (!pcMatches || docHn !== wantHn) {
      return {
        ok: false,
        reason: "not_found",
        message: "Dit exacte adres staat niet in de BAG (postcode/huisnummer komen niet overeen).",
      };
    }
    const m = doc.centroide_ll?.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (!m) return { ok: false, reason: "unavailable", message: "BAG centroide ontbreekt." };
    return {
      ok: true,
      bag_id: doc.id,
      type: doc.type,
      label: doc.weergavenaam,
      street: doc.straatnaam ?? "",
      house: doc.huis_nlt ?? hn,
      postcode: doc.postcode ?? pc,
      city: doc.woonplaatsnaam ?? "",
      municipality: doc.gemeentenaam ?? "",
      lon: parseFloat(m[1]),
      lat: parseFloat(m[2]),
      source_url: `https://bagviewer.kadaster.nl/lvbag/bag-viewer/index.html#?searchQuery=${pc}+${hn}`,
      retrieved_at: new Date().toISOString(),
    };
  } catch (e) {
    console.error("pdokLookupAddress failed", e);
    return { ok: false, reason: "unavailable", message: "PDOK Locatieserver niet bereikbaar." };
  }
}

export type NoiseZoneLookup =
  | {
      ok: true;
      zones: string[]; // e.g. ["LIB 4", "LIB 5"]
      raw_layers: string[];
      source_url: string;
      retrieved_at: string;
      note: string;
    }
  | { ok: false; reason: "no_intersection" | "unavailable"; message: string };

const LIB_LAYERS = [
  "lib:lib_beperkingengebied_bebouwing",
  "lib:lib_beperkingengebied_geluid_zone_1",
  "lib:lib_beperkingengebied_geluid_zone_2",
  "lib:lib_beperkingengebied_geluid_zone_3",
  "lib:lib_beperkingengebied_geluid_zone_4",
  "lib:lib_beperkingengebied_geluid_zone_5",
];

export async function pdokCheckNoiseZone(
  lon: number,
  lat: number,
): Promise<NoiseZoneLookup> {
  // Tiny bbox around the point in EPSG:4326 (~10 m).
  const d = 0.00009;
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d},EPSG:4326`;
  const found: string[] = [];
  const layersHit: string[] = [];
  // CRITICAL (accuracy): a failing layer request must NEVER be interpreted as
  // "not in a zone". If any layer cannot be queried we report unavailable, so
  // no user is ever told their address lies outside the LIB on the basis of a
  // broken upstream call.
  try {
    for (const layer of LIB_LAYERS) {
      const url = `${LIB_WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(
        layer,
      )}&bbox=${encodeURIComponent(bbox)}&count=1&outputFormat=application/json`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        return {
          ok: false,
          reason: "unavailable",
          message: `LIB-kaartlaag "${layer}" niet opvraagbaar (HTTP ${res.status}). Wij doen geen uitspraak over de zone.`,
        };
      }
      const json = (await res.json().catch(() => null)) as { features?: unknown[] } | null;
      if (!json || !Array.isArray(json.features)) {
        return {
          ok: false,
          reason: "unavailable",
          message: "LIB-service gaf een onbruikbaar antwoord. Wij doen geen uitspraak over de zone.",
        };
      }
      if (json.features.length > 0) {
        layersHit.push(layer);
        const m = layer.match(/zone_(\d)/);
        if (m) found.push(`LIB geluid zone ${m[1]}`);
        else if (layer.includes("bebouwing")) found.push("LIB bebouwingsbeperking");
      }
    }
  } catch (e) {
    console.error("pdokCheckNoiseZone failed", e);
    return { ok: false, reason: "unavailable", message: "PDOK LIB WFS niet bereikbaar." };
  }
  if (found.length === 0) {
    return {
      ok: false,
      reason: "no_intersection",
      message:
        "Alle LIB-kaartlagen zijn geraadpleegd en gaven geen resultaat op dit punt: het adres ligt buiten de gepubliceerde LIB-beperkingengebieden.",
    };
  }
  return {
    ok: true,
    zones: found,
    raw_layers: layersHit,
    source_url: "https://www.pdok.nl/-/luchthavenindelingbesluit-schiphol",
    retrieved_at: new Date().toISOString(),
    note: "Bron: Luchthavenindelingbesluit Schiphol (PDOK WFS). Dit zegt iets over wettelijke beperkingengebieden, niet automatisch over compensatierecht.",
  };
}
