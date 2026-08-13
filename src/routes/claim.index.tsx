import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronRight, FileText, Scale, Sparkles, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/claim/")({
  component: Claim,
  head: () => ({ meta: [{ title: "Claim — uithoorn.online" }] }),
});

type PackageChoice = "self" | "managed" | "legal";

const PACKAGE_META: Record<PackageChoice, { title: string; price: string; priceLabel: string }> = {
  self: { title: "Zelf doen", price: "Gratis", priceLabel: "€0" },
  managed: {
    title: "Wij regelen het",
    price: "15% no cure no pay",
    priceLabel: "€0 vooraf · 15% (max €300)",
  },
  legal: { title: "Juridische doorverwijzing", price: "Gratis", priceLabel: "€0" },
};

const STEP_LABELS = ["Gegevens", "Pakket & betaling", "Bevestiging"] as const;

function Claim() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [years, setYears] = useState<number[]>([2023, 2024, 2025]);
  const [pkg, setPkg] = useState<PackageChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claimId, setClaimId] = useState<string | null>(null);

  const toggleYear = (y: number) =>
    setYears((p) => (p.includes(y) ? p.filter((x) => x !== y) : [...p, y].sort()));

  const detailsValid = !!name && !!address && !!postcode && years.length > 0;

  const confirmAndPay = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { next: "/claim" } });
      return;
    }
    if (!pkg) {
      toast.error("Kies een pakket");
      return;
    }
    if (!detailsValid) {
      toast.error("Vul je gegevens in (stap 1)");
      setStep(1);
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
        package: pkg,
        paid: true,
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error("Kon claim niet opslaan");
      return;
    }
    setClaimId(data.id);
    setStep(3);
    toast.success("Claim ingediend");
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
              Na het inloggen kom je terug op deze claimflow en kun je direct doorgaan.
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
        <p className="mt-1 text-sm text-white/70">
          Stap {step} van 3 — {STEP_LABELS[step - 1]}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            return (
              <div key={label} className="space-y-1">
                <div className={`h-1.5 rounded-full ${step >= n ? "bg-red" : "bg-white/15"}`} />
                <div
                  className={`text-[10px] uppercase tracking-wider ${
                    step >= n ? "text-red" : "text-white/40"
                  }`}
                >
                  {label}
                </div>
              </div>
            );
          })}
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
              <div>
                <div className="text-xs font-medium text-navy mt-2">Jaren met overlast</div>
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
                          <div className="font-serif text-navy">{y}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!detailsValid}
                className="mt-3 w-full rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40"
              >
                Volgende: pakket kiezen
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="font-serif text-xl text-navy">Kies je pakket</h2>
              <p className="text-xs text-muted-foreground">
                Je betaalt vooraf niets voor een pakket. De vergoeding zelf wordt vastgesteld door
                BAS / Schiphol / ministerie van I&amp;W.
              </p>
              <PackageCard
                Icon={FileText}
                title={PACKAGE_META.self.title}
                price={PACKAGE_META.self.price}
                desc="Je krijgt je claimoverzicht en officiële bronnen voor de vervolgstap."
                onClick={() => setPkg("self")}
                active={pkg === "self"}
              />
              <PackageCard
                Icon={Sparkles}
                title={PACKAGE_META.managed.title}
                price={PACKAGE_META.managed.price}
                desc="Wij behandelen je aanvraag. No cure no pay: 15% van een toegekende vergoeding, met een maximum van €300. Geen vergoeding = geen kosten."
                onClick={() => setPkg("managed")}
                active={pkg === "managed"}
                highlight
              />
              <PackageCard
                Icon={Scale}
                title={PACKAGE_META.legal.title}
                price={PACKAGE_META.legal.price}
                desc="Gratis doorverwijzing naar een gespecialiseerde jurist. Eventuele kosten spreek je rechtstreeks met de jurist af."
                onClick={() => setPkg("legal")}
                active={pkg === "legal"}
              />

              {pkg && (
                <div className="mt-3 rounded-xl bg-cream border border-border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-navy">Kosten vooraf</span>
                    <span className="font-mono text-navy">{PACKAGE_META[pkg].priceLabel}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {pkg === "self"
                      ? "Geen kosten. Je bevestigt en gaat direct door."
                      : pkg === "managed"
                        ? "Geen kosten vooraf. Alleen bij een toegekende vergoeding rekenen wij 15% (maximaal €300)."
                        : "Geen kosten. Wij verwijzen je door naar een gespecialiseerde jurist."}
                  </p>
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-border py-3 text-navy"
                >
                  Terug
                </button>
                <button
                  onClick={confirmAndPay}
                  disabled={!pkg || submitting}
                  className="flex-1 rounded-xl bg-red py-3 text-red-foreground font-medium disabled:opacity-40"
                >
                  {submitting
                    ? "Bezig…"
                    : pkg === "self"
                      ? "Bevestigen"
                      : "Bevestigen"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red grid place-items-center">
                  <CheckCircle2 size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="font-serif text-xl text-navy">Claim bevestigd</h2>
                  <p className="text-xs text-muted-foreground">
                    Referentie {claimId ? claimId.slice(0, 8).toUpperCase() : "—"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-cream border border-border p-4 text-sm space-y-1">
                <Row label="Naam" value={name} />
                <Row label="Adres" value={`${address}, ${postcode}`} />
                <Row label="Jaren" value={years.join(", ")} />
                <Row label="Pakket" value={pkg ? PACKAGE_META[pkg].title : "—"} />
                <Row label="Kosten" value={pkg ? PACKAGE_META[pkg].priceLabel : "—"} />
              </div>
              <p className="text-xs text-muted-foreground">
                De vergoeding zelf wordt vastgesteld door officiële instanties (BAS / Schiphol /
                ministerie van I&amp;W) op basis van geverifieerde meetgegevens.
              </p>
              <Link
                to="/claim/success"
                search={claimId ? { id: claimId, pkg: pkg ?? undefined } : { pkg: pkg ?? undefined }}
                className="block w-full rounded-xl bg-red py-3 text-center text-red-foreground font-medium"
              >
                Bekijk vervolgstappen
              </Link>
              <Link
                to="/log"
                className="block w-full rounded-xl border border-border py-3 text-center text-navy"
              >
                Overlast loggen
              </Link>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-navy text-right">{value}</span>
    </div>
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
      className={`w-full text-left rounded-xl border p-4 transition ${
        active
          ? "border-red bg-red/5"
          : highlight
            ? "border-navy bg-white"
            : "border-border bg-white"
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
