import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pdokLookupAddress, pdokCheckNoiseZone } from "@/lib/official-sources.server";
import type { EvidenceItem } from "@/components/Evidence";

// ─────────────────────────────────────────────────────────────────────────────
// Anonymized aggregate of community noise_logs. RLS on the base table only
// grants each user their own rows, so we route through the admin client and
// project ONLY non-PII columns (no user_id). Points are jittered slightly to
// avoid pinpointing a house.
// ─────────────────────────────────────────────────────────────────────────────

const RecentInput = z.object({
  hours: z.number().int().min(1).max(24 * 30).default(24),
  limit: z.number().int().min(10).max(1000).default(500),
});

export type NoisePoint = {
  lat: number;
  lng: number;
  db_level: number;
  timestamp: string;
};

export type NoiseFeed = {
  ok: true;
  points: NoisePoint[];
  stats: {
    count: number;
    avg_db: number | null;
    peak_db: number | null;
    window_hours: number;
    generated_at: string;
  };
  evidence: EvidenceItem[];
};

export const getRecentNoiseLogs = createServerFn({ method: "POST" })
  .inputValidator((raw) => RecentInput.parse(raw))
  .handler(async ({ data }): Promise<NoiseFeed> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.hours * 3600 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("noise_logs")
      .select("lat,lng,db_level,timestamp")
      .gte("timestamp", since)
      .order("timestamp", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const points: NoisePoint[] = (rows ?? [])
      .filter((r) => r.lat != null && r.lng != null && r.db_level != null)
      .map((r) => ({
        lat: r.lat! + (Math.random() - 0.5) * 0.0006, // ~30m jitter
        lng: r.lng! + (Math.random() - 0.5) * 0.0006,
        db_level: r.db_level!,
        timestamp: r.timestamp as string,
      }));
    const dbs = points.map((p) => p.db_level);
    const now = new Date().toISOString();
    return {
      ok: true,
      points,
      stats: {
        count: points.length,
        avg_db: dbs.length ? Math.round(dbs.reduce((a, b) => a + b, 0) / dbs.length) : null,
        peak_db: dbs.length ? Math.max(...dbs) : null,
        window_hours: data.hours,
        generated_at: now,
      },
      evidence: [
        {
          finding: `${points.length} bewonersmeldingen in laatste ${data.hours}u`,
          source_name: "uithoorn.online meldingen",
          source_tier: 5,
          retrieved_at: now,
        },
      ],
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Real address + zone check. Replaces the hardcoded 1420-1424 range.
// ─────────────────────────────────────────────────────────────────────────────

const CheckInput = z.object({
  postcode: z.string().min(4).max(10),
  house_number: z.string().min(1).max(10),
});

export type AddressCheck =
  | {
      ok: true;
      address: {
        label: string;
        street: string;
        house: string;
        postcode: string;
        city: string;
        municipality: string;
        lon: number;
        lat: number;
        bag_id: string;
      };
      in_uithoorn: boolean;
      zones: string[]; // LIB zones matched
      in_lib_zone: boolean;
      /** "in_zone" | "outside" (service answered, no hit) | "unavailable" (no statement possible) */
      zone_status: "in_zone" | "outside" | "unavailable";
      note: string;
      evidence: EvidenceItem[];
    }
  | { ok: false; reason: string; message: string; evidence: EvidenceItem[] };

export const checkAddressLive = createServerFn({ method: "POST" })
  .inputValidator((raw) => CheckInput.parse(raw))
  .handler(async ({ data }): Promise<AddressCheck> => {
    const now = () => new Date().toISOString();
    const addr = await pdokLookupAddress(data.postcode, data.house_number);
    if (!addr.ok) {
      return {
        ok: false,
        reason: addr.reason,
        message: addr.message,
        evidence: [
          {
            finding: `BAG-lookup mislukt: ${addr.message}`,
            source_name: "PDOK Locatieserver (BAG)",
            source_url: "https://api.pdok.nl/bzk/locatieserver/search/v3_1",
            source_tier: 2,
            retrieved_at: now(),
          },
        ],
      };
    }
    const zoneRes = await pdokCheckNoiseZone(addr.lon, addr.lat);
    const evidence: EvidenceItem[] = [
      {
        finding: `Adres bevestigd via BAG: ${addr.label}`,
        source_name: "PDOK BAG (Kadaster)",
        source_url: addr.source_url,
        source_tier: 2,
        retrieved_at: addr.retrieved_at,
        dataset_version: `bag_id ${addr.bag_id}`,
      },
    ];
    let zones: string[] = [];
    let zone_status: "in_zone" | "outside" | "unavailable" = "unavailable";
    if (zoneRes.ok) {
      zone_status = "in_zone";
      zones = zoneRes.zones;
      evidence.push({
        finding: `LIB Schiphol beperkingengebied: ${zones.join(", ")}`,
        source_name: "Luchthavenindelingbesluit Schiphol",
        source_url: zoneRes.source_url,
        source_tier: 2,
        retrieved_at: zoneRes.retrieved_at,
      });
    } else if (zoneRes.reason === "no_intersection") {
      zone_status = "outside";
      evidence.push({
        finding: "Adres buiten alle gepubliceerde LIB-beperkingengebieden",
        source_name: "Luchthavenindelingbesluit Schiphol (PDOK WFS)",
        source_url: "https://www.pdok.nl/-/luchthavenindelingbesluit-schiphol",
        source_tier: 2,
        retrieved_at: now(),
      });
    } else {
      evidence.push({
        finding: `LIB-check niet beschikbaar: ${zoneRes.message}`,
        source_name: "PDOK LIB WFS",
        source_tier: 2,
        retrieved_at: now(),
      });
    }
    const in_uithoorn = /uithoorn/i.test(addr.municipality) || /uithoorn|de kwakel/i.test(addr.city);
    return {
      ok: true,
      address: {
        label: addr.label,
        street: addr.street,
        house: addr.house,
        postcode: addr.postcode,
        city: addr.city,
        municipality: addr.municipality,
        lon: addr.lon,
        lat: addr.lat,
        bag_id: addr.bag_id,
      },
      in_uithoorn,
      zones,
      in_lib_zone: zones.length > 0,
      note: zones.length
        ? "Dit adres ligt in een wettelijk LIB-beperkingengebied. Dat zegt iets over bouw- en gebruiksbeperkingen, niet automatisch over compensatierecht."
        : in_uithoorn
          ? "Adres ligt in gemeente Uithoorn maar buiten de gepubliceerde LIB-zones. Overlast kan bestaan; raadpleeg BAS/Schiphol voor actuele contouren."
          : "Adres ligt buiten gemeente Uithoorn.",
      evidence,
    };
  });
