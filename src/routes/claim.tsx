import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Check, FileText, Sparkles, Scale, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/claim")({
  component: Claim,
  head: () => ({ meta: [{ title: "Claim — uithoorn.online" }] }),
});

// Compensatiebedragen worden NIET door de app bepaald. De daadwerkelijke
// vergoeding wordt vastgesteld door officiële instanties (BAS, Schiphol,
// ministerie van I&W) op basis van geverifieerde meetgegevens en regelgeving.
// Zie bezoekbas.nl en schiphol.nl voor actuele cijfers.

function Claim() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [years, setYears] = useState<number[]>([2023, 2024, 2025]);
  const [pkg, setPkg] = useState<"self" | "managed" | "legal" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const total = years.reduce((s, y) => s + (yearPayouts[y] ?? 0), 0);

  const toggleYear = (y: number) =>
    setYears((p) => p.includes(y) ? p.filter((x) => x !== y) : [...p, y].sort());

  const submit = async (chosen: "self" | "managed" | "legal") => {
    if (!user) { navigate({ to: "/auth", search: { next: "/claim" } as any }); return; }
    if (!name || !address || !postcode) { toast.error("Vul je gegevens in (stap 1)"); setStep(1); return; }
    if (years.length === 0) { toast.error("Selecteer minimaal één jaar"); setStep(2); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from("claims").insert({
      user_id: user.id, name, address, postcode, years_selected: years, package: chosen, paid: false,
    }).select("id").single();
    setSubmitting(false);
    if (error || !data) { toast.error("Kon claim niet opslaan"); return; }
    toast.success("Claim ingediend");
    navigate({ to: "/claim/success", search: { id: data.id, pkg: chosen } as any });
  };

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <h1 className="text-2xl font-serif">Start je claim</h1>
        <p className="mt-1 text-sm text-white/70">Drie stappen tot je compensatie</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-1">
              <div className={`h-1.5 rounded-full ${step >= n ? "bg-red" : "bg-white/15"}`} />
              <div className={`text-[10px] uppercase tracking-wider ${step >= n ? "text-red" : "text-white/40"}`}>
                Stap {n}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 -mt-5 pb-10">
        <div className="rounded-xl bg-white border border-border p-5 shadow-sm">
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="font-serif text-xl text-navy">Jouw gegevens</h2>
              <Field label="Volledige naam" value={name} onChange={setName} placeholder="Jan de Vries" />
              <Field label="Adres" value={address} onChange={setAddress} placeholder="Dorpsstraat 12" />
              <Field label="Postcode" value={postcode} onChange={(v) => setPostcode(v.toUpperCase())} placeholder="1421 AB" maxLength={7} />
              <button
                onClick={() => setStep(2)}
                disabled={!name || !address || !postcode}
                className="mt-2 w-full rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40"
              >Volgende</button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="font-serif text-xl text-navy">Welke jaren claimen?</h2>
              <p className="text-xs text-muted-foreground">Selecteer de jaren waarin je overlast had.</p>
              <div className="mt-2 space-y-2">
                {[2023, 2024, 2025].map((y) => {
                  const on = years.includes(y);
                  return (
                    <button
                      key={y}
                      onClick={() => toggleYear(y)}
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left ${on ? "border-red bg-red/5" : "border-border bg-cream"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded-md grid place-items-center ${on ? "bg-red text-white" : "bg-white border border-border"}`}>
                          {on && <Check size={14} />}
                        </div>
                        <div>
                          <div className="font-serif text-navy">{y}</div>
                          <div className="text-[11px] text-muted-foreground">Norm overschreden</div>
                        </div>
                      </div>
                      <div className="font-mono text-navy text-sm">€{yearPayouts[y]}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl bg-navy text-white p-4 flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] uppercase text-white/60">Totaal</div>
                  <div className="text-[10px] text-white/40">{years.length} jaar geselecteerd</div>
                </div>
                <div className="font-serif text-2xl">€{total.toLocaleString("nl-NL")}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-border py-3 text-navy">Terug</button>
                <button onClick={() => setStep(3)} disabled={years.length === 0} className="flex-1 rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40">Volgende</button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <h2 className="font-serif text-xl text-navy">Hoe wil je claimen?</h2>
              <PackageCard
                Icon={FileText}
                title="Zelf doen"
                price="Gratis"
                desc="Je krijgt een PDF met instructies en alle benodigde brieven."
                onClick={() => { setPkg("self"); submit("self"); }}
                active={pkg === "self"}
              />
              <PackageCard
                Icon={Sparkles}
                title="Wij regelen het"
                price="€29"
                desc="Wij dienen je claim in en handelen alle correspondentie af."
                onClick={() => { setPkg("managed"); submit("managed"); }}
                active={pkg === "managed"}
                highlight
              />
              <PackageCard
                Icon={Scale}
                title="Juridisch advies"
                price="Gratis intake"
                desc="Doorverwijzing naar een gespecialiseerde advocaat."
                onClick={() => { setPkg("legal"); submit("legal"); }}
                active={pkg === "legal"}
              />
              <button onClick={() => setStep(2)} className="mt-2 w-full rounded-xl border border-border py-3 text-navy">Terug</button>
              {submitting && <p className="text-center text-xs text-muted-foreground">Bezig met opslaan...</p>}
              {!user && (
                <Link to="/auth" className="block text-center text-xs text-red mt-2">
                  Inloggen vereist om te claimen →
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-navy">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full rounded-xl border border-border bg-cream px-3 py-2.5 outline-none focus:border-navy"
      />
    </div>
  );
}

function PackageCard({ Icon, title, price, desc, onClick, active, highlight }: {
  Icon: any; title: string; price: string; desc: string; onClick: () => void; active?: boolean; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition ${
        active ? "border-red bg-red/5" : highlight ? "border-navy bg-white" : "border-border bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${highlight ? "bg-red text-white" : "bg-navy text-white"}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-serif text-navy text-lg leading-tight">{title}</h3>
            <span className="font-mono text-sm text-navy">{price}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
        <ChevronRight size={16} className="text-navy/40 mt-3" />
      </div>
    </button>
  );
}
