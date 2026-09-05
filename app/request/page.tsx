import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import RequestForm from './RequestForm';

export const metadata: Metadata = {
  title: 'Lokale aanvraag — Uithoorn.online',
  description: 'Plaats een lokale aanvraag en bereik relevante ondernemers in Uithoorn en De Kwakel.',
};

export default function RequestPage() {
  return (
    <main>
      <header className="nav-wrap">
        <nav className="nav shell">
          <a className="brand" href="/">
            <span className="brand-mark">U</span>
            <span>uithoorn<span>.online</span></span>
          </a>
          <a className="nav-cta" href="/businesses">Ontdek bedrijven</a>
        </nav>
      </header>
      <section className="request-page">
        <div className="shell request-layout">
          <div>
            <span className="kicker">Lokale aanvraag</span>
            <h1 className="directory-title">Vertel wat je nodig hebt.</h1>
            <p className="directory-intro">Beschrijf je vraag. Het platform is ontworpen om lokale vraag te koppelen aan relevant lokaal aanbod.</p>
            <div className="request-benefits">
              <div><Check /> Eén duidelijke aanvraag</div>
              <div><Check /> Relevant voor lokale ondernemers</div>
              <div><Check /> Geen eindeloze zoektochten</div>
            </div>
          </div>
          <RequestForm />
        </div>
      </section>
      <footer><div className="shell copyright">© 2026 Uithoorn.online · Uithoorn & De Kwakel</div></footer>
    </main>
  );
}
