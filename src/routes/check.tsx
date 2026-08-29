import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { MapPin, CheckCircle2, AlertCircle, ChevronRight, Loader2, ShieldCheck, ArrowLeft, Info } from "lucide-react";
import { EvidenceList } from "@/components/Evidence";
import { checkAddressLive, type AddressCheck } from "@/lib/live-data.functions";

export const Route = createFileRoute("/check")({
  component: Check,
  head: () => ({ meta: [
    { title: "Adres controleren — uithoorn.online" },
    { name: "description", content: "Controleer live via BAG en de geraadpleegde LIB-kaartlagen of jouw adres in een beperkingengebied ligt." },
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
    <main className="min-h-[calc(100dvh-84px)] bg-[radial-gradient(circle_at_85%_8%,rgba(255,43,43,.09),transparent_24%),linear-gradient(180deg,#f7f4ef_0%,#fbfaf8_48%,#f1f3f6_100%)]">
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute right-10 top-12 h-36 w-36 rounded-full border border-red/20" />
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-7 sm:px-8 sm:pb-16 sm:pt-10">
          <Link to="/" className="mb-9 inline-flex items-center gap-2 text-sm font-medium text-white/65 hover:text-white"><ArrowLeft size={16} /> Terug naar start</Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red"><span className="h-2 w-2 rounded-full bg-red" /> Adrescontrole</div>
            <h1 className="mt-4 font-serif text-[40px] leading-[1.04] tracking-[-0.025em] sm:text-[56px]">Controleer je adres.</h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-7 text-white/70 sm:text-[19px] sm:leading-8">Controleer je adres tegen actuele BAG-gegevens en de geraadpleegde LIB-kaartlagen. Je ziet precies wat de broncontrole oplevert.</p>
          </div>
        </div>
      </section>
      <section className="relative mx-auto -mt-8 max-w-6xl px-4 pb-8 sm:px-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form onSubmit={onCheck} className="rounded-[28px] border border-white/90 bg-white/90 p-5 shadow-[0_24px_70px_rgba(13,31,60,.14)] backdrop-blur-xl sm:p-8">
            <div className="flex items-start gap-4 rounded-[20px] border border-navy/10 bg-cream/75 p-4 sm:p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-navy text-white"><ShieldCheck size={20} /></div><div><div className="text-[15px] font-bold text-navy">Brononderbouwde controle</div><div className="mt-1 text-[13px] leading-5 text-navy/60">We gebruiken live brongegevens. Een geografische zonecontrole bepaalt op zichzelf geen recht op compensatie.</div></div></div>
            <div className="mt-8 grid gap-5 sm:grid-cols-[1fr_.52fr]">
              <label className="block"><span className="text-[14px] font-bold text-navy">Postcode</span><span className="mt-2 flex h-14 items-center gap-3 rounded-[17px] border border-navy/15 bg-[#faf9f7] px-4 transition focus-within:border-navy/45 focus-within:bg-white focus-within:ring-4 focus-within:ring-navy/5"><MapPin size={19} className="shrink-0 text-navy/45" /><input value={postcode} onChange={e => setPostcode(e.target.value.toUpperCase())} placeholder="1421 AB" className="min-w-0 flex-1 bg-transparent text-[18px] font-medium text-navy outline-none placeholder:text-navy/30" maxLength={7} autoFocus /></span></label>
              <label className="block"><span className="text-[14px] font-bold text-navy">Huisnummer</span><input value={house} onChange={e => setHouse(e.target.value)} placeholder="12A" className="mt-2 h-14 w-full rounded-[17px] border border-navy/15 bg-[#faf9f7] px-4 text-[18px] font-medium text-navy outline-none transition focus:border-navy/45 focus:bg-white focus:ring-4 focus:ring-navy/5" maxLength={10} /></label>
            </div>
            <button type="submit" disabled={loading || !postcode.trim() || !house.trim()} className="group mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-red px-5 text-[16px] font-bold text-white shadow-[0_12px_28px_-10px_rgba(255,43,43,.8)] transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-red/20 disabled:opacity-50">{loading && <Loader2 size={19} className="animate-spin" />}{loading ? "Bronnen worden geraadpleegd…" : "Controleer mijn adres"}<ChevronRight size={19} /></button>
            <div className="mt-4 flex items-start gap-2 px-1 text-[12px] leading-5 text-navy/48"><Info size={15} className="mt-0.5 shrink-0" />Je adres wordt alleen gebruikt voor deze controle. De uitkomst is informatief en geen officiële beslissing.</div>
          </form>
          <aside className="hidden rounded-[28px] border border-white/90 bg-white/65 p-6 shadow-[0_20px_60px_rgba(13,31,60,.08)] backdrop-blur-xl lg:block"><div className="text-xs font-bold uppercase tracking-[0.16em] text-navy/45">Zo werkt het</div><div className="mt-6 space-y-5">{[["01","Adres","Je postcode en huisnummer worden gecontroleerd."],["02","Bronnen","BAG en geraadpleegde kaartlagen leveren de broninformatie."],["03","Resultaat","Je krijgt de geografische uitkomst met bronnen."]].map(([n,t,d]) => <div key={n} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-bold text-white">{n}</span><div><div className="text-[14px] font-bold text-navy">{t}</div><div className="mt-1 text-[12px] leading-5 text-navy/55">{d}</div></div></div>)}</div></aside>
        </div>
      </section>
      {result && result.ok && <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-7"><div className={`overflow-hidden rounded-[28px] border bg-white shadow-[0_20px_60px_rgba(13,31,60,.10)] ${result.zone_status === "in_zone" ? "border-red/25" : result.zone_status === "unavailable" ? "border-amber-400/50" : "border-navy/10"}`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/8 bg-cream/60 px-5 py-5 sm:px-7"><div className="flex items-center gap-3 text-[15px] font-bold text-navy">{result.zone_status === "in_zone" ? <CheckCircle2 size={21} className="text-red" /> : <AlertCircle size={21} />}{result.zone_status === "in_zone" ? "Adres ligt binnen een geraadpleegde LIB-zone" : result.zone_status === "outside" ? "Adres ligt buiten de geraadpleegde LIB-zones" : "Zonecontrole niet beschikbaar"}</div><span className="rounded-full bg-navy/5 px-3 py-1.5 text-[11px] font-semibold text-navy/55">Brongecontroleerd</span></div><div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_280px]"><div><div className="text-xs font-bold uppercase tracking-[0.14em] text-navy/40">Gevonden adres</div><h2 className="mt-2 font-serif text-[30px] leading-tight text-navy sm:text-[36px]">{result.address.label}</h2><p className="mt-2 text-[13px] text-navy/55">Gemeente {result.address.municipality || "—"} · BAG {result.address.bag_id}</p>{result.zones.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{result.zones.map(z => <span key={z} className="rounded-full bg-navy px-3 py-2 text-[12px] font-semibold text-white">{z}</span>)}</div>}<div className="mt-6 rounded-[20px] border border-navy/8 bg-cream/65 p-5 text-[14px] leading-6 text-navy/72"><strong className="text-navy">Wat betekent dit?</strong><br />{result.note}</div></div><div><div className="rounded-[22px] border border-navy/8 bg-[#f8f8f7] p-5"><div className="text-xs font-bold uppercase tracking-[0.14em] text-navy/40">Belangrijk</div><p className="mt-3 text-[13px] leading-5 text-navy/65">Een kaartlaag geeft geografische informatie. Alleen een bevoegde instantie kan rechten, compensatie of een formele uitkomst bepalen.</p></div><div className="mt-5"><EvidenceList items={result.evidence} /></div></div></div><div className="border-t border-navy/8 p-5 sm:p-7"><Link to={result.zone_status === "in_zone" ? "/claim" : "/log"} className="group flex min-h-14 items-center justify-between rounded-[18px] bg-navy px-5 text-[15px] font-bold text-white transition hover:-translate-y-0.5"><span>{result.zone_status === "in_zone" ? "Dossier voorbereiden" : "Geluidshinder melden"}</span><ChevronRight size={19} className="transition group-hover:translate-x-0.5" /></Link></div></div></section>}
      {result && !result.ok && <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-7"><div className="rounded-[26px] border border-amber-300/60 bg-amber-50 p-6"><div className="flex items-center gap-3 text-sm font-bold text-amber-950"><AlertCircle size={20} />{result.reason === "not_found" ? "Adres niet gevonden" : "Bron niet bereikbaar"}</div><p className="mt-2 text-[14px] leading-6 text-amber-900">{result.message}</p><div className="mt-4"><EvidenceList items={result.evidence} /></div></div></section>}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-7"><div className="rounded-[22px] border border-navy/8 bg-white/65 p-5 text-[12px] leading-5 text-navy/55 shadow-sm backdrop-blur">De uitkomst is een brongebaseerde geografische controle. Uithoorn Online bepaalt hiermee geen rechten, compensatie of formele uitkomst.</div></section>
    </main>
  </AppShell>;
}
