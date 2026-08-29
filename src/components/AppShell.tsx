import { Link } from "@tanstack/react-router";
import { Menu, X, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return <div className="min-h-screen w-full bg-[#e7e5df] text-navy antialiased">
    <div className="relative mx-auto w-full max-w-[430px] min-h-screen bg-cream shadow-[0_0_60px_rgba(20,35,55,0.10)]">
      <header className="sticky top-0 z-50 bg-navy text-navy-foreground border-b border-white/10">
        <div className="flex h-16 items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Uithoorn Online home">
            <span className="grid h-8 w-8 place-items-center rounded-sm bg-red text-white font-semibold">U</span>
            <span className="font-serif text-[19px] tracking-tight">uithoorn<span className="text-red">.</span>online</span>
          </Link>
          <button aria-label={open ? "Menu sluiten" : "Menu openen"} onClick={() => setOpen(v => !v)} className="grid h-10 w-10 place-items-center rounded-lg border border-white/15">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && <div className="border-t border-white/10 bg-navy px-5 pb-5 pt-3 text-sm">
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-[11px] leading-snug text-white/70"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>Onafhankelijke inwonersservice. Geen overheidsinstantie.</span></div>
          <div className="space-y-3"><Link to="/" onClick={() => setOpen(false)} className="block">Start</Link><Link to="/check" onClick={() => setOpen(false)} className="block">Adres controleren</Link><Link to="/log" onClick={() => setOpen(false)} className="block">Geluid melden</Link><Link to="/map" onClick={() => setOpen(false)} className="block">Geluidskaart</Link><Link to="/claim" onClick={() => setOpen(false)} className="block">Dossier voorbereiden</Link><Link to="/over-de-service" onClick={() => setOpen(false)} className="block">Over de service</Link></div>
          <div className="mt-4 border-t border-white/10 pt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/55"><Link to="/privacy" onClick={() => setOpen(false)}>Privacy &amp; AVG</Link><Link to="/voorwaarden" onClick={() => setOpen(false)}>Voorwaarden</Link>{user ? <button onClick={async () => { await supabase.auth.signOut(); setOpen(false); }}>Uitloggen</button> : <Link to="/auth" onClick={() => setOpen(false)}>Inloggen</Link>}</div>
        </div>}
      </header>
      <div className="border-b border-border bg-white px-5 py-2.5 text-[10px] leading-snug text-navy/65"><strong>Informatieservice:</strong> officiële instanties bepalen rechten, compensatie en formele uitkomsten.</div>
      <main>{children}</main>
      <BottomNav />
    </div>
  </div>;
}
