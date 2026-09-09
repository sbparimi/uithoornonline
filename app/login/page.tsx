'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') || '/account' : '/account';
  const callbackError = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('error') : null;
  async function submit(e: FormEvent) {
    e.preventDefault(); if (loading) return; setError(''); setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next.startsWith('/') && !next.startsWith('//') ? next : '/account')}` } });
      if (authError) setError(authError.message || 'De inloglink kon niet worden verstuurd.'); else setSent(true);
    } catch {
      setError('Er ging iets mis met de verbinding. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }
  return <main className="platform-shell"><div className="platform-card"><a className="uo-brand" href="/"><span className="uo-brand-mark">u</span><span>ithoorn<span>.online</span></span></a><span className="uo-kicker">Inloggen</span><h1>Ga naar je account.</h1><p>We sturen een veilige inloglink naar je e-mailadres.</p>{callbackError && !sent && <p className="platform-error" role="alert">De inloglink is verlopen of kon niet worden verwerkt. Vraag hieronder een nieuwe link aan.</p>}{sent ? <div className="platform-success"><Check /><div><strong>Check je e-mail.</strong><p>Open de link om in te loggen bij Uithoorn.online.</p></div></div> : <form className="platform-form" onSubmit={submit}><label>E-mailadres<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jij@example.nl" /></label>{error && <p className="platform-error" role="alert">{error}</p>}<button className="primary" disabled={loading} type="submit">{loading ? 'Link versturen…' : 'Inloglink sturen'} <ArrowRight /></button></form>}<a className="platform-secondary-link" href="/signup">Nog geen account? Registreren</a></div></main>;
}
