'use client';

// Last-resort error screen (the root layout itself failed). Self-contained: no app CSS or context.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const en = typeof window !== 'undefined' && /^\/en(\/|$)/.test(window.location.pathname);
  const t = en
    ? { title: 'Something went wrong', text: 'Uithoorn.online could not load this page. Please try again in a moment.', retry: 'Try again', home: 'Homepage', href: '/en' }
    : { title: 'Er ging iets mis', text: 'Uithoorn.online kon deze pagina niet laden. Probeer het zo nog eens.', retry: 'Opnieuw proberen', home: 'Homepage', href: '/' };
  return <html lang={en ? 'en' : 'nl-NL'}>
    <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', background: '#f7f2ea', color: '#1d1b1d', minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <main style={{ maxWidth: 460, textAlign: 'center' }} role="alert">
        <title>{`${t.title} — Uithoorn.online`}</title>
        <meta name="robots" content="noindex" />
        <p style={{ fontWeight: 700, fontSize: 20, margin: '0 0 8px' }}>Uithoorn.online</p>
        <h1 style={{ fontSize: 30, margin: '0 0 12px' }}>{t.title}</h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: '#595a5a' }}>{t.text}</p>
        <p style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <button type="button" onClick={() => reset()} style={{ font: 'inherit', fontWeight: 700, padding: '12px 20px', borderRadius: 999, border: 0, background: '#1d1b1d', color: '#fff', cursor: 'pointer' }}>{t.retry}</button>
          <a href={t.href} style={{ fontWeight: 700, padding: '12px 20px', borderRadius: 999, border: '2px solid #1d1b1d', color: '#1d1b1d', textDecoration: 'none' }}>{t.home}</a>
        </p>
        {error.digest ? <p style={{ fontSize: 13, color: '#595a5a' }}>{error.digest}</p> : null}
      </main>
    </body>
  </html>;
}
