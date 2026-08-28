import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Scale } from "lucide-react";

export const Route = createFileRoute("/voorwaarden")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Algemene voorwaarden — uithoorn.online" },
      {
        name: "description",
        content:
          "Servicekosten, herroepingsrecht, en wat uithoorn.online wel en niet voor je doet bij een claim rond Schiphol-geluid.",
      },
      { property: "og:title", content: "Algemene voorwaarden — uithoorn.online" },
      {
        property: "og:description",
        content: "Wat je koopt, wat het kost, en je 14 dagen herroepingsrecht bij uithoorn.online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function TermsPage() {
  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-red font-medium">
          <Scale size={14} /> Voorwaarden
        </div>
        <h1 className="mt-2 text-2xl font-serif">Algemene voorwaarden</h1>
        <p className="mt-2 text-sm text-white/70">
          In gewone taal: wat je krijgt, wat het kost en wanneer je kosteloos kunt annuleren.
        </p>
      </section>

      <section className="px-5 -mt-5 pb-10 space-y-4">
        <Card title="Wat wij zijn — en niet zijn">
          <p>
            uithoorn.online is een informatie- en dossierdienst voor bewoners rond Schiphol.
            Wij zijn <b>geen overheidsinstantie</b> en <b>geen advocatenkantoor</b>. Wij
            beslissen niet over vergoedingen; dat doen BAS, Schiphol, het ministerie van I&amp;W
            of de rechter. Wij geven geen juridisch advies; het pakket &ldquo;Juridisch traject&rdquo;
            is een <b>juridische intake en beoordeling van vervolgstappen</b>.
          </p>
        </Card>

        <Card title="Servicekosten (incl. btw)">
          <ul className="list-disc pl-4 space-y-1">
            <li><b>Zelf doen — € 0</b>: je krijgt je dossieroverzicht en de officiële links om zelf in te dienen.</li>
            <li><b>Wij regelen het — € 100</b>: wij bereiden je aanvraag voor en dienen namens jou in.</li>
            <li><b>Juridisch traject — € 450</b>: juridische intake, dossierbeoordeling en advies over vervolgstappen.</li>
          </ul>
          <p className="mt-2">
            Genoemde bedragen zijn <b>servicekosten inclusief btw</b> en staan los van een
            eventuele vergoeding. Wij beloven nooit een uitkomst of bedrag.
          </p>
        </Card>

        <Card title="Betaling">
          <p>
            Er wordt in de app <b>nog geen betaling afgeschreven</b>. Je aanvraag wordt eerst
            opgeslagen; daarna ontvang je een betaalverzoek. De behandeling start pas na
            betaling. Betaal nooit op basis van een bericht dat niet van
            uithoorn.online komt.
          </p>
        </Card>

        <Card title="Herroepingsrecht (14 dagen)">
          <p>
            Als consument kun je een betaalde dienst binnen <b>14 dagen</b> zonder opgaaf van
            reden annuleren en krijg je je geld terug. Wil je dat wij eerder starten, dan vraag
            je daar uitdrukkelijk om; heb je bij volledige levering binnen die termijn
            ingestemd, dan vervalt het herroepingsrecht. Annuleren kan via
            <a className="underline" href="mailto:support@uithoorn.online?subject=Herroeping"> support@uithoorn.online</a>.
          </p>
        </Card>

        <Card title="Juistheid van informatie">
          <p>
            Antwoorden van de assistent zijn gebaseerd op opgehaalde officiële bronnen met
            tijdstempel en bronlink. Ontbreekt een bron, dan doet het systeem geen uitspraak.
            Kaart- en adresgegevens komen van PDOK/Kadaster; is die dienst onbereikbaar, dan
            tonen wij &ldquo;niet beschikbaar&rdquo; en nooit een gok.
          </p>
        </Card>

        <Card title="Klachten">
          <p>
            Klachten behandelen wij binnen 14 dagen. Kom je er met ons niet uit, dan kun je
            terecht bij de bevoegde Nederlandse rechter; Nederlands recht is van toepassing.
          </p>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          Zie ook onze <Link to="/privacy" className="underline">privacyverklaring</Link>.
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
