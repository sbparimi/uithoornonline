import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy & AVG — uithoorn.online" },
      {
        name: "description",
        content:
          "Welke gegevens uithoorn.online verwerkt, op welke grondslag, hoe lang wij ze bewaren en hoe je jouw AVG-rechten uitoefent.",
      },
      { property: "og:title", content: "Privacy & AVG — uithoorn.online" },
      {
        property: "og:description",
        content: "Transparant overzicht van gegevensverwerking en jouw AVG-rechten bij uithoorn.online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PrivacyPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const deleteLogs = async () => {
    if (!user) return;
    if (!confirm("Al je geluidsmeldingen definitief verwijderen?")) return;
    setBusy(true);
    const { error } = await supabase.from("noise_logs").delete().eq("user_id", user.id);
    setBusy(false);
    if (error) toast.error("Verwijderen mislukt");
    else toast.success("Je meldingen zijn verwijderd");
  };

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-red font-medium">
          <ShieldCheck size={14} /> AVG / GDPR
        </div>
        <h1 className="mt-2 text-2xl font-serif">Privacyverklaring</h1>
        <p className="mt-2 text-sm text-white/70">
          Laatst bijgewerkt: augustus 2026. Deze verklaring beschrijft precies wat wij van je
          verwerken — niet meer en niet minder.
        </p>
      </section>

      <section className="px-5 -mt-5 pb-10 space-y-4">
        <Card title="Welke gegevens wij verwerken">
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Account</b>: e-mailadres (nodig om je dossier te bewaren).</li>
            <li><b>Geluidsmeldingen</b>: tijdstip, ervaren dB-niveau, optioneel vluchtnummer en je locatie (alleen als je toestemming geeft in je browser).</li>
            <li><b>Claimdossier</b>: naam, adres, postcode, gekozen jaren en pakket.</li>
            <li><b>Chatgesprek</b>: je vraag en het antwoord van de assistent, met bronnen. Herkenbare e-mailadressen en telefoonnummers worden vóór opslag gemaskeerd.</li>
            <li><b>Adrescontrole</b>: postcode en huisnummer worden opgevraagd bij PDOK/Kadaster (BAG) en de LIB-kaartlagen. Wij slaan het resultaat niet apart op.</li>
          </ul>
        </Card>

        <Card title="Grondslag en doel">
          <p>
            Wij verwerken je gegevens op basis van <b>toestemming</b> (chat, locatie) en
            <b> uitvoering van de overeenkomst</b> (claimdossier). Doel: je helpen bij het
            onderbouwen en indienen van een melding of aanvraag rond Schiphol-geluid.
            Wij verkopen geen gegevens en gebruiken ze niet voor advertenties.
          </p>
        </Card>

        <Card title="Bewaartermijn">
          <ul className="list-disc pl-4 space-y-1">
            <li>Geluidsmeldingen: tot je ze zelf verwijdert.</li>
            <li>Claimdossiers: 7 jaar (administratieplicht) of eerder op verzoek, tenzij een lopende procedure dat verhindert.</li>
            <li>Chatlogs (gemaskeerd): 12 maanden, voor kwaliteits- en juistheidscontrole zoals de EU AI-verordening vraagt.</li>
          </ul>
        </Card>

        <Card title="Jouw rechten">
          <p>
            Je hebt recht op inzage, correctie, verwijdering, beperking, bezwaar en
            dataportabiliteit. Je kunt ook een klacht indienen bij de Autoriteit
            Persoonsgegevens (autoriteitpersoonsgegevens.nl).
          </p>
          <div className="mt-3 space-y-2">
            {user ? (
              <button
                onClick={deleteLogs}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red/40 bg-red/5 py-3 text-sm text-red font-medium disabled:opacity-50"
              >
                <Trash2 size={15} /> Verwijder al mijn geluidsmeldingen
              </button>
            ) : (
              <Link
                to="/auth"
                search={{ next: "/privacy" }}
                className="block rounded-xl border border-border py-3 text-center text-sm text-navy"
              >
                Log in om je gegevens te beheren
              </Link>
            )}
            <a
              href="mailto:privacy@uithoorn.online?subject=AVG-verzoek"
              className="block rounded-xl border border-border py-3 text-center text-sm text-navy"
            >
              Verzoek tot inzage of verwijdering van mijn dossier
            </a>
          </div>
        </Card>

        <Card title="AI-transparantie (EU AI-verordening, art. 50)">
          <p>
            De assistent op deze site is een <b>AI-systeem</b>, geen mens. Antwoorden worden
            uitsluitend gegeven op basis van opgehaalde officiële bronnen; ontbreekt een bron,
            dan weigert het systeem een uitspraak te doen. Uitspraken zijn <b>geen juridisch
            advies</b> en geen besluit van een overheidsinstantie.
          </p>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          Zie ook onze <Link to="/voorwaarden" className="underline">algemene voorwaarden</Link>.
        </p>
      </section>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-border p-5 shadow-sm">
      <h2 className="font-serif text-lg text-navy">{title}</h2>
      <div className="mt-2 text-sm text-muted-foreground space-y-2">{children}</div>
    </div>
  );
}
