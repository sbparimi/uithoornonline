import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { MapPin, CheckCircle2, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { EvidenceList } from "@/components/Evidence";
import { checkAddressLive, type AddressCheck } from "@/lib/live-data.functions";

export const Route = createFileRoute("/check")({
  component: Check,
  head: () => ({ meta: [{ title: "Check je adres — uithoorn.online" }] }),
});

function Check() {
  const [postcode, setPostcode] = useState("");
  const [house, setHouse] = useState("");
  const [result, setResult] = useState<AddressCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const run = useServerFn(checkAddressLive);

  const onCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postcode.trim() || !house.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await run({ data: { postcode, house_number: house } });
      setResult(res);
    } catch (err) {
      setResult({
        ok: false,
        reason: "unavailable",
        message: err instanceof Error ? err.message : "Onbekende fout",
        evidence: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <section className="bg-navy text-navy-foreground px-5 pt-6 pb-7">
        <p className="text-xs uppercase tracking-wider text-red font-medium">Stap 1 van 3</p>
        <h1 className="mt-2 text-2xl font-serif">Check jouw adres</h1>
        <p className="mt-2 text-sm text-white/70">
          Live controle via het officiële BAG-adressenregister (Kadaster) en de LIB Schiphol WFS.
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
          <label className="mt-3 block text-xs font-medium text-navy">Huisnummer</label>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-cream px-3 py-2.5">
            <input
              value={house}
              onChange={(e) => setHouse(e.target.value)}
              placeholder="12A"
              className="flex-1 bg-transparent outline-none text-base"
              maxLength={10}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-3 w-full rounded-xl bg-red py-3 text-red-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Officiële bronnen raadplegen…" : "Check adres"}
          </button>
        </form>
      </section>

      {result && result.ok && (
        <section className="px-5 mt-5">
          <div
            className={`rounded-xl border bg-white p-5 ${
              result.in_lib_zone ? "border-red/30" : "border-navy/20"
            }`}
          >
            <div className={`flex items-center gap-2 ${result.in_lib_zone ? "text-red" : "text-navy"}`}>
              {result.in_lib_zone ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="text-xs font-medium uppercase tracking-wider">
                {result.in_lib_zone ? "In LIB-zone" : "Buiten LIB-zones"}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-serif text-navy">{result.address.label}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Gemeente {result.address.municipality || "—"} · BAG {result.address.bag_id}
            </p>

            {result.zones.length > 0 && (
              <ul className="mt-3 space-y-1">
                {result.zones.map((z) => (
                  <li key={z} className="text-sm text-navy">• {z}</li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-sm text-muted-foreground">{result.note}</p>

            <div className="mt-4">
              <EvidenceList items={result.evidence} />
            </div>

            <Link
              to="/claim"
              className="mt-4 flex items-center justify-between rounded-xl bg-red px-4 py-3 text-red-foreground font-medium"
            >
              {result.in_lib_zone ? "Start compensatie-onderzoek" : "Meld toch geluidshinder"}
              <ChevronRight size={18} />
            </Link>
          </div>
        </section>
      )}

      {result && !result.ok && (
        <section className="px-5 mt-5">
          <div className="rounded-xl border border-amber-400/50 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertCircle size={20} />
              <span className="text-xs font-medium uppercase tracking-wider">
                {result.reason === "not_found" ? "Adres niet gevonden" : "Bron niet bereikbaar"}
              </span>
            </div>
            <p className="mt-2 text-sm text-amber-900">{result.message}</p>
            <div className="mt-3">
              <EvidenceList items={result.evidence} />
            </div>
          </div>
        </section>
      )}

      <p className="px-5 mt-6 mb-10 text-[11px] text-muted-foreground">
        We tonen geen postcode-schattingen meer. Elk resultaat komt van
        PDOK/Kadaster met tijdstempel en directe bronlink.
      </p>
    </AppShell>
  );
}
