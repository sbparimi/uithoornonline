import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Map, Plane, ShieldCheck, Volume2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/flight-noise")({
  component: FlightNoisePage,
  head: () => ({
    meta: [
      { title: "Vliegtuig & geluid — uithoorn.online" },
      { name: "description", content: "Eén plek voor vliegtuiggeluid melden, geluidsinformatie bekijken en je eigen dossier voorbereiden." },
    ],
  }),
});

const tools = [
  { to: "/log", title: "Geluid melden", text: "Leg je eigen waarneming vast met tijdstip, duur, geschat niveau en optionele vluchtinformatie.", icon: Volume2, label: "Waarneming vastleggen" },
  { to: "/map", title: "Geluidskaart", text: "Bekijk beschikbare kaart- en geluidsinformatie zonder dat een bewonersinschatting als officiële meting wordt behandeld.", icon: Map, label: "Kaart openen" },
  { to: "/claim", title: "Dossier voorbereiden", text: "Breng je eigen informatie overzichtelijk bij elkaar voor eventuele vervolgstappen bij een bevoegde instantie.", icon: FileText, label: "Dossier openen" },
] as const;

function FlightNoisePage() {
  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-105px)] bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,.92),transparent_32%),radial-gradient(circle_at_90%_18%,rgba(207,226,245,.65),transparent_30%),#f6f1e8]">
        <section className="relative overflow-hidden bg-navy text-white">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
          <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70"><Plane size={14} /> Vliegtuig &amp; geluid</div>
              <h1 className="mt-5 max-w-3xl font-serif text-4xl leading-[1.05] tracking-[-0.025em] sm:text-5xl lg:text-6xl">Alles over vliegtuiggeluid op één plek</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">Meld wat je ervaart, bekijk beschikbare informatie en bereid je eigen dossier voor. Uithoorn Online helpt je informatie ordenen, maar neemt geen officiële beslissing.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-3">
            {tools.map(({ to, title, text, icon: Icon, label }) => (
              <Link key={to} to={to} className="group relative flex min-h-[250px] flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white/88 p-6 shadow-[0_14px_45px_rgba(13,31,60,.08)] backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(13,31,60,.14)] focus:outline-none focus:ring-4 focus:ring-navy/10 sm:p-7">
                <div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-navy text-white shadow-lg shadow-navy/15"><Icon size={22} /></div><span className="grid h-10 w-10 place-items-center rounded-full border border-navy/10 bg-cream text-navy transition group-hover:bg-navy group-hover:text-white"><ArrowRight size={18} /></span></div>
                <h2 className="mt-7 font-serif text-2xl tracking-[-0.015em] text-navy sm:text-[27px]">{title}</h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-navy/62 sm:text-[15px]">{text}</p>
                <div className="mt-6 text-xs font-bold uppercase tracking-[0.12em] text-navy/50">{label}</div>
              </Link>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
            <div className="rounded-[24px] border border-navy/8 bg-white/78 p-5 shadow-sm backdrop-blur sm:p-6"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/[0.06] text-navy"><ShieldCheck size={18} /></div><div><h2 className="font-semibold text-navy">Wat je hier vastlegt</h2><p className="mt-1.5 text-sm leading-6 text-navy/62">Je melding blijft een bewonerswaarneming. Een ingevoerd vluchtnummer bewijst niet dat die vlucht de hinder heeft veroorzaakt.</p></div></div></div>
            <div className="rounded-[24px] border border-red/10 bg-red/[0.05] p-5 text-sm leading-6 text-navy/68 sm:p-6"><strong className="text-navy">Officiële status</strong><p className="mt-1.5">Officiële metingen, vluchtattributie, besluiten en eventuele rechten blijven bij bevoegde instanties.</p></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
