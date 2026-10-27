import { AlertTriangle } from 'lucide-react';
import { SiteHeader } from './site-header';
import { SiteFooter } from './site-footer';
import { dateLocale, lp, type Locale } from '../lib/i18n/config';
import { getBackendDict } from '../lib/i18n/backend';
import { getLegalDoc, LEGAL_LAST_UPDATED, type LegalKind } from '../lib/legal/content';

const related: Record<LegalKind, LegalKind[]> = { privacy: ['cookies', 'terms'], cookies: ['privacy', 'terms'], terms: ['privacy', 'cookies'] };
const paths: Record<LegalKind, string> = { privacy: '/privacy', cookies: '/cookies', terms: '/voorwaarden' };

/** Renders one of the legal documents (privacy, cookies, terms) with the DRAFT banner. */
export function LegalDocPage({ kind, lang }: { kind: LegalKind; lang: Locale }) {
  const doc = getLegalDoc(kind, lang);
  const b = getBackendDict(lang);
  const updated = new Date(`${LEGAL_LAST_UPDATED}T12:00:00Z`).toLocaleDateString(dateLocale(lang), { day: 'numeric', month: 'long', year: 'numeric' });
  // Highlight owner placeholders like [Naam … – in te vullen] so they cannot be missed.
  const render = (text: string) => text.split(/(\[[^\]]+\])/g).map((part, i) => (part.startsWith('[') ? <mark key={i} className="legal-placeholder">{part}</mark> : part));
  return <div className="ds-page">
    <SiteHeader />
    <main id="main" className="ds-simple">
      <article className="ds-container legal">
        <p className="ds-kicker">Uithoorn.online</p>
        <h1>{doc.title}</h1>
        <div className="legal-draft" role="note"><AlertTriangle aria-hidden="true" /><div><strong>{b.legal.draft}</strong></div></div>
        <p className="legal-updated">{b.legal.lastUpdated}: {updated}</p>
        <p className="ds-lead">{render(doc.intro)}</p>
        {doc.sections.map((s) => <section key={s.heading}><h2>{s.heading}</h2>{s.body.map((para) => <p key={para}>{render(para)}</p>)}</section>)}
        <p className="legal-updated">{related[kind].map((k, i) => <span key={k}>{i > 0 && ' · '}<a href={lp(lang, paths[k])}>{getLegalDoc(k, lang).title}</a></span>)} · <a href={lp(lang, '/contact')}>Contact</a></p>
      </article>
    </main>
    <SiteFooter lang={lang} />
  </div>;
}
