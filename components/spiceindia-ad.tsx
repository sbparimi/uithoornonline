import { MessageCircle } from 'lucide-react';

export function SpiceIndiaAd() {
  return (
    <aside className="spiceindia-ad" aria-label="SpiceIndia advertentie">
      <div className="spiceindia-ad-pulse" aria-hidden="true" />
      <div className="spiceindia-ad-content">
        <span className="spiceindia-ad-kicker">LOKAAL · UITHOORN</span>
        <h2>SpiceIndia</h2>
        <p>Vers Indiaas eten, thuisgemaakt in Uithoorn.</p>
        <div className="spiceindia-ad-actions">
          <a href="https://www.spiceindia.nl/" target="_blank" rel="noreferrer">Website</a>
          <a className="spiceindia-ad-whatsapp" href="https://wa.me/31645480446" target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
        </div>
      </div>
      <span className="spiceindia-ad-badge">SpiceIndia.nl</span>
    </aside>
  );
}
