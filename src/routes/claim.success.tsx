import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { CheckCircle2, FileText, Mail, Scale, Sparkles, Download, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
  pkg: z.enum(["self", "managed", "legal"]).optional(),
});

export const Route = createFileRoute("/claim/success")({
  validateSearch: searchSchema,
  component: ClaimSuccess,
  head: () => ({ meta: [{ title: "Claim ingediend — uithoorn.online" }] }),
});

type ClaimRow = {
  id: string;
  name: string;
  address: string;
  postcode: string;
  years_selected: number[];
  package: "self" | "managed" | "legal";
  paid: boolean;
  created_at: string;
};

// Geen hardcoded compensatiebedragen — vergoeding wordt officieel vastgesteld.

function ClaimSuccess() {
  const { id, pkg } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth", search: { next: "/claim" } as any }); return; }
    (async () => {
      let q = supabase.from("claims").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
      if (id) q = supabase.from("claims").select("*").eq("user_id", user.id).eq("id", id).limit(1);
      const { data } = await q;
      setClaim((data?.[0] as ClaimRow) ?? null);
      setLoading(false);
    })();
  }, [user, authLoading, id, navigate]);

  const activePkg = (claim?.package ?? pkg) as "self" | "managed" | "legal" | undefined;

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-8">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-red grid place-items-center">
            <CheckCircle2 size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-serif">Claim ingediend</h1>
            <p className="text-sm text-white/70">We hebben je aanvraag ontvangen</p>
          </div>
        </div>
        {claim && (
          <div className="mt-5 rounded-xl bg-white/10 p-4 text-sm">
            <div className="flex justify-between"><span className="text-white/60">Referentie</span><span className="font-mono">{claim.id.slice(0, 8).toUpperCase()}</span></div>
            <div className="flex justify-between mt-1"><span className="text-white/60">Jaren</span><span>{claim.years_selected.join(", ")}</span></div>
            <div className="mt-2 text-[11px] text-white/60">Compensatiebedrag wordt officieel vastgesteld door BAS / Schiphol / ministerie van I&amp;W. De app maakt geen schatting.</div>
          </div>
        )}
      </section>

      <section className="px-5 -mt-4 pb-24 space-y-4">
        <div className="rounded-xl bg-white border border-border p-5 shadow-sm">
          <h2 className="font-serif text-lg text-navy">Wat gebeurt er nu?</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground mt-3">Laden…</p>
          ) : activePkg === "self" ? (
            <SelfSteps />
          ) : activePkg === "managed" ? (
            <ManagedSteps />
          ) : activePkg === "legal" ? (
            <LegalSteps />
          ) : (
            <p className="text-sm text-muted-foreground mt-3">Geen claimgegevens gevonden.</p>
          )}
        </div>

        <div className="rounded-xl bg-cream border border-border p-5">
          <h3 className="font-serif text-navy">Versterk je claim</h3>
          <p className="text-xs text-muted-foreground mt-1">Hoe meer overlast je logt, hoe sterker je dossier.</p>
          <div className="mt-3 grid gap-2">
            <Link to="/log" className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3">
              <span className="text-sm font-medium text-navy">Overlast loggen</span><ArrowRight size={16} className="text-navy/60" />
            </Link>
            <Link to="/map" className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3">
              <span className="text-sm font-medium text-navy">Bekijk de overlastkaart</span><ArrowRight size={16} className="text-navy/60" />
            </Link>
            <Link to="/" className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3">
              <span className="text-sm font-medium text-navy">Stel een vraag aan de assistent</span><ArrowRight size={16} className="text-navy/60" />
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Step({ n, Icon, title, desc }: { n: number; Icon: any; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-navy text-white grid place-items-center text-sm font-mono">{n}</div>
      </div>
      <div className="flex-1 pb-1">
        <div className="flex items-center gap-2 text-navy"><Icon size={16} /><span className="font-medium text-sm">{title}</span></div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </li>
  );
}

function SelfSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step n={1} Icon={Mail} title="Bevestigingsmail" desc="Je ontvangt binnen enkele minuten een bevestiging op je e-mailadres." />
      <Step n={2} Icon={Download} title="Instructie-PDF" desc="In de mail zit een PDF met stap-voor-stap instructies en voorbeeldbrieven." />
      <Step n={3} Icon={FileText} title="Zelf indienen" desc="Stuur de brieven naar BAS en Schiphol volgens de instructies. Wij volgen het op afstand." />
    </ol>
  );
}
function ManagedSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step n={1} Icon={Clock} title="Wachten op betaling" desc="Je ontvangt een betaallink per e-mail (servicekosten €100). Na betaling start ons team direct." />
      <Step n={2} Icon={FileText} title="Wij dienen in" desc="Ons team verzorgt alle correspondentie met BAS, ILT en Schiphol namens jou." />
      <Step n={3} Icon={Mail} title="Updates per e-mail" desc="Je krijgt updates bij elke stap. Gemiddelde doorlooptijd: 4–8 weken." />
    </ol>
  );
}
function LegalSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step n={1} Icon={Scale} title="Intake door jurist" desc="Een gespecialiseerde advocaat neemt binnen 3 werkdagen contact op." />
      <Step n={2} Icon={Sparkles} title="Beoordeling" desc="Je dossier wordt beoordeeld op kansrijkheid. Servicekosten €450 voor het volledige juridische traject." />
      <Step n={3} Icon={FileText} title="Vervolgstappen" desc="Bij voldoende basis wordt een procedure voorgesteld — altijd in overleg met jou." />
    </ol>
  );
}
