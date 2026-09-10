import type { Metadata } from 'next';
import { ArrowRight, Check, MessageCircle, Sparkles } from 'lucide-react';
import RequestForm from './RequestForm';

export const metadata: Metadata = {
  title: 'Hulp aanvragen — Uithoorn.online',
  description: 'Vertel wat je nodig hebt en kom in contact met passende lokale aanbieders in Uithoorn en De Kwakel.',
};

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;

  return (
    <main className="uo-easy-home uo-request-page">
      <header className="easy-header">
        <a href="/" className="easy-brand" aria-label="Uithoorn.online home">
          <span className="easy-brand-mark"><img src="/icon.svg" alt="" /></span>
          <span>Uithoorn<span>.online</span></span>
        </a>

        <nav className="easy-nav" aria-label="Hoofdnavigatie">
          <a href="/businesses">Diensten</a>
          <a className="active" href="/request">Hulp aanvragen</a>
        </nav>

        <div className="easy-header-actions">
          <a className="easy-provider-link" href="/signup/account?role=provider">Voor bedrijven</a>
          <a className="easy-primary-small" href="/request">Hulp aanvragen</a>
        </div>
      </header>

      <section className="request-hero">
        <div className="request-hero-inner">
          <div className="request-intro">
            <div className="easy-eyebrow"><span />Lokale hulp</div>
            <h1>Vertel wat je<br /><em>nodig hebt.</em></h1>
            <p>Geen idee wie je moet bellen? Beschrijf je klus. Wij helpen je de juiste lokale aanbieder te vinden.</p>

            <div className="request-trust">
              <div><span><Check /></span><div><strong>Lokaal</strong><small>Uithoorn &amp; De Kwakel</small></div></div>
              <div><span><Check /></span><div><strong>Passend</strong><small>Alleen relevante aanbieders</small></div></div>
              <div><span><Check /></span><div><strong>Veilig</strong><small>Je gegevens blijven beschermd</small></div></div>
            </div>

            <a className="request-back-link" href="/businesses"><ArrowRight /> Liever zelf een bedrijf zoeken</a>
          </div>

          <div className="request-form-shell">
            <div className="request-form-head">
              <div className="request-form-icon"><Sparkles /></div>
              <div>
                <span className="easy-label">HULP AANVRAGEN</span>
                <h2>Wat moet er geregeld worden?</h2>
              </div>
            </div>
            <p className="request-form-note"><MessageCircle /> Vul je vraag in. Je kunt later altijd nog contact opnemen.</p>
            <RequestForm initialCategory={params.category ?? ''} />
          </div>
        </div>
      </section>

      <footer className="easy-footer">
        <div className="easy-footer-brand">
          <span className="easy-brand-mark"><img src="/icon.svg" alt="" /></span>
          <strong>Uithoorn<span>.online</span></strong>
        </div>
        <div className="easy-footer-links">
          <a href="/businesses">Diensten</a>
          <a href="/request">Hulp aanvragen</a>
          <a href="/signup/account?role=provider">Voor bedrijven</a>
        </div>
        <small>Uithoorn &amp; De Kwakel · © 2026</small>
      </footer>
    </main>
  );
}
