import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { MapPin, CheckCircle2, AlertCircle, ChevronRight, Loader2, ShieldCheck } from "lucide-react";
import { EvidenceList } from "@/components/Evidence";
import { checkAddressLive, type AddressCheck } from "@/lib/live-data.functions";

export const Route = createFileRoute("/check")({
  component: Check,
  head: () => ({ meta: [
    { title: "Adres controleren — uithoorn.online" },
    { name: "description", content: "Controleer live via BAG en de LIB Schiphol-kaartlagen of jouw adres in een beperkingengebied ligt." },
  ]}),
});

function Check() {
  const [postcode, setPostcode] = useState("");
  const [house, setHouse] = useState("");
  const [result, setResult] = useState<AddressCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const run = useServerFn(checkAddressLive);

  const onCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postcode.trim() || !house.trim()) return;
    setLoading(true); setResult(null);
    try { setResult(await run({ data: { postcode, house_number: house } })); }
    catch (err) { setResult({ ok: false, reason: "unavailable", message: err instanceof Error ? err.message : "Onbekende fout", evidence: [] }); }
    finally { setLoading(false); }
  };

  return <AppShell>
    <section className="bg-navy px-5 pb-8 pt-7 text-navy-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-red" /> Adrescontrole</div>
        <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">Controleer je adres</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">Controleer je adres rechtstreeks tegen officiële BAG-gegevens en de geraadpleegde LIB-kaartlagen.</p>
      </div>
    </section>

    <section className="mx-auto -mt-5 max-w-3xl px-5 pb-4 sm:px-6">
      <form onSubmit={onCheck} className="rounded-2xl border border-border bg-white p-5 shadow-[0_18px_50px_rgba(13,31,60,.10)] sm:p-6">
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-navy/10 bg-cream px-4 py-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-navy/65" /><div><div className="text-xs font-semibold text-navy">Brononderbouwde controle</div><div className="mt-0.5 text-[11px] leading-5 text-navy/55">De controle gebruikt live brongegevens. Een zonecontrole bepaalt op zichzelf geen recht op compensatie.</div></div></div>
        <div className="grid gap-4 sm:grid-cols-[1fr_.55fr]">
          <div><label className="text-xs font-semibold text-navy">Postcode</label><div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-cream px-3 py-3"><MapPin size={17} className="text-navy/45" /><input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="1421 AB" className="min-w-0 flex-1 bg-transparent text-base outline-none" maxLength={7} autoFocus /></div></div>
          <div><label className="text-xs font-semibold text-navy">Huisnummer</label><input value={house} onChange={e => setHouse(e.target.value)} placeholder="12A" className="mt-1.5 w-full rounded-xl border border-border bg-cream px-3 py-3 text-base outline-none" maxLength={10} /></div>
        </div>
        <button type="submit" disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red py-3.5 font-semibold text-red-foreground shadow-[0_8px_22px_-10px_rgba(255,60,42,.7)] disabled:opacity-60">{loading && <Loader2 size={16} className="animate-spin" />}{loading ? "Officiële bronnen raadplegen…" : "Controleer adres"}<ChevronRight size={17} /></button>
      </form>
    </section>

    {result && result.ok && <section className="mx-auto max-w-3xl px-5 pb-10 sm:px-6">
      <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${result.zone_status === "in_zone" ? "border-red/30" : result.zone_status === "unavailable" ? "border-amber-400/50" : "border-navy/15"}`}>
        <div className="border-b border-border bg-cream/70 px-5 py-4"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-navy/55">{result.zone_status === "in_zone" ? <CheckCircle2 size={16} className="text-red" /> : <AlertCircle size={16} />}{result.zone_status === "in_zone" ? "Binnen LIB-zone" : result.zone_status === "outside" ? "Buiten LIB-zones" : "Zonecontrole niet beschikbaar"}</div></div>
        <div className="p-5 sm:p-6"><h2 className="text-2xl text-navy">{result.address.label}</h2><p className="mt-1 text-xs text-muted-foreground">Gemeente {result.address.municipality || "—"} · BAG {result.address.bag_id}</p>
          {result.zones.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{result.zones.map(z => <div key={z} className="rounded-xl bg-cream px-3 py-2.5 text-sm font-medium text-navy">{z}</div>)}</div>}
          <div className="mt-4 rounded-xl border border-navy/10 bg-cream/60 p-4 text-sm leading-6 text-navy/70"><strong className="text-navy">Wat betekent dit?</strong><br />{result.note}</div>
          <div className="mt-5"><EvidenceList items={result.evidence} /></div>
          <Link to={result.zone_status === "in_zone" ? "/claim" : "/log"} className="mt-5 flex items-center justify-between rounded-xl bg-navy px-4 py-3.5 font-semibold text-white"><span>{result.zone_status === "in_zone" ? "Dossier voorbereiden" : "Geluidshinder melden"}</span><ChevronRight size={18} /></Link>
        </div>
      </div>
    </section>}

    {result && !result.ok && <section className="mx-auto max-w-3xl px-5 pb-10 sm:px-6"><div className="rounded-2xl border border-amber-400/50 bg-amber-50 p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-900"><AlertCircle size={17} />{result.reason === "not_found" ? "Adres niet gevonden" : "Bron niet bereikbaar"}</div><p className="mt-2 text-sm leading-6 text-amber-900">{result.message}</p><div className="mt-3"><EvidenceList items={result.evidence} /></div></div></section>}

    <section className="mx-auto max-w-3xl px-5 pb-12 sm:px-6"><p className="rounded-xl border border-border bg-white p-4 text-[11px] leading-5 text-muted-foreground">De uitkomst is een brongebaseerde geografische controle. Uithoorn Online bepaalt hiermee geen rechten, compensatie of formele uitkomst.</p></section>
  </AppShell>;
}
