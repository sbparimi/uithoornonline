import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen w-full bg-cream text-navy antialiased">
      <div className="relative mx-auto min-h-screen w-full max-w-[1440px] bg-cream shadow-[0_0_70px_rgba(13,31,60,0.07)]">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-navy text-navy-foreground">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-2.5" aria-label="Uithoorn Online home">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/10 text-white">
                <span className="font-serif text-[17px]">U</span>
              </span>
              <span className="font-serif text-[20px] tracking-[-0.02em]">uithoorn<span className="text-red">.</span>online</span>
            </Link>
            <button
              aria-label={open ? "Menu sluiten" : "Menu openen"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 transition hover:bg-white/10"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
          {open && (
            <div className="border-t border-white/10 bg-navy">
              <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6 lg:px-8">
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-red" />
                  <span>Onafhankelijke inwonersservice · geen overheidsinstantie</span>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <Link to="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">Start</Link>
                  <Link to="/check" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">Adres controleren</Link>
                  <Link to="/log" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">Geluid melden</Link>
                  <Link to="/map" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">Geluidskaart</Link>
                  <Link to="/claim" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-white/5">Dossier voorbereiden</Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-[11px] text-white/55">
                  <Link to="/privacy" onClick={() => setOpen(false)}>Privacy &amp; AVG</Link>
                  <Link to="/voorwaarden" onClick={() => setOpen(false)}>Voorwaarden</Link>
                  <Link to="/over-de-service" onClick={() => setOpen(false)}>Over de service</Link>
                  {user ? <button onClick={async () => { await supabase.auth.signOut(); setOpen(false); }}>Uitloggen</button> : <Link to="/auth" onClick={() => setOpen(false)}>Inloggen / Registreren</Link>}
                </div>
              </div>
            </div>
          )}
        </header>
        <div className="border-b border-border bg-white px-4 py-2.5 text-[10px] leading-snug text-navy/65 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red" /><span><strong>Informatieservice:</strong> Uithoorn Online is geen overheidsinstantie, advocaat of beslissende autoriteit. Officiële instanties bepalen rechten, compensatie en formele uitkomsten.</span></div>
        </div>
        <main>{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
