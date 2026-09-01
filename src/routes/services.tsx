import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Home, Search, Wrench } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { featureFlags } from "@/config/featureFlags";

export const Route = createFileRoute("/services")({ component: ServicesPage, head: () => ({ meta: [
  { title: "Lokale diensten — uithoorn.online" },
  { name: "description", content: "Vind lokale diensten in Uithoorn of vertel ons welke hulp je zoekt." },
] }) });

const categories = [
  ["Schoonmaak", "Schoonmaak thuis of periodiek", "cleaning"],
  ["Klus & onderhoud", "Kleine reparaties en montage", "handyman"],
  ["Tuin", "Tuinonderhoud en groen", "garden"],
  ["Verhuizen", "Verhuizen en transport", "moving"],
  ["Computerhulp", "Hulp aan huis met computer of telefoon", "tech"],
  ["Hulp aan huis", "Praktische hulp in en rond het huis", "home-help"],
] as const;

function ServicesPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [postcode, setPostcode] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const enabled = featureFlags.localServicesV1;

  const submit = async () => {
    if (!user) { toast.error("Log in om een aanvraag te bewaren"); return; }
    if (!selected) { toast.error("Kies eerst een dienst"); return; }
    const { error } = await supabase.from("service_requests").insert({ user_id: user.id, category: selected, details: details.trim() || null, postcode: postcode.trim().toUpperCase() || null, status: "new" });
    if (error) { toast.error("Aanvraag kon niet worden opgeslagen"); return; }
    setSubmitted(true);
  };

  if (!enabled) return <AppShell><div className="mx-auto max-w-3xl px-5 py-16 text-center sm:px-6"><p className="text-sm text-muted-foreground">Lokale diensten worden voorbereid.</p></div></AppShell>;

  return <AppShell>
    <section className="bg-navy px-5 pb-10 pt-8 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-red" /> Lokale diensten</div>
      <h1 className="mt-3 max-w-2xl text-3xl sm:text-4xl">Hulp nodig in Uithoorn?</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Vertel wat je zoekt. We verzamelen je aanvraag en bouwen een lokaal netwerk van dienstverleners. We zijn geen overheidsinstantie en geven geen garantie over een dienstverlener.</p>
    </div></section>

    <main className="mx-auto max-w-4xl px-5 py-7 pb-16 sm:px-6 lg:px-8">
      {submitted ? <div className="rounded-2xl border border-border bg-white p-7 text-center shadow-sm"><CheckCircle2 className="mx-auto text-red" size={30}/><h2 className="mt-3 font-serif text-2xl text-navy">Aanvraag ontvangen</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Je aanvraag is privé opgeslagen. Een aanvraag is nog geen bevestigde afspraak en we vertegenwoordigen geen dienstverlener.</p><button onClick={()=>{setSubmitted(false);setSelected(null);setDetails("");setPostcode("");}} className="mt-5 rounded-xl bg-navy px-5 py-3 text-sm font-semibold text-white">Nieuwe aanvraag</button></div> : <>
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-navy/10 bg-cream px-4 py-3"><Search size={18} className="text-navy/65"/><div><div className="text-xs font-semibold text-navy">Beschrijf je behoefte</div><div className="text-[11px] text-navy/55">We gebruiken je informatie om een passende lokale categorie te bepalen.</div></div></div>
        <section><h2 className="font-serif text-2xl text-navy">Waar heb je hulp bij?</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categories.map(([name, desc, key])=><button key={key} onClick={()=>setSelected(key)} className={`rounded-2xl border p-4 text-left transition ${selected===key?"border-red bg-red/5 ring-2 ring-red/15":"border-border bg-white hover:border-navy/20"}`}><div className="flex items-start justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cream text-navy"><Wrench size={17}/></span>{selected===key&&<CheckCircle2 size={18} className="text-red"/>}</div><div className="mt-3 text-sm font-semibold text-navy">{name}</div><div className="mt-1 text-[11px] leading-5 text-muted-foreground">{desc}</div></button>)}</div></section>
        <section className="mt-7 rounded-2xl border border-border bg-white p-5 shadow-sm"><h2 className="font-serif text-xl text-navy">Je aanvraag</h2><label className="mt-4 block text-xs font-semibold text-navy" htmlFor="service-details">Wat heb je nodig? <span className="font-normal text-muted-foreground">(optioneel)</span></label><textarea id="service-details" value={details} onChange={e=>setDetails(e.target.value)} rows={4} maxLength={1000} placeholder="Bijv. twee kamers schoonmaken, liefst op een doordeweekse ochtend…" className="mt-1.5 w-full resize-none rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none"/><label className="mt-4 block text-xs font-semibold text-navy" htmlFor="service-postcode">Postcode <span className="font-normal text-muted-foreground">(optioneel)</span></label><input id="service-postcode" value={postcode} onChange={e=>setPostcode(e.target.value)} placeholder="Bijv. 1421 AB" maxLength={7} className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-sm outline-none"/><div className="mt-4 flex gap-2 rounded-xl bg-cream p-3 text-[11px] leading-5 text-navy/65"><Clock3 size={14} className="mt-0.5 shrink-0"/>We slaan alleen de informatie op die je zelf invult. We presenteren geen bedrijf als gecontroleerd of aanbevolen zonder afzonderlijke verificatie.</div><button onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red px-4 py-4 text-sm font-semibold text-red-foreground">Aanvraag bewaren <ArrowRight size={17}/></button></section>
      </>}
    </main>
  </AppShell>;
}
