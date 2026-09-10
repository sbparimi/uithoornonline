import type { Metadata } from 'next';
import ContributionHub from '../../components/contribution-hub';

export const metadata: Metadata = { title: 'Deel wat je weet — Uithoorn.online', description: 'Voeg een lokaal bedrijf of handige tip toe aan Uithoorn.online.' };

type Kind = 'business' | 'tip';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const params = await searchParams;
  const initialKind: Kind = params.kind === 'tip' ? 'tip' : 'business';
  return <main className="contribution-page"><header className="discovery-header"><a href="/" className="discovery-brand"><span className="discovery-brand-mark"><img src="/icon.svg" alt="" /></span>Uithoorn<span>Online</span></a><nav><a href="/businesses">Bedrijven</a><a href="/deals">Aanbiedingen</a><a className="active" href="/signup">Delen</a></nav><a className="discovery-header-cta" href="/signup/account">Account aanmaken</a></header><section className="contribution-hero"><span className="uo-kicker">Deel wat je weet</span><h1>Maak Uithoorn <em>completer.</em></h1><p>Ken je een goed lokaal bedrijf of een handige tip? Deel het. We controleren iedere bijdrage voordat deze openbaar wordt.</p></section><section className="contribution-content"><ContributionHub initialKind={initialKind} /><div className="contribution-account-note">Wil je als klant of aanbieder een account gebruiken? <a href="/signup/account">Maak een account aan <span>→</span></a></div></section></main>;
}
