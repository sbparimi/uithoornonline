import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Plane, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/log")({
  component: LogPage,
  head: () => ({ meta: [{ title: "Geluidshinder melden — uithoorn.online" }] }),
});

type Log = {
  id: string;
  timestamp: string;
  flight_number: string | null;
  altitude: number | null;
  db_level: number | null;
};

const airlines = ["KL", "EZY", "TRA", "HV", "AF", "BA"];
const randInt = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const mockFlight = () => ({
  flight_number: `${airlines[randInt(0, airlines.length - 1)]}${randInt(1000, 9999)}`,
  altitude: randInt(450, 1100),
  db_level: randInt(62, 84),
});

function LogPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState<Log[]>([]);
  const [last, setLast] = useState<Log | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("noise_logs").select("*").order("timestamp", { ascending: false }).limit(20)
      .then(({ data }) => setLogs((data as Log[]) ?? []));
  }, [user]);

  const submit = async () => {
    if (!user) { navigate({ to: "/auth", search: { next: "/log" } as any }); return; }
    setSubmitting(true);
    const f = mockFlight();
    const lat = 52.2333 + (Math.random() - 0.5) * 0.02;
    const lng = 4.8333 + (Math.random() - 0.5) * 0.02;
    const { data, error } = await supabase.from("noise_logs")
      .insert({ user_id: user.id, ...f, lat, lng })
      .select().single();
    setSubmitting(false);
    if (error) { toast.error("Kon melding niet opslaan"); return; }
    const row = data as Log;
    setLast(row); setLogs((p) => [row, ...p]);
    toast.success("Melding geregistreerd");
    if (navigator.vibrate) navigator.vibrate(40);
  };

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <h1 className="text-2xl font-serif">Geluidshinder</h1>
        <p className="mt-1 text-sm text-white/70">
          Eén tap registreert de vlucht boven jou nu.
        </p>
        <div className="mt-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
          <div className="text-[11px] uppercase tracking-wider text-white/50">Nu</div>
          <div className="font-mono tabular-nums">{now.toLocaleString("nl-NL")}</div>
        </div>
      </section>

      <section className="px-5 -mt-5">
        <button
          onClick={submit}
          disabled={submitting || loading}
          className="w-full rounded-2xl bg-red text-red-foreground py-6 shadow-[0_8px_24px_-8px_rgba(255,60,42,0.6)] active:scale-[0.99] transition"
        >
          <div className="flex flex-col items-center gap-2">
            <Plane size={26} />
            <span className="font-serif text-xl">Meld nu geluidshinder</span>
            <span className="text-xs text-red-foreground/80">{submitting ? "Bezig..." : "Tap hierboven"}</span>
          </div>
        </button>
      </section>

      {last && (
        <section className="px-5 mt-4">
          <div className="rounded-xl bg-white border border-border p-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[11px] uppercase tracking-wider text-red font-medium">Laatste melding</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="font-serif text-navy text-lg">{last.flight_number}</div>
              <div className="text-xs text-muted-foreground">{new Date(last.timestamp).toLocaleTimeString("nl-NL")}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-cream p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Hoogte</div>
                <div className="font-mono text-navy">{last.altitude} m</div>
              </div>
              <div className="rounded-lg bg-cream p-3">
                <div className="text-[10px] uppercase text-muted-foreground">Geluid</div>
                <div className="font-mono text-navy">{last.db_level} dB</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="px-5 mt-6">
        <h2 className="text-sm font-medium text-navy">Jouw meldingen</h2>
        {!user && !loading && (
          <Link to="/auth" className="mt-3 block rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">
            Log in om je meldingen te bewaren →
          </Link>
        )}
        {user && logs.length === 0 && (
          <div className="mt-3 rounded-xl border border-dashed border-border bg-white/50 p-6 text-center text-sm text-muted-foreground">
            Nog geen meldingen. Tap de rode knop hierboven.
          </div>
        )}
        {logs.length > 0 && (
          <ul className="mt-3 space-y-2">
            {logs.map((l) => {
              const d = new Date(l.timestamp);
              return (
                <li key={l.id} className="flex items-center justify-between rounded-xl bg-white border border-border px-4 py-3">
                  <div>
                    <div className="font-serif text-navy">{l.flight_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.toLocaleDateString("nl-NL")} · {d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-navy text-sm">{l.db_level} dB</div>
                    <div className="text-[11px] text-muted-foreground">{l.altitude} m</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="px-5 mt-8 mb-10">
        <Link to="/claim" className="flex items-center justify-between rounded-xl bg-navy px-4 py-4 text-white">
          <div>
            <div className="font-serif text-lg">Klaar om te claimen?</div>
            <div className="text-xs text-white/70">Start je compensatieclaim in 3 stappen</div>
          </div>
          <ChevronRight size={18} />
        </Link>
      </section>
    </AppShell>
  );
}
