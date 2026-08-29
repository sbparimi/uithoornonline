import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/over-de-service")({
  component: AboutService,
  head: () => ({
    meta: [
      { title: "Over de service — uithoorn.online" },
      { name: "description", content: "Wat Uithoorn Online wel en niet vaststelt." },
    ],
  }),
});

function AboutService() {
  return <AppShell>
    <section className="bg-navy text-white px-5 pt-6 pb-8">
      <h1 className="text-2xl font-serif">Over de service</h1>
      <p className="mt-2 text-sm text-white/70">Informatie, broncontrole en dossierondersteuning rond Schiphol-geluidsoverlast.</p>
    </section>
    <section className="px-5 -mt-4 pb-12 space-y-4">
      <article className="rounded-xl bg-white border border-border p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy">Wat we doen</h2>
        <p className="mt-2 text-sm text-muted-foreground">Uithoorn Online helpt bewoners informatie te vinden, officiële gegevens over een adres te controleren waar daarvoor een officiële bron beschikbaar is, bewonersmeldingen te registreren en informatie voor een persoonlijk dossier te ordenen.</p>
      </article>
      <article className="rounded-xl bg-white border border-border p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy">Wat we niet doen</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>We zijn geen overheidsinstantie.</li>
          <li>We bepalen niet of iemand juridisch recht heeft op compensatie.</li>
          <li>We bepalen geen compensatiebedrag.</li>
          <li>Een opgeslagen dossier is geen officiële aanvraag of goedkeuring.</li>
          <li>Een door een bewoner opgegeven vluchtnummer of geluidsniveau wordt niet door ons als oorzaak of officiële meting vastgesteld.</li>
        </ul>
      </article>
      <article className="rounded-xl bg-cream border border-border p-5">
        <h2 className="font-serif text-lg text-navy">Bronnen en onzekerheid</h2>
        <p className="mt-2 text-sm text-muted-foreground">Waar mogelijk tonen we de bron waarop een antwoord is gebaseerd. Als een feit niet voldoende kan worden onderbouwd of een officiële bron niet beschikbaar is, hoort de service dat niet als vaststaand feit te presenteren.</p>
      </article>
      <article className="rounded-xl bg-white border border-border p-5 shadow-sm">
        <h2 className="font-serif text-lg text-navy">Officiële beslissing</h2>
        <p className="mt-2 text-sm text-muted-foreground">Rechten, compensatie en formele uitkomsten worden bepaald door de daarvoor bevoegde instantie. Gebruik de officiële routes die bij je situatie horen voor een formele melding, aanvraag of beslissing.</p>
      </article>
    </section>
  </AppShell>;
}
