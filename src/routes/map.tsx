import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Plane, RefreshCw } from "lucide-react";
import { NoiseMap } from "@/components/NoiseMap";
import { EvidenceList } from "@/components/Evidence";
import { getRecentNoiseLogs, type NoiseFeed } from "@/lib/live-data.functions";

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({ meta: [{ title: "Geluidskaart — uithoorn.online" }] }),
});

const WINDOWS = [
  { label: "Laatste 24u", hours: 24 },
  { label: "Deze week", hours: 24 * 7 },
  { label: "Deze maand", hours: 24 * 30 },
] as const;

function MapPage() {
  const [hours, setHours] = useState<number>(24);
  const [feed, setFeed] = useState<NoiseFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const fetchFeed = useServerFn(getRecentNoiseLogs);

  useEffect(() => setMounted(true), []);

  const load = useMemo(
    () => async (h: number) => {
      setLoading(true);
      try {
        const res = await fetchFeed({ data: { hours: h, limit: 500 } });
        setFeed(res);
      } finally {
        setLoading(false);
      }
    },
    [fetchFeed],
  );

  useEffect(() => {
    load(hours);
  }, [hours, load]);

  const points = useMemo(
    () =>
      (feed?.points ?? []).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        intensity: p.db_level,
      })),
    [feed],
  );

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-5">
        <h1 className="text-2xl font-serif">Geluidskaart</h1>
        <p className="mt-1 text-sm text-white/70">
          Live bewonersmeldingen rond Uithoorn — geen fictieve data.
        </p>
      </section>

      <section className="px-5 -mt-3">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {WINDOWS.map((w) => (
            <button
              key={w.hours}
              onClick={() => setHours(w.hours)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs border ${
                hours === w.hours
                  ? "bg-red text-red-foreground border-red"
                  : "bg-white text-navy border-border"
              }`}
            >
              {w.label}
            </button>
          ))}
          <button
            onClick={() => load(hours)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs border border-border bg-white text-navy inline-flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Vernieuwen
          </button>
        </div>

        <div className="mt-3 aspect-square relative rounded-xl bg-white border border-border overflow-hidden">
          {mounted && points.length > 0 ? (
            <NoiseMap points={points} />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-center px-6">
              <div>
                <div className="text-sm text-muted-foreground">
                  {loading
                    ? "Meldingen ophalen…"
                    : "Nog geen meldingen in dit venster."}
                </div>
                {!loading && (
                  <Link
                    to="/log"
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-red px-3 py-1.5 text-xs text-red-foreground"
                  >
                    <Plane size={12} /> Wees de eerste — meld nu
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {feed && (
          <div className="mt-3">
            <EvidenceList items={feed.evidence} />
          </div>
        )}
      </section>

      <section className="px-5 mt-4 grid grid-cols-2 gap-2">
        <Stat label={`Meldingen (${WINDOWS.find((w) => w.hours === hours)?.label ?? ""})`} value={String(feed?.stats.count ?? "—")} />
        <Stat label="Gem. dB" value={feed?.stats.avg_db != null ? String(feed.stats.avg_db) : "—"} />
        <Stat label="Piek dB" value={feed?.stats.peak_db != null ? String(feed.stats.peak_db) : "—"} />
        <Stat
          label="Laatst ververst"
          value={feed ? new Date(feed.stats.generated_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "—"}
        />
      </section>

      <p className="px-5 mt-3 text-[11px] text-muted-foreground">
        Bron: bewonersmeldingen via deze app (tier 5). Officiële vluchtdata van
        Schiphol/LVNL vereist een API-sleutel; die integratie staat klaar zodra
        de sleutel is toegevoegd. Tot dan tonen we uitsluitend echte community-data,
        geen fictie.
      </p>

      <section className="px-5 mt-5 mb-10">
        <Link
          to="/log"
          className="flex items-center justify-center gap-2 rounded-xl bg-red py-3.5 text-red-foreground font-medium"
        >
          <Plane size={18} /> Meld nu geluidshinder
        </Link>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-navy text-xl leading-tight">{value}</div>
    </div>
  );
}
