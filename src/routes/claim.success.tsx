import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import {
  CheckCircle2,
  FileText,
  Mail,
  Scale,
  Sparkles,
  Download,
  ArrowRight,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { createDossierExportPayment, getPaymentStatus } from "@/lib/payments.functions";
import { toast } from "sonner";

const searchSchema = z.object({
  id: z.string().uuid().optional(),
  pkg: z.enum(["self", "managed", "legal"]).optional(),
  export: z.string().uuid().optional(),
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

const officialLinks = [
  { href: "https://meldingen-bezoekbas.nl/", label: "Open BAS-meldformulier" },
  { href: "https://www.schiphol.nl/nl/schiphol-als-buur/", label: "Schiphol als buur" },
];

function ClaimSuccess() {
  const { id, pkg, export: exportId } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
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
            <h1 className="text-2xl font-serif">Claim ingediend</h1>
            <p className="text-sm text-white/70">We hebben je aanvraag ontvangen</p>
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
              Compensatiebedrag wordt officieel vastgesteld door BAS / Schiphol / ministerie van
              I&amp;W. De app maakt geen schatting.
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
            <p className="text-sm text-muted-foreground mt-3">Geen claimgegevens gevonden.</p>
          )}
        </div>

        <DossierExport claim={claim} exportId={exportId} />

        <NextActions activePkg={activePkg} />
      </section>
    </AppShell>
  );
}

function DossierExport({ claim, exportId }: { claim: ClaimRow | null; exportId?: string }) {
  const startExportPayment = useServerFn(createDossierExportPayment);
  const readStatus = useServerFn(getPaymentStatus);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!exportId || paid) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await readStatus({ data: { kind: "dossier_export", id: exportId } });
        if (cancelled) return;
        if (res.paid) {
          setPaid(true);
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled && attempts < 10) setTimeout(tick, 2500);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [exportId, paid, readStatus]);

  const pay = async () => {
    setBusy(true);
    try {
      const res = await startExportPayment({
        data: { claimId: claim?.id, origin: window.location.origin },
      });
      if (!res.ok) {
        toast.error(
          res.error === "Payment provider not configured yet"
            ? "Betalen is nog niet geactiveerd. Voeg de Mollie API-sleutel toe in de projectinstellingen."
            : res.error,
        );
        return;
      }
      window.location.href = res.checkoutUrl;
    } catch {
      toast.error("Betaling kon niet worden gestart.");
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!claim) return;
    const lines = [
      "DOSSIER — uithoorn.online",
      `Referentie: ${claim.id.slice(0, 8).toUpperCase()}`,
      `Aangemaakt: ${new Date(claim.created_at).toLocaleString("nl-NL")}`,
      "",
      `Naam: ${claim.name}`,
      `Adres: ${claim.address}, ${claim.postcode}`,
      `Jaren met overlast: ${claim.years_selected.join(", ")}`,
      `Pakket: ${claim.package}`,
      "",
      "De hoogte van een eventuele vergoeding wordt vastgesteld door BAS / Schiphol /",
      "ministerie van I&W. Deze app doet geen uitspraak over bedragen.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossier-${claim.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-white border border-border p-5 shadow-sm">
      <h3 className="font-serif text-lg text-navy">Dossier-export</h3>
      <p className="text-xs text-muted-foreground mt-1">
        {paid
          ? "Betaling ontvangen. Je kunt je dossier nu downloaden."
          : "Download je volledige dossier als bestand voor eigen gebruik of om mee te sturen met een officiële melding. Eenmalig €5."}
      </p>
      {paid ? (
        <button
          onClick={download}
          disabled={!claim}
          className="mt-3 w-full rounded-xl bg-navy py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          Dossier downloaden
        </button>
      ) : (
        <button
          onClick={pay}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-red py-3 text-sm font-medium text-red-foreground disabled:opacity-50"
        >
          {busy ? "Bezig…" : "Betaal €5 en download dossier"}
        </button>
      )}
    </div>
  );
}

function NextActions({ activePkg }: { activePkg?: "self" | "managed" | "legal" }) {
  return (
    <div className="rounded-xl bg-cream border border-border p-5">
      <h3 className="font-serif text-navy">Direct verder</h3>
      <p className="text-xs text-muted-foreground mt-1">
        {activePkg === "self"
          ? "Gebruik de officiële BAS-route om je melding of vraag zelf door te zetten."
          : "Je dossier is opgeslagen; voeg extra meldingen toe of raadpleeg de officiële informatie terwijl je aanvraag wordt opgevolgd."}
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
        <Link
          to="/log"
          className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3"
        >
          <span className="text-sm font-medium text-navy">Overlast loggen</span>
          <ArrowRight size={16} className="text-navy/60" />
        </Link>
        <Link
          to="/"
          className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3"
        >
          <span className="text-sm font-medium text-navy">Vraag aan de assistent</span>
          <ArrowRight size={16} className="text-navy/60" />
        </Link>
      </div>
    </div>
  );
}

function Step({
  n,
  Icon,
  title,
  desc,
}: {
  n: number;
  Icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-navy text-white grid place-items-center text-sm font-mono">
          {n}
        </div>
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
      <Step
        n={1}
        Icon={CheckCircle2}
        title="Dossier opgeslagen"
        desc="Je claimgegevens en gekozen jaren staan nu in je account."
      />
      <Step
        n={2}
        Icon={FileText}
        title="Officiële route openen"
        desc="Gebruik het BAS-meldformulier hieronder voor een melding of vraag bij het Bewoners Aanspreekpunt Schiphol."
      />
      <Step
        n={3}
        Icon={Download}
        title="Bewijs blijven verzamelen"
        desc="Log nieuwe overlastmomenten in de app zodat je dossier actueel blijft."
      />
    </ol>
  );
}
function ManagedSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step
        n={1}
        Icon={Clock}
        title="Dossier opgeslagen"
        desc="Je aanvraag voor behandeling namens jou is opgeslagen. No cure no pay: 15% van een toegekende vergoeding, maximaal €300."
      />
      <Step
        n={2}
        Icon={FileText}
        title="Voorbereiding"
        desc="Bewaar aanvullende meldingen en documenten zodat de behandeling op basis van jouw dossier kan plaatsvinden."
      />
      <Step
        n={3}
        Icon={Mail}
        title="Volgende actie"
        desc="Gebruik hieronder de officiële BAS-link voor actuele informatie of om zelf aanvullend te melden."
      />
    </ol>
  );
}
function LegalSteps() {
  return (
    <ol className="mt-4 space-y-4">
      <Step
        n={1}
        Icon={Scale}
        title="Dossier opgeslagen"
        desc="Je aanvraag is opgeslagen. De doorverwijzing naar een gespecialiseerde jurist is gratis."
      />
      <Step
        n={2}
        Icon={Sparkles}
        title="Dossier aanvullen"
        desc="Voeg relevante overlastlogs en documenten toe voordat juridische beoordeling plaatsvindt."
      />
      <Step
        n={3}
        Icon={FileText}
        title="Officiële bronnen raadplegen"
        desc="Gebruik de officiële links hieronder voor de actuele informatie waarop vervolgstappen moeten worden gebaseerd."
      />
    </ol>
  );
}
