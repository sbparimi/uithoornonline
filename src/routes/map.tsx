import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Plane } from "lucide-react";
import { NoiseMap } from "@/components/NoiseMap";

export const Route = createFileRoute("/map")({
  component: MapPage,
  head: () => ({ meta: [{ title: "Geluidskaart — uithoorn.online" }] }),
});

const FILTERS = ["Vandaag", "Deze week", "2025", "2024", "2023"] as const;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function genPoints(filter: string) {
  const r = seededRandom(filter.length * 37 + filter.charCodeAt(0));
  const n = filter === "Vandaag" ? 14 : filter === "Deze week" ? 60 : 180;
  return Array.from({ length: n }, () => ({
    lat: 52.2333 + (r() - 0.5) * 0.05,
    lng: 4.8333 + (r() - 0.5) * 0.07,
    intensity: 60 + r() * 28,
  }));
}

function MapPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Vandaag");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const points = useMemo(() => genPoints(filter), [filter]);

  const stats = useMemo(() => {
    const avg = Math.round(points.reduce((s, p) => s + p.intensity, 0) / points.length);
    const peak = Math.max(...points.map((p) => p.intensity)).toFixed(0);
    return {
      count: points.length,
      avg,
      peak: `${peak} dB`,
      airline: ["KLM", "Transavia", "easyJet", "TUI"][filter.length % 4],
    };
  }, [points, filter]);

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-5">
        <h1 className="text-2xl font-serif">Geluidskaart</h1>
        <p className="mt-1 text-sm text-white/70">Live overlast rond Uithoorn</p>
      </section>

      <section className="px-5 -mt-3">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs border ${
                filter === f
                  ? "bg-red text-red-foreground border-red"
                  : "bg-white text-navy border-border"
              }`}
            >{f}</button>
          ))}
        </div>

        <div className="mt-3 aspect-[4/4] relative rounded-xl bg-white border border-border overflow-hidden">
          {mounted ? <NoiseMap points={points} /> : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">
              Kaart laden...
            </div>
          )}
        </div>
      </section>

      <section className="px-5 mt-4 grid grid-cols-2 gap-2">
        <Stat label="Meldingen vandaag" value={stats.count.toString()} />
        <Stat label="Gem. dB" value={`${stats.avg}`} />
        <Stat label="Piekmoment" value={stats.peak} />
        <Stat label="Meest gemeld" value={stats.airline} />
      </section>

      <section className="px-5 mt-5 mb-10">
        <Link to="/log" className="flex items-center justify-center gap-2 rounded-xl bg-red py-3.5 text-red-foreground font-medium">
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
