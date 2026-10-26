import { MessageCircle } from 'lucide-react';
import { formatDutchMobile, lp, WHATSAPP_NUMBER, whatsappHref, type Locale } from '../lib/i18n/config';
import { getDictionary } from '../lib/i18n/dictionaries';

export function SiteFooter({ lang }: { lang: Locale }) {
  const t = getDictionary(lang);
  const f = t.footer;
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <a href={lp(lang, '/')} className="site-brand" aria-label={t.common.homeAria}>
            <img src="/icon.svg" alt="" width={34} height={34} />
            <span>Uithoorn<span>.online</span></span>
          </a>
          <p>{f.tagline}</p>
        </div>
        <div className="site-footer-col">
          <h2>{f.discover}</h2>
          <a href={lp(lang, '/businesses')}>{f.businesses}</a>
          <a href={lp(lang, '/request')}>{f.request}</a>
          <a href={lp(lang, '/deals')}>{f.deals}</a>
          <a href={lp(lang, '/jobs')}>{f.jobs}</a>
          <a href={lp(lang, '/food')}>{f.food}</a>
        </div>
        <div className="site-footer-col">
          <h2>{f.entrepreneurs}</h2>
          <a href={lp(lang, '/voor-bedrijven')}>{f.forBusinesses}</a>
          <a href={lp(lang, '/voor-bedrijven#prijzen')}>{f.pricing}</a>
          <a href={lp(lang, '/signup/account?role=provider')}>{f.listBusiness}</a>
          <a href={lp(lang, '/provider')}>{f.dashboard}</a>
          <a href={lp(lang, '/signup')}>{f.share}</a>
        </div>
        <div className="site-footer-col">
          <h2>{f.contact}</h2>
          <a href={whatsappHref(f.whatsappMessage)} target="_blank" rel="noopener noreferrer" className="site-footer-whatsapp"><MessageCircle aria-hidden="true" /> {f.whatsapp}: {formatDutchMobile(WHATSAPP_NUMBER)}</a>
          <span>{t.common.area}</span>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© 2026 Uithoorn.online · {f.rights}</span>
        <nav aria-label={f.contact}>
          <a href={lp(lang, '/privacy')}>{f.privacy}</a>
          <a href={lp(lang, '/cookies')}>{f.cookies}</a>
        </nav>
      </div>
    </footer>
  );
}
