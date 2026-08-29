import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronRight, FileText, Scale, Sparkles, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type PackageChoice = "self" | "managed" | "legal";
const PACKAGE_META: Record<PackageChoice, { title: string; price: string; desc: string }> = {
  self: { title: "Zelf doen", price: "Gratis", desc: "Je dossieroverzicht en verwijzingen naar officiële routes." },
  managed: { title: "Dossierbegeleiding", price: "€100", desc: "Voorbereiding en ordening van je beschikbare informatie en bewijsstukken." },
  legal: { title: "Uitgebreide dossierbegeleiding", price: "€450", desc: "Uitgebreide intake en voorbereiding van vervolgstappen. Geen garantie op een juridische of officiële uitkomst." },
};
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];
const POSTCODE_RE = /^\d{4}\s?[A-Z]{2}$/;
const STEP_LABELS = ["Gegevens", "Service", "Bevestiging"] as const;

export const Route = createFileRoute("/claim/")({
  component: Claim,
  head: () => ({
    meta: [
      { title: "Dossier voorbereiden — uithoorn.online" },
      { name: "description", content: "Stel je eigen dossier samen met informatie en bewijs rond Schiphol-geluidsoverlast." },
    ],
  }),
});

function Claim() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [years, setYears] = useState<number[]>(YEAR_OPTIONS);
  const [pkg, setPkg] = useState<PackageChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const postcodeValid = POSTCODE_RE.test(postcode.trim());
  const detailsValid = name.trim().length > 1 && address.trim().length > 3 && postcodeValid && years.length > 0;
  const toggleYear = (year: number) => setYears((current) => current.includes(year) ? current.filter((x) => x !== year) : [...current, year].sort());

  const saveDossier = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { next: "/claim" } });
      return;
    }
    if (!pkg || !detailsValid || !agreed) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("claims").insert({
      user_id: user.id,
      name: name.trim(),
      address: address.trim(),
      postcode: postcode.trim().toUpperCase(),
      years_selected: years,
      package: pkg,
      paid: pkg === "self",
    }).select("id").single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Kon dossier niet opslaan");
      return;
    }
    setDossierId(data.id);
    setStep(3);
    toast.success("Dossier opgeslagen");
  };

  if (authLoading) return <AppShell><section className="bg-navy text-navy-foreground px-5 pt-6 pb-7"><h1 className="text-2xl font-serif">Dossier voorbereiden</h1><p className="mt-1 text-sm text-white/70">Je sessie wordt gecontroleerd…</p></section></AppShell>;

  if (!user) return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7"><h1 className="text-2xl font-serif">Dossier voorbereiden</h1><p className="mt-1 text-sm text-white/70">Log in om je dossier veilig in je account te bewaren.</p></section>
      <section className="px-5 -mt-5 pb-10"><div className="rounded-xl bg-white border border-border p-5 shadow-sm"><h2 className="font-serif text-xl text-navy">Dossier bewaren</h2><p className="mt-2 text-sm text-muted-foreground">Uithoorn Online is geen overheidsinstantie en bepaalt niet of je recht hebt op compensatie.</p><Link to="/auth" search={{ next: "/claim" }} className="mt-4 block rounded-xl bg-red py-3 text-center font-medium text-red-foreground">Inloggen</Link></div></section>
    </AppShell>
  );

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <h1 className="text-2xl font-serif">Dossier voorbereiden</h1>
        <p className="mt-1 text-sm text-white/70">Stap {step} van 3 — {STEP_LABELS[step - 1]}</p>
        <div className="mt-5 grid grid-cols-3 gap-2">{STEP_LABELS.map((label, index) => { const n = index + 1; return <div key={label}><div className={`h-1.5 rounded-full ${step >= n ? "bg-red" : "bg-white/15"}`} /><div className={`mt-1 text-[10px] uppercase tracking-wider ${step >= n ? "text-red" : "text-white/40"}`}>{label}</div></div>; })}</div>
      </section>

      <section className="px-5 -mt-5 pb-10"><div className="rounded-xl bg-white border border-border p-5 shadow-sm">
        {step === 1 && <div className="space-y-3">
          <h2 className="font-serif text-xl text-navy">Jouw gegevens</h2>
          <Field label="Volledige naam" value={name} onChange={setName} placeholder="Jan de Vries" />
          <Field label="Adres" value={address} onChange={setAddress} placeholder="Dorpsstraat 12" />
          <Field label="Postcode" value={postcode} onChange={(value) => setPostcode(value.toUpperCase())} placeholder="1421 AB" maxLength={7} />
          {postcode.length > 0 && !postcodeValid && <p className="text-[11px] text-red">Vul een geldige Nederlandse postcode in, bijvoorbeeld 1421 AB.</p>}
          <div><div className="text-xs font-medium text-navy mt-2">Jaren met ervaren overlast</div><div className="mt-2 space-y-2">{YEAR_OPTIONS.map((year) => { const selected = years.includes(year); return <button type="button" key={year} onClick={() => toggleYear(year)} className={`w-full flex items-center rounded-xl border px-4 py-3 text-left ${selected ? "border-red bg-red/5" : "border-border bg-cream"}`}><span className={`h-5 w-5 rounded-md grid place-items-center mr-3 ${selected ? "bg-red text-white" : "bg-white border border-border"}`}>{selected && <Check size={14} />}</span><span className="font-serif text-navy">{year}</span></button>; })}</div></div>
          <button type="button" onClick={() => setStep(2)} disabled={!detailsValid} className="mt-3 w-full rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40">Volgende</button>
        </div>}

        {step === 2 && <div className="space-y-3">
          <h2 className="font-serif text-xl text-navy">Kies een service</h2>
          <div className="rounded-xl border border-border bg-cream p-4 text-xs text-muted-foreground">Uithoorn Online bepaalt geen recht op compensatie, geen compensatiebedrag en geen officiële uitkomst. De service hieronder is uitsluitend voor dossierondersteuning.</div>
          {(Object.keys(PACKAGE_META) as PackageChoice[]).map((choice) => { const meta = PACKAGE_META[choice]; const Icon = choice === "self" ? FileText : choice === "managed" ? Sparkles : Scale; return <button type="button" key={choice} onClick={() => setPkg(choice)} className={`w-full text-left rounded-xl border p-4 ${pkg === choice ? "border-red bg-red/5" : "border-border bg-white"}`}><div className="flex items-start gap-3"><div className="h-10 w-10 rounded-xl grid place-items-center bg-navy text-white"><Icon size={18} /></div><div className="flex-1"><div className="flex items-baseline justify-between gap-2"><h3 className="font-serif text-navy text-lg">{meta.title}</h3><span className="font-mono text-sm text-navy">{meta.price}</span></div><p className="text-xs text-muted-foreground mt-1">{meta.desc}</p></div><ChevronRight size={16} className="text-navy/40 mt-3" /></div></button>; })}
          {pkg && <label className="flex items-start gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-red" /><span>Ik ga akkoord met de <Link to="/voorwaarden" className="underline text-navy">algemene voorwaarden</Link> en <Link to="/privacy" className="underline text-navy">privacyverklaring</Link>. Ik begrijp dat Uithoorn Online geen overheidsinstantie is en geen compensatie of officiële uitkomst kan garanderen.</span></label>}
          <div className="flex gap-2 mt-2"><button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-border py-3 text-navy">Terug</button><button type="button" onClick={saveDossier} disabled={!pkg || !agreed || submitting} className="flex-1 rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40">{submitting ? "Opslaan…" : "Dossier opslaan"}</button></div>
        </div>}

        {step === 3 && <div className="space-y-4">
          <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-red grid place-items-center"><CheckCircle2 size={22} className="text-white" /></div><div><h2 className="font-serif text-xl text-navy">Dossier opgeslagen</h2><p className="text-xs text-muted-foreground">Referentie {dossierId ? dossierId.slice(0, 8).toUpperCase() : "—"}</p></div></div>
          <div className="rounded-xl bg-cream border border-border p-4 text-sm space-y-1"><Row label="Naam" value={name} /><Row label="Adres" value={`${address}, ${postcode}`} /><Row label="Jaren" value={years.join(", ")} /><Row label="Service" value={pkg ? PACKAGE_META[pkg].title : "—"} /><Row label="Servicekosten" value={pkg ? PACKAGE_META[pkg].price : "—"} /></div>
          {pkg && pkg !== "self" && <p className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-xs text-amber-900">Er is nog niets betaald. Een officiële aanvraag is hiermee niet ingediend. Als je voor betaalde dossierbegeleiding kiest, ontvang je een afzonderlijk betaalverzoek volgens de aangeboden servicevoorwaarden.</p>}
          <p className="text-xs text-muted-foreground">Dit dossier is een hulpmiddel voor het verzamelen en ordenen van informatie. Alleen de bevoegde instantie kan bepalen of je recht hebt op compensatie en welke formele uitkomst volgt.</p>
          <Link to="/claim/success" search={dossierId ? { id: dossierId, pkg: pkg ?? undefined } : { pkg: pkg ?? undefined }} className="block w-full rounded-xl bg-red py-3 text-center text-red-foreground font-medium">Bekijk vervolgstappen</Link>
          <Link to="/log" className="block w-full rounded-xl border border-border py-3 text-center text-navy">Overlast loggen</Link>
        </div>}
      </div></section>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-navy text-right">{value}</span></div>; }
function Field({ label, value, onChange, placeholder, maxLength }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; maxLength?: number }) { return <div><label className="text-xs font-medium text-navy">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} className="mt-1 w-full rounded-xl border border-border bg-cream px-3 py-2.5 outline-none focus:border-navy" /></div>; }
