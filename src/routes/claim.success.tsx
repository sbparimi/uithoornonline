import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CheckCircle2, FileText, Mail, Scale, ArrowRight, Clock, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/claim/success")({
  component: ClaimSuccess,
  head: () => ({
    meta: [
      { title: 'Dossier opgeslagen — uithoorn.online' },
      { name: "description", content: 'Je dossier is opgeslagen. Bekijk de concrete vervolgstappen en officiële instanties.' },
      { property: "og:title", content: 'Dossier opgeslagen — uithoorn.online' },
      { property: "og:description", content: 'Je dossier is opgeslagen. Bekijk de concrete vervolgstappen en officiële instanties.' },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

const officialLinks = [
  { href: "https://meldingen-bezoekbas.nl/", label: "Open BAS-meldformulier" },
  { href: "https://www.schiphol.nl/nl/schiphol-als-buur/", label: "Schiphol als buur" },
];

function ClaimSuccess() {
  const { user, loading: authLoading } = useAuth();
  const { id, pkg } = Route.useSearch();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth", search: { next: "/claim" } });
      return;
    }
    (async () => {
      let q = supabase
        .from("claims")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
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
            <h1 className="text-2xl font-serif">Dossier opgeslagen</h1>
            <p className="text-sm text-white/70">Je gegevens zijn opgeslagen in Uithoorn Online</p>
          </div>
        </div>
        {claim && (
          <div className="mt-5 rounded-xl bg-white/10 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Referentie</span>
              <span className="font-mono">{claim.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-white/60">Jaren</span>
              <span>{claim.years_selected.join(", ")}</span>
            </div>
            <div className="mt-2 text-[11px] text-white/60">
              Dit is een intern dossier. Het betekent niet dat een officiële compensatieaanvraag is ingediend,
              dat je recht hebt op compensatie of dat een bevoegde instantie een beslissing heeft genomen.
            </div>
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
            <p className="text-sm text-muted-foreground mt-3">Geen dossiergegevens gevonden.</p>
          )}
        </div>

        <NextActions activePkg={activePkg} />
      </section>
    </AppShell>
  );
}

function NextActions({ activePkg }: { activePkg?: "self" | "managed" | "legal" }) {
  return (
    <div className="rounded-xl bg-cream border border-border p-5">
      <h3 className="font-serif text-navy">Officiële vervolgstappen</h3>
      <p className="text-xs text-muted-foreground mt-1">
        Uithoorn Online helpt informatie en bewijs te ordenen. Officiële instanties bepalen rechten,
        compensatie en formele uitkomsten.
      </p>
      <div className="mt-3 grid gap-2">
        {officialLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3"
          >
            <span className="text-sm font-medium text-navy">{link.label}</span>
            <ArrowRight size={16} className="text-navy/60" />
          </a>
        ))}
        <Link to="/log" className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3">
          <span className="text-sm font-medium text-navy">Overlast loggen</span>
          <ArrowRight size={16} className="text-navy/60" />
        </Link>
        <Link to="/" className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3">
          <span className="text-sm font-medium text-navy">Vraag aan de assistent</span>
          <ArrowRight size={16} className="text-navy/60" />
        </Link>
      </div>
    </div>
  );
}

function Step({ n, Icon, title, desc }: { n: number; Icon: LucideIcon; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-navy text-white grid place-items-center text-sm font-mono">{n}</div>
      </div>
      <div className="flex-1 pb-1">
        <div className="flex items-center gap-2 text-navy">
          <Icon size={16} />
          <span className="font-medium text-sm">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </li>
  );
}

function SelfSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step n={1} Icon={CheckCircle2} title="Dossier opgeslagen" desc="Je gegevens en gekozen jaren staan in je Uithoorn Online-dossier." />
      <Step n={2} Icon={FileText} title="Officiële route controleren" desc="Gebruik de officiële BAS-route voor een melding of vraag." />
      <Step n={3} Icon={Clock} title="Bewijs blijven verzamelen" desc="Log nieuwe overlastmomenten en bewaar relevante documenten." />
    </ol>
  );
}

function ManagedSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step n={1} Icon={Clock} title="Dossier opgeslagen" desc="Je aanvraag voor dossierbegeleiding is opgeslagen." />
      <Step n={2} Icon={FileText} title="Dossier voorbereiden" desc="Aanvullende meldingen en documenten kunnen worden toegevoegd." />
      <Step n={3} Icon={Mail} title="Officiële vervolgstap" desc="Een officiële aanvraag is pas ingediend wanneer deze daadwerkelijk bij de bevoegde instantie is ingediend." />
    </ol>
  );
}

function LegalSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step n={1} Icon={Scale} title="Dossier opgeslagen" desc="Je aanvraag voor de gekozen service is opgeslagen." />
      <Step n={2} Icon={FileText} title="Dossier aanvullen" desc="Voeg relevante overlastlogs en documenten toe." />
      <Step n={3} Icon={Scale} title="Bevoegde beoordeling" desc="Een juridisch oordeel of formele compensatiebeslissing komt uitsluitend van de daarvoor bevoegde partij." />
    </ol>
  );
}
