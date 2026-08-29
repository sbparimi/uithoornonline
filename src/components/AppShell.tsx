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
    <div className="min-h-screen w-full flex justify-center bg-cream">
      <div className="relative w-full max-w-[390px] bg-cream min-h-screen pb-20 shadow-[0_0_40px_rgba(0,0,0,0.04)]">
        <header className="sticky top-0 z-30 bg-navy text-navy-foreground">
          <div className="flex items-center justify-between px-5 h-14">
            <Link to="/" className="font-serif text-lg tracking-tight">
              uithoorn<span className="text-red">.</span>online
            </Link>
            <button
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              className="p-2 -mr-2"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
          {open && (
            <div className="bg-navy border-t border-white/10 px-5 py-4 space-y-3 text-sm">
              <Link to="/" onClick={() => setOpen(false)} className="block">Home</Link>
              <Link to="/check" onClick={() => setOpen(false)} className="block">Check mijn adres</Link>
              <Link to="/log" onClick={() => setOpen(false)} className="block">Geluidshinder melden</Link>
              <Link to="/map" onClick={() => setOpen(false)} className="block">Geluidskaart</Link>
              <Link to="/claim" onClick={() => setOpen(false)} className="block">Dossier voorbereiden</Link>
              <div className="pt-3 border-t border-white/10 text-[11px] leading-snug text-white/60">
                Uithoorn Online is geen overheidsinstantie en bepaalt niet of iemand recht heeft op compensatie.
              </div>
              <div className="pt-3 border-t border-white/10 flex gap-4 text-white/60 text-xs">
                <Link to="/privacy" onClick={() => setOpen(false)}>Privacy &amp; AVG</Link>
                <Link to="/voorwaarden" onClick={() => setOpen(false)}>Voorwaarden</Link>
              </div>
              <div className="pt-3 border-t border-white/10">
                {user ? (
                  <button
                    onClick={async () => { await supabase.auth.signOut(); setOpen(false); }}
                    className="text-white/70"
                  >Uitloggen ({user.email})</button>
                ) : (
                  <Link to="/auth" onClick={() => setOpen(false)} className="text-white/80">Inloggen / Registreren</Link>
                )}
              </div>
            </div>
          )}
        </header>
        <div className="border-b border-border bg-white px-5 py-2 text-[10px] leading-snug text-navy/65">
          <strong>Informatieservice:</strong> Uithoorn Online is geen overheidsinstantie, advocaat of beslissende autoriteit.
          Officiële instanties bepalen rechten, compensatie en formele uitkomsten.
        </div>
        <main>{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
