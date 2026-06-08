import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronRight, FileText, Scale, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/claim/")({
  component: Claim,
  head: () => ({ meta: [{ title: "Claim — uithoorn.online" }] }),
});

type PackageChoice = "self" | "managed" | "legal";

// Compensatiebedragen worden NIET door de app bepaald. De daadwerkelijke
// vergoeding wordt vastgesteld door officiële instanties (BAS, Schiphol,
// ministerie van I&W) op basis van geverifieerde meetgegevens en regelgeving.
// Zie bezoekbas.nl en schiphol.nl voor actuele cijfers.

function Claim() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [years, setYears] = useState<number[]>([2023, 2024, 2025]);
  const [pkg, setPkg] = useState<PackageChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleYear = (y: number) =>
    setYears((p) => (p.includes(y) ? p.filter((x) => x !== y) : [...p, y].sort()));

  const submit = async (chosen: PackageChoice) => {
    if (!user) {
      navigate({ to: "/auth", search: { next: "/claim" } });
      return;
    }
    if (!name || !address || !postcode) {
      toast.error("Vul je gegevens in (stap 1)");
      setStep(1);
      return;
    }
    if (years.length === 0) {
      toast.error("Selecteer minimaal één jaar");
      setStep(2);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("claims")
      .insert({
        user_id: user.id,
        name,
        address,
        postcode,
        years_selected: years,
        package: chosen,
        paid: false,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Kon claim niet opslaan");
      return;
    }
    toast.success("Claim ingediend");
    navigate({ to: "/claim/success", search: { id: data.id, pkg: chosen } });
  };

  if (authLoading) {
    return (
      <AppShell>
        <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
          <h1 className="text-2xl font-serif">Start je claim</h1>
          <p className="mt-1 text-sm text-white/70">Je sessie wordt gecontroleerd…</p>
        </section>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
          <h1 className="text-2xl font-serif">Start je claim</h1>
          <p className="mt-1 text-sm text-white/70">
            Log eerst in zodat je dossier kan worden opgeslagen.
          </p>
        </section>
        <section className="px-5 -mt-5 pb-10">
          <div className="rounded-xl bg-white border border-border p-5 shadow-sm">
            <h2 className="font-serif text-xl text-navy">Dossier bewaren</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Na het inloggen kom je terug op deze claimflow en kun je direct doorgaan naar de
              vervolgstappen.
            </p>
            <Link
              to="/auth"
              search={{ next: "/claim" }}
              className="mt-4 block rounded-xl bg-red py-3 text-center font-medium text-red-foreground"
            >
              Inloggen en claim starten
            </Link>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <h1 className="text-2xl font-serif">Start je claim</h1>
        <p className="mt-1 text-sm text-white/70">Drie stappen tot je compensatie</p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-1">
              <div className={`h-1.5 rounded-full ${step >= n ? "bg-red" : "bg-white/15"}`} />
              <div
                className={`text-[10px] uppercase tracking-wider ${
                  step >= n ? "text-red" : "text-white/40"
                }`}
              >
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
              <Field
                label="Postcode"
                value={postcode}
                onChange={(v) => setPostcode(v.toUpperCase())}
                placeholder="1421 AB"
                maxLength={7}
              />
              <button
                onClick={() => setStep(2)}
                disabled={!name || !address || !postcode}
                className="mt-2 w-full rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40"
              >
                Volgende
              </button>
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
                      className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                        on ? "border-red bg-red/5" : "border-border bg-cream"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-5 w-5 rounded-md grid place-items-center ${
                            on ? "bg-red text-white" : "bg-white border border-border"
                          }`}
                        >
                          {on && <Check size={14} />}
                        </div>
                        <div>
                          <div className="font-serif text-navy">{y}</div>
                          <div className="text-[11px] text-muted-foreground">Jaar toevoegen aan dossier</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">officieel vast te stellen</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl bg-navy text-white p-4">
                <div className="text-[11px] uppercase text-white/60">Compensatiebedrag</div>
                <div className="mt-1 text-sm text-white/90">
                  Wordt vastgesteld door officiële instanties (BAS / Schiphol / ministerie van I&amp;W)
                  op basis van geverifieerde meetgegevens. De app toont geen schatting.
                </div>
                <div className="mt-2 text-[10px] text-white/50">
                  Bronnen in kennisbank: bezoekbas.nl • schiphol.nl
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-border py-3 text-navy">
                  Terug
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={years.length === 0}
                  className="flex-1 rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40"
                >
                  Volgende
                </button>
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
                desc="Na indienen krijg je direct je claimoverzicht en officiële bronnen voor de vervolgstap."
                onClick={() => {
                  setPkg("self");
                  submit("self");
                }}
                active={pkg === "self"}
              />
              <PackageCard
                Icon={Sparkles}
                title="Wij regelen het"
                price="€100"
                desc="Je aanvraag wordt opgeslagen voor behandeling namens jou; de vergoeding zelf wordt niet door de app bepaald."
                onClick={() => {
                  setPkg("managed");
                  submit("managed");
                }}
                active={pkg === "managed"}
                highlight
              />
              <PackageCard
                Icon={Scale}
                title="Juridisch traject"
                price="€450"
                desc="Je aanvraag wordt opgeslagen voor juridische intake en beoordeling van vervolgstappen."
                onClick={() => {
                  setPkg("legal");
                  submit("legal");
                }}
                active={pkg === "legal"}
              />
              <button onClick={() => setStep(2)} className="mt-2 w-full rounded-xl border border-border py-3 text-navy">
                Terug
              </button>
              {submitting && <p className="text-center text-xs text-muted-foreground">Bezig met opslaan...</p>}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, maxLength }: FieldProps) {
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

function PackageCard({ Icon, title, price, desc, onClick, active, highlight }: PackageCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className={`w-full text-left rounded-xl border p-4 transition ${
        active ? "border-red bg-red/5 opacity-70" : highlight ? "border-navy bg-white" : "border-border bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-xl grid place-items-center ${highlight ? "bg-red text-white" : "bg-navy text-white"}`}
        >
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

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
};

type PackageCardProps = {
  Icon: typeof FileText;
  title: string;
  price: string;
  desc: string;
  onClick: () => void;
  active?: boolean;
  highlight?: boolean;
};