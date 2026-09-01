import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, FileText, Map, Plane, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/flight-noise")({
  component: FlightNoisePage,
  head: () => ({
    meta: [
      { title: "Vliegtuig & geluid — uithoorn.online" },
      { name: "description", content: "Eén plek voor vliegtuiggeluid melden, geluidsinformatie bekijken en je eigen dossier beheren." },
    ],
  }),
});

const tools = [
  { to: "/log", title: "Geluid melden", text: "Leg je eigen waarneming vast met tijdstip, geschat geluidsniveau en optionele vluchtinformatie.", icon: Volume2 },
  { to: "/map", title: "Geluidskaart", text: "Bekijk de beschikbare geluidsinformatie en kaartweergave.", icon: Map },
  { to: "/claim", title: "Dossier voorbereiden", text: "Orden je informatie en bereid je vervolgstappen voor.", icon: FileText },
] as const;

function FlightNoisePage() {
  return (
    <AppShell>
      <section className="bg-navy px-5 pb-9 pt-8 text-navy-foreground sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
            <Plane size={14} /> Vliegtuig &amp; geluid
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl">Alles over vliegtuiggeluid op één plek</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            Meld wat je ervaart, bekijk de beschikbare geluidsinformatie en houd je eigen informatie bij. Uithoorn Online is geen overheidsinstantie en bepaalt geen officiële metingen, oorzaak of recht op compensatie.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-3">
          {tools.map(({ to, title, text, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-cream text-navy"><Icon size={20} /></div>
              <h2 className="mt-4 text-xl font-serif text-navy">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-navy">Openen <ChevronRight size={15} className="transition group-hover:translate-x-0.5" /></div>
            </Link>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-navy/10 bg-cream p-5 text-sm leading-6 text-navy/70">
          <strong className="text-navy">Belangrijk:</strong> een bewonersmelding is jouw eigen waarneming. Een opgegeven vluchtnummer bewijst niet dat die vlucht de hinder heeft veroorzaakt. Officiële gegevens en besluiten blijven bij de bevoegde instanties.
        </div>
      </section>
    </AppShell>
  );
}
