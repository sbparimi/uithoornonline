import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MapPin, Map as MapIcon, Plane, FileCheck, Euro, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "uithoorn.online — Schiphol-overlast claimen" },
      { name: "description", content: "Schiphol maakt jouw leven zuur. Wij helpen je terugvechten — log overlast en claim tot €2.200 per jaar." },
    ],
  }),
});

function Home() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-red px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-red-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          Actief — Norm overschreden 2023 · 2024 · 2025
        </div>
        <h1 className="mt-5 text-[28px] leading-[1.1] font-serif">
          Schiphol maakt jouw leven zuur.
          <span className="block text-red"> Wij helpen je terugvechten.</span>
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Check of jouw adres in de overschrijdingszone ligt, log de overlast en claim je compensatie.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Link
            to="/check"
            className="flex items-center justify-between rounded-xl bg-red px-4 py-3.5 text-red-foreground font-medium"
          >
            Check mijn adres
            <ChevronRight size={18} />
          </Link>
          <Link
            to="/map"
            className="flex items-center justify-between rounded-xl bg-white/10 border border-white/15 px-4 py-3.5 text-white font-medium"
          >
            Bekijk kaart
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="px-5 -mt-4">
        <div className="grid grid-cols-4 rounded-xl bg-white border border-border overflow-hidden">
          {[
            ["4.600+", "adressen"],
            ["3×", "jaar"],
            ["€2.200", "max"],
            ["Q4 '26", "deadline"],
          ].map(([v, l]) => (
            <div key={l} className="px-2 py-3 text-center border-r last:border-r-0 border-border">
              <div className="font-serif text-navy text-[15px] leading-tight">{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 mt-8">
        <h2 className="text-xl font-serif text-navy">Zo werkt het</h2>
        <p className="text-sm text-muted-foreground mt-1">In drie stappen jouw recht halen.</p>

        <div className="mt-5 space-y-3">
          {[
            { n: "1", Icon: MapPin, title: "Check je adres", desc: "Zie direct of je in de overschrijdingszone woont." },
            { n: "2", Icon: Plane, title: "Log de overlast", desc: "Eén tap meldt de vlucht, hoogte en het geluidsniveau." },
            { n: "3", Icon: Euro, title: "Claim je compensatie", desc: "Wij regelen de claim, jij ontvangt tot €2.200 per jaar." },
          ].map(({ n, Icon, title, desc }) => (
            <div key={n} className="rounded-xl bg-white border border-border p-4 flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-navy text-white grid place-items-center">
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-red">STAP {n}</span>
                </div>
                <h3 className="font-serif text-navy text-lg leading-tight">{title}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/check"
          className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-red px-4 py-3.5 text-red-foreground font-medium"
        >
          <FileCheck size={18} /> Start nu — gratis check
        </Link>

        <p className="text-[11px] text-muted-foreground text-center mt-3">
          Geen verplichtingen · Geen kosten vooraf · Privacy-vriendelijk
        </p>
      </section>

      <footer className="mt-10 px-5 py-6 text-center text-[11px] text-muted-foreground">
        uithoorn.online — Een burgerinitiatief voor de gemeente Uithoorn
      </footer>
    </AppShell>
  );
}
