import { ExternalLink, ShieldCheck, ShieldAlert, Clock } from "lucide-react";

// Source tier system (mirrors knowledge_sources.source_tier):
// 1 = wet / formele regeling (wetten.overheid.nl)
// 2 = nationale overheid (rijksoverheid.nl, ILT, PDOK/BAG)
// 3 = regelgever / exploitant (BAS, Schiphol, LVNL, KNMI)
// 4 = gemeente (uithoorn.nl)
// 5 = overig / community (noise_logs uit onze eigen app)
export type SourceTier = 1 | 2 | 3 | 4 | 5;

export type EvidenceItem = {
  finding: string;
  source_name: string;
  source_url?: string;
  source_tier: SourceTier;
  retrieved_at: string; // ISO
  dataset_version?: string;
  // TTL in ms – used to flag freshness. Defaults per tier.
  ttl_ms?: number;
};

const DEFAULT_TTL: Record<SourceTier, number> = {
  1: 365 * 24 * 3600 * 1000, // laws: 1y
  2: 90 * 24 * 3600 * 1000, // national gov: 90d
  3: 24 * 3600 * 1000, // regulator/operator: 1d
  4: 30 * 24 * 3600 * 1000, // municipal: 30d
  5: 5 * 60 * 1000, // community/live: 5m
};

function tierLabel(t: SourceTier) {
  return {
    1: "Wet",
    2: "Rijksoverheid",
    3: "Regelgever",
    4: "Gemeente",
    5: "Community",
  }[t];
}

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s geleden`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min geleden`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}u geleden`;
  return `${Math.round(h / 24)}d geleden`;
}

export function EvidenceChip({ item }: { item: EvidenceItem }) {
  const ttl = item.ttl_ms ?? DEFAULT_TTL[item.source_tier];
  const stale = Date.now() - new Date(item.retrieved_at).getTime() > ttl;
  const authoritative = item.source_tier <= 3;
  const Icon = authoritative && !stale ? ShieldCheck : ShieldAlert;
  const tone = stale
    ? "border-amber-400/60 bg-amber-50 text-amber-900"
    : authoritative
      ? "border-emerald-400/60 bg-emerald-50 text-emerald-900"
      : "border-navy/20 bg-cream text-navy";

  const Wrapper: any = item.source_url ? "a" : "div";
  const wrapperProps = item.source_url
    ? { href: item.source_url, target: "_blank", rel: "noreferrer noopener" }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] leading-none ${tone}`}
      title={`${item.source_name} — opgehaald ${new Date(item.retrieved_at).toLocaleString("nl-NL")}`}
    >
      <Icon size={12} />
      <span className="font-medium">{tierLabel(item.source_tier)}</span>
      <span className="opacity-60">·</span>
      <span className="truncate max-w-[9rem]">{item.source_name}</span>
      <span className="opacity-60">·</span>
      <Clock size={10} />
      <span>{relTime(item.retrieved_at)}</span>
      {stale && <span className="ml-1 rounded bg-amber-200 px-1 text-[10px]">verouderd</span>}
      {item.source_url && <ExternalLink size={10} className="opacity-60" />}
    </Wrapper>
  );
}

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (!items?.length) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-red/40 bg-red/5 px-2.5 py-1 text-[11px] text-red">
        <ShieldAlert size={12} />
        <span className="font-medium">Bron ontbreekt</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <EvidenceChip key={i} item={it} />
      ))}
    </div>
  );
}
