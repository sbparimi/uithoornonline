import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapPin, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/check")({
  component: Check,
  head: () => ({ meta: [{ title: "Check je adres — uithoorn.online" }] }),
});

type Result = { inZone: boolean; postcode: string } | null;

function Check() {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<Result>(null);

  const onCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = postcode.replace(/\s/g, "").slice(0, 4);
    const num = parseInt(clean, 10);
    if (isNaN(num)) return;
    setResult({ inZone: num >= 1420 && num <= 1424, postcode: clean });
  };

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <p className="text-xs uppercase tracking-wider text-red font-medium">Stap 1 van 3</p>
        <h1 className="mt-2 text-2xl font-serif">Check jouw adres</h1>
        <p className="mt-2 text-sm text-white/70">
          Vul je postcode in om te zien of je in de overschrijdingszone woont.
        </p>
      </section>

      <section className="px-5 -mt-5">
        <form onSubmit={onCheck} className="rounded-xl bg-white border border-border p-4 shadow-sm">
          <label className="text-xs font-medium text-navy">Postcode</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-cream px-3 py-2.5">
            <MapPin size={18} className="text-navy/50" />
            <input
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="1421 AB"
              className="flex-1 bg-transparent outline-none text-base"
              maxLength={7}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-red py-3 text-red-foreground font-medium"
          >
            Check postcode
          </button>
        </form>
      </section>

      {result && (
        <section className="px-5 mt-5">
          {result.inZone ? (
            <div className="rounded-xl border border-red/30 bg-white p-5">
              <div className="flex items-center gap-2 text-red">
                <CheckCircle2 size={20} />
                <span className="text-xs font-medium uppercase tracking-wider">In de zone</span>
              </div>
              <h2 className="mt-2 text-xl font-serif text-navy">
                Jij hebt recht op compensatie
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Postcode {result.postcode} ligt in de overschrijdingszone van Schiphol.
              </p>
              <div className="mt-4 rounded-xl bg-cream p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Geschatte compensatie</div>
                <div className="mt-1 font-serif text-2xl text-navy">€150 – €2.200</div>
                <div className="text-xs text-muted-foreground">per jaar, afhankelijk van overschrijding</div>
              </div>
              <Link to="/claim" className="mt-4 flex items-center justify-between rounded-xl bg-red px-4 py-3 text-red-foreground font-medium">
                Start mijn claim
                <ChevronRight size={18} />
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-navy/20 bg-white p-5">
              <div className="flex items-center gap-2 text-navy">
                <AlertCircle size={20} />
                <span className="text-xs font-medium uppercase tracking-wider">Buiten zone</span>
              </div>
              <h2 className="mt-2 text-xl font-serif text-navy">
                Postcode {result.postcode} valt buiten de zone
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Je hebt geen directe compensatie-aanspraak, maar je melding helpt wel om de overlast in beeld te brengen.
              </p>
              <Link to="/log" className="mt-4 flex items-center justify-between rounded-xl bg-navy px-4 py-3 text-white font-medium">
                Meld toch geluidshinder
                <ChevronRight size={18} />
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Zone map placeholder */}
      <section className="px-5 mt-6 mb-10">
        <h3 className="text-sm font-medium text-navy">Overschrijdingszone</h3>
        <div className="mt-2 aspect-[4/3] rounded-xl bg-white border border-border overflow-hidden relative">
          <div className="absolute inset-0" style={{
            background:
              "radial-gradient(circle at 50% 55%, rgba(255,60,42,0.35) 0%, rgba(255,60,42,0.18) 30%, rgba(13,31,60,0.05) 60%, transparent 75%)",
          }} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-serif text-navy text-lg">Uithoorn e.o.</div>
              <div className="text-[11px] text-muted-foreground">Postcodes 1420 – 1424</div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
